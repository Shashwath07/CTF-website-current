import "server-only";
import { timingSafeEqual } from "node:crypto";
import { database } from "./database";
import { ApiError } from "./http";
import { requireEventLive } from "./event-window";
import { calculateChallengeScore, getChallengeElapsed, type ScoringConfig } from "../scoring";
import { web101Flag } from "./web101";
import { web102Flag } from "./web102";
import { forensics103Flag } from "./forensics103";
import { crypto104Flag } from "./crypto104";
import { crypto105Flag } from "./crypto105";

export async function submissionHistory(userId: string) {
  const rows = await database().prepare(`SELECT s.id,c.challenge_code AS challengeId,s.is_correct AS isCorrect,s.submitted_at AS submittedAt
    FROM submissions s JOIN challenges c ON c.id=s.challenge_id WHERE s.user_id=? ORDER BY s.submitted_at DESC,s.id DESC LIMIT 50`).bind(userId).all<{id:string;challengeId:string;isCorrect:number;submittedAt:number}>();
  return rows.results.map(row=>({...row,isCorrect:!!row.isCorrect,result:row.isCorrect?'CORRECT':'INCORRECT'}));
}

// `now` is the server receipt time: it decides the event window and becomes solved_at, so a flag
// received before event_end_at is accepted and one received at/after it is rejected.
export async function submitFlag(userId: string, body: unknown, now = Date.now()) {
  await requireEventLive(now);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400,'Enter a challenge ID and flag.');
  const {challengeId,flag} = body as {challengeId?:unknown;flag?:unknown};
  if(typeof challengeId!=='string'||!challengeId.trim()||challengeId.length>64||typeof flag!=='string'||!flag.trim()||flag.length>512) throw new ApiError(400,'Enter a valid challenge ID and flag (maximum 512 characters).');
  // An atomic conditional upsert admits at most one request every two seconds per user.
  const permit=await database().prepare(`INSERT INTO submission_limits(user_id,next_allowed_at) VALUES(?,?)
    ON CONFLICT(user_id) DO UPDATE SET next_allowed_at=excluded.next_allowed_at WHERE submission_limits.next_allowed_at<=? RETURNING user_id`).bind(userId,now+2000,now).first();
  if(!permit) throw new ApiError(429,'Please wait two seconds before submitting again.');
  const challenge=await database().prepare('SELECT id,challenge_code AS code,max_points AS maxPoints,min_points AS minPoints,decay_minutes AS decayMinutes FROM challenges WHERE challenge_code=? AND active=1').bind(challengeId.trim().toUpperCase()).first<{id:string;code:string}&ScoringConfig>();
  if(!challenge) throw new ApiError(400,'Invalid challenge ID.');
  const assigned=await database().prepare('SELECT started_at AS startedAt,solved_at AS solvedAt FROM participant_challenges WHERE user_id=? AND challenge_id=?').bind(userId,challenge.id).first<{startedAt:number|null;solvedAt:number|null}>();
  if(!assigned) throw new ApiError(403,'This challenge is not assigned to you.');
  if(assigned.solvedAt!==null) return {correct:true,alreadySolved:true,message:'Challenge already solved.'};
  // The individual challenge clock: points depend only on this participant's started_at → now.
  const durationSeconds=getChallengeElapsed(assigned.startedAt,now);
  if(durationSeconds===null) throw new ApiError(409,'This challenge has no recorded start time. Please contact an organizer.','CHALLENGE_NOT_STARTED');
  const awardedPoints=calculateChallengeScore(challenge,durationSeconds);
  const validators:Record<string,()=>string>={'WEB-101':web101Flag,'WEB-102':web102Flag,'FORENSICS-103':forensics103Flag,'CRYPTO-104':crypto104Flag,'CRYPTO-105':crypto105Flag};
  const validator=validators[challenge.code]??null;
  if(!validator) throw new ApiError(409,'Submissions are not available for this challenge yet.');
  const hash=(value:string)=>crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  const [provided,expected]=await Promise.all([hash(flag.trim()),hash(validator())]);
  const correct=timingSafeEqual(new Uint8Array(provided),new Uint8Array(expected));
  // D1 batch is transactional: the attempt, first solve snapshot and SOLVE ledger entry persist together or not at all.
  // `solved_at IS NULL` lets exactly one concurrent correct request win; the ledger insert only follows the row
  // this request wrote, and the one-SOLVE-per-challenge unique index rejects any duplicate.
  const result=await database().batch([
    database().prepare('INSERT INTO submissions(id,user_id,challenge_id,is_correct,submitted_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),userId,challenge.id,correct?1:0,now),
    database().prepare('UPDATE participant_challenges SET solved_at=?,duration_seconds=?,awarded_points=? WHERE user_id=? AND challenge_id=? AND solved_at IS NULL AND started_at=? AND ?=1').bind(now,durationSeconds,awardedPoints,userId,challenge.id,assigned.startedAt,correct?1:0),
    database().prepare(`INSERT INTO score_events(id,user_id,challenge_id,kind,points,created_at)
      SELECT ?,user_id,challenge_id,'SOLVE',awarded_points,solved_at FROM participant_challenges
      WHERE user_id=? AND challenge_id=? AND solved_at=? AND awarded_points=? AND ?=1 ON CONFLICT DO NOTHING`).bind(crypto.randomUUID(),userId,challenge.id,now,awardedPoints,correct?1:0),
  ]);
  if(correct&&!result[1].meta.changes) return {correct:true,alreadySolved:true,message:'Challenge already solved.'};
  if(!correct) return {correct,message:'Incorrect flag.'};
  return {correct,message:'Flag accepted.',solvedAt:now,durationSeconds,awardedPoints};
}
