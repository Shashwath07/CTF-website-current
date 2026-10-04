"use client";
import type { EventInfo } from "@/lib/participant/types";
import { getEventState } from "@/lib/scoring";
import { formatCountdown, formatEventDate } from "@/lib/participant/format";
import { useServerNow } from "./useServerNow";
// Global event clock only: UPCOMING / LIVE / ENDED. It never shows or influences challenge scores.
export default function EventClock({event,detailed=false}:{event:EventInfo;detailed?:boolean}) {
 const now=useServerNow(event.serverNow);
 const state=getEventState(event,now);
 const label=state==='UPCOMING'?'EVENT STARTS IN':state==='LIVE'?'LIVE':'EVENT ENDED';
 const value=state==='UPCOMING'?formatCountdown((event.startsAt-now)/1000):state==='ENDED'?'Final standings':event.endsAt!==null?`${formatCountdown((event.endsAt-now)/1000)} remaining`:'End time TBA';
 const clock=<span className="arena-clock" data-event-state={state}><small>{label}</small><time aria-live="off">{value}</time></span>;
 if(!detailed)return clock;
 return <div className="arena-event-window">
  <dl><div><dt>START</dt><dd>{formatEventDate(event.startsAt,event.timezone)}</dd></div><div><dt>END</dt><dd>{event.endsAt!==null?formatEventDate(event.endsAt,event.timezone):'To be announced'}</dd></div></dl>
  {clock}
 </div>;
}
