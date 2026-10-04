import type { EventState } from "../scoring";
export type Participant = { id:string; username:string; email:string; displayName:string; participantId:string; role:string; startedAt:number|null };
export type Challenge = { id:string; challengeCode:string; title:string; category:string; difficulty:string; description:string; maxPoints:number; minPoints:number; decayMinutes:number };
// startedAt/solvedAt are the participant's own challenge clock; durationSeconds/awardedPoints are the persisted solve snapshot.
export type Assignment = Challenge & { assignedAt:number; startedAt:number; solvedAt:number|null; durationSeconds:number|null; awardedPoints:number|null };
// Timestamps are UTC epoch milliseconds; `timezone` is the display zone. serverNow lets clients correct local clock skew.
export type EventInfo = { name:string; startsAt:number; endsAt:number|null; timezone:string; state:EventState; serverNow:number };
export type LeaderboardEntry = { rank:number; userId:string; displayName:string; participantId:string; score:number; solved:number; lastSolveAt:number };
export type DashboardData = {
 participant:Participant; assignedChallenge:Assignment|null; score:number; rank:number|null; solves:number; hintsUsed:number;
 completedChallenges:Assignment[]; allChallengesCompleted:boolean; totalChallenges:number; event:EventInfo; announcements:{id:string;body:string;publishedAt:number}[];
 recentActivity:{id:string;type:string;challengeCode:string;at:number}[];
};
export const categories = ["WEB","CRYPTO","PWN","REVERSE","FORENSICS","OSINT"] as const;
