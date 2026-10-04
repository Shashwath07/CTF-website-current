import "server-only";
import { database } from "./database";
import type { LeaderboardEntry } from "../participant/types";

// Totals come only from persisted score_events (SOLVE now, HINT penalties later), never from the client.
// Ranking: highest score, then most solves, then earliest final solve, then participant ID so ties are deterministic.
export async function leaderboard(): Promise<LeaderboardEntry[]> {
 return (await database().prepare(`WITH totals AS (
  SELECT u.id AS userId,u.display_name AS displayName,u.participant_id AS participantId,
   SUM(e.points) AS score,
   SUM(e.kind='SOLVE') AS solved,
   MAX(CASE WHEN e.kind='SOLVE' THEN e.created_at END) AS lastSolveAt
  FROM score_events e JOIN users u ON u.id=e.user_id
  WHERE u.role='participant'
  GROUP BY u.id
 )
 SELECT ROW_NUMBER() OVER (ORDER BY score DESC,solved DESC,lastSolveAt ASC,participantId ASC) AS rank,* FROM totals
 WHERE solved>0 ORDER BY rank`).all<LeaderboardEntry>()).results;
}

export async function standing(userId: string) {
 const board=await leaderboard();
 const entry=board.find(row=>row.userId===userId);
 return {score:entry?.score??0,rank:entry?.rank??null};
}
