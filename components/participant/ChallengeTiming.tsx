"use client";
import { formatClockTime, formatDuration } from "@/lib/participant/format";
import { useServerNow } from "./useServerNow";
type Timing={startedAt:number|null;solvedAt:number|null;durationSeconds:number|null;awardedPoints:number|null;maxPoints:number};
// Individual challenge clock (started_at → solved_at). Timestamps come from the server; only the
// in-progress elapsed counter animates locally. Elapsed stops at event end because no solve can follow.
export default function ChallengeTiming({timing,serverNow,timezone,eventEndsAt=null}:{timing:Timing;serverNow:number;timezone:string;eventEndsAt?:number|null}) {
 const now=useServerNow(serverNow);
 const {startedAt,solvedAt}=timing;
 const state=startedAt===null?'NOT STARTED':solvedAt===null?'IN PROGRESS':'SOLVED';
 const rows:[string,string][]=startedAt===null?[]:solvedAt===null
  ?[['Started',formatClockTime(startedAt,timezone)],['Elapsed',formatDuration((Math.min(now,eventEndsAt??now)-startedAt)/1000)],['Max',`${timing.maxPoints} pts`]]
  :[['Started',formatClockTime(startedAt,timezone)],['Solved',formatClockTime(solvedAt,timezone)],['Time',formatDuration(timing.durationSeconds??(solvedAt-startedAt)/1000)],['Awarded',`${timing.awardedPoints??0} pts`]];
 return <dl className="arena-timing" data-challenge-timing={state} data-started-at={startedAt??undefined}>
  <div className="arena-timing-state"><dt>STATUS</dt><dd>{state}</dd></div>
  {startedAt===null&&<div><dt>Points</dt><dd>{timing.maxPoints} PTS</dd></div>}
  {rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
 </dl>;
}
