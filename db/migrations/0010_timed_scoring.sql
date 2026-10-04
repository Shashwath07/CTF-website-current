-- Timed CTF: global event window, per-challenge scoring config, persisted solve scores, score ledger.
-- All timestamps are UTC epoch milliseconds, like every other timestamp in this schema.

-- Global event clock (single row). It only decides whether play is allowed; it never affects score.
-- Start mirrors lib/event.ts (12 Oct 2026 00:00 IST). End stays NULL (LIVE with no end) until organizers
-- confirm it; set both with `npm run event:set:local` locally or an UPDATE against production D1.
CREATE TABLE event_config (
 id INTEGER PRIMARY KEY CHECK(id=1),
 event_start_at INTEGER NOT NULL,
 event_end_at INTEGER,
 timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
 updated_at INTEGER NOT NULL,
 CHECK(event_end_at IS NULL OR event_end_at>event_start_at)
);
INSERT INTO event_config(id,event_start_at,event_end_at,timezone,updated_at) VALUES(1,1791743400000,NULL,'Asia/Kolkata',CAST(strftime('%s','now') AS INTEGER)*1000)
ON CONFLICT(id) DO NOTHING;

-- Organizer-tunable scoring. Defaults apply to challenges added later without explicit values.
ALTER TABLE challenges ADD COLUMN max_points INTEGER NOT NULL DEFAULT 100 CHECK(max_points>0);
ALTER TABLE challenges ADD COLUMN min_points INTEGER NOT NULL DEFAULT 50 CHECK(min_points>=0);
ALTER TABLE challenges ADD COLUMN decay_minutes INTEGER NOT NULL DEFAULT 60 CHECK(decay_minutes>0);
-- Provisional values, randomised once (multiples of 25, banded by difficulty) and fixed here.
-- min_points is ~50% of max_points; rebalance after blind testing.
UPDATE challenges SET max_points=150,min_points=75,decay_minutes=45 WHERE id='WEB-101';
UPDATE challenges SET max_points=200,min_points=100,decay_minutes=60 WHERE id='WEB-102';
UPDATE challenges SET max_points=250,min_points=125,decay_minutes=120 WHERE id='FORENSICS-103';
UPDATE challenges SET max_points=300,min_points=150,decay_minutes=120 WHERE id='CRYPTO-104';
UPDATE challenges SET max_points=175,min_points=90,decay_minutes=90 WHERE id='CRYPTO-105';

-- Solve snapshot, written once with solved_at on the first correct flag and never recalculated.
-- started_at/solved_at already exist on participant_challenges and remain the individual challenge clock.
ALTER TABLE participant_challenges ADD COLUMN duration_seconds INTEGER CHECK(duration_seconds>=0);
ALTER TABLE participant_challenges ADD COLUMN awarded_points INTEGER CHECK(awarded_points>=0);

-- Auditable score ledger: totals are SUM(points). SOLVE rows now; future HINT rows carry negative points.
CREATE TABLE score_events (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 challenge_id TEXT NOT NULL REFERENCES challenges(id),
 kind TEXT NOT NULL CHECK(kind IN ('SOLVE','HINT')),
 points INTEGER NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX score_events_one_solve ON score_events(user_id,challenge_id) WHERE kind='SOLVE';
CREATE INDEX score_events_user ON score_events(user_id,kind);

-- One-time backfill of solves recorded before scoring existed, using the same formula as
-- calculateChallengeScore() in lib/scoring.ts. Later config changes never touch these rows.
UPDATE participant_challenges SET duration_seconds=MAX(0,(solved_at-started_at)/1000) WHERE solved_at IS NOT NULL;
UPDATE participant_challenges SET awarded_points=(
 SELECT MAX(0,CAST(ROUND(c.max_points-(c.max_points-MIN(c.min_points,c.max_points))*MIN(participant_challenges.duration_seconds/60.0/c.decay_minutes,1.0)) AS INTEGER))
 FROM challenges c WHERE c.id=participant_challenges.challenge_id
) WHERE solved_at IS NOT NULL;
INSERT INTO score_events(id,user_id,challenge_id,kind,points,created_at)
SELECT lower(hex(randomblob(16))),user_id,challenge_id,'SOLVE',awarded_points,solved_at FROM participant_challenges WHERE solved_at IS NOT NULL;
