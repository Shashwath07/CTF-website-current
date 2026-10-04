// Pure event-clock and scoring rules shared by the server, UI and unit tests. No I/O here.
// Two independent clocks: the global event window decides whether play is allowed; each
// participant's started_at → solved_at decides points. Event time never feeds into a score.

export type EventState = "UPCOMING" | "LIVE" | "ENDED";
export type EventWindow = { startsAt: number; endsAt: number | null };
export type ScoringConfig = { maxPoints: number; minPoints: number; decayMinutes: number };

// Start is inclusive and end is exclusive: a request received at exactly event_end_at is too late.
export function getEventState(event: EventWindow, now: number): EventState {
  if (now < event.startsAt) return "UPCOMING";
  if (event.endsAt !== null && now >= event.endsAt) return "ENDED";
  return "LIVE";
}

export function isEventLive(event: EventWindow, now: number) {
  return getEventState(event, now) === "LIVE";
}

// Whole seconds a participant has spent on a challenge; null when the start time is missing/invalid.
// A start "in the future" (clock skew) counts as zero rather than producing negative time.
export function getChallengeElapsed(startedAt: number | null | undefined, until: number): number | null {
  if (typeof startedAt !== "number" || !Number.isFinite(startedAt) || !Number.isFinite(until)) return null;
  return Math.max(0, Math.floor((until - startedAt) / 1000));
}

// awarded = max - (max - min) * min(elapsedMinutes / decayMinutes, 1), rounded, never below min or 0.
export function calculateChallengeScore(config: ScoringConfig, durationSeconds: number): number {
  const max = Math.max(0, Math.floor(config.maxPoints));
  const min = Math.min(max, Math.max(0, Math.floor(config.minPoints)));
  const elapsedMinutes = Math.max(0, durationSeconds) / 60;
  // Unknown durations or a broken decay window fall to the minimum rather than inflating a score.
  const progress = Number.isFinite(elapsedMinutes) && config.decayMinutes > 0 ? Math.min(elapsedMinutes / config.decayMinutes, 1) : 1;
  return Math.max(min, Math.round(max - (max - min) * progress));
}
