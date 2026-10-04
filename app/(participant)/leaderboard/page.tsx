import { requireParticipantPage } from "@/lib/server/auth";
import { getEventInfo } from "@/lib/server/event-window";
import { leaderboard } from "@/lib/server/leaderboard";
import { formatEventDate } from "@/lib/participant/format";
// Rendered per request from persisted score_events, so a solve shows up on the next load.
export default async function LeaderboardPage(){
 const user=await requireParticipantPage();const [event,entries]=await Promise.all([getEventInfo(),leaderboard()]);
 return <section className="arena-route arena-leaderboard"><p className="arena-kicker">THE COMPETITION</p><h1>LEADERBOARD</h1>
  <div className="arena-panel"><div className="arena-panel-heading"><h3>{event.state==='ENDED'?'FINAL STANDINGS':'LIVE STANDINGS'}</h3><small>SCORE · SOLVES · EARLIEST FINAL SOLVE</small></div>
   {entries.length?<div className="arena-board"><table><thead><tr><th>Rank</th><th>Participant</th><th>Solved</th><th>Score</th><th>Last solve</th></tr></thead><tbody>{entries.map(e=><tr key={e.userId} aria-current={e.userId===user.id?'true':undefined} data-leaderboard-row={e.participantId}><td>{e.rank}</td><td>{e.displayName}<small>#{e.participantId}{e.userId===user.id?' · YOU':''}</small></td><td>{e.solved}</td><td><b>{e.score}</b></td><td><time dateTime={new Date(e.lastSolveAt).toISOString()}>{formatEventDate(e.lastSolveAt,event.timezone)}</time></td></tr>)}</tbody></table></div>
   :<p className="arena-empty">{event.state==='UPCOMING'?'Standings appear once the event starts and the first flag is accepted.':'No solves recorded yet.'}</p>}
  </div></section>;
}
