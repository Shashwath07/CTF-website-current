import "server-only";
import { database } from "./database";
import { ApiError } from "./http";
import { eventConfig } from "../event";
import { getEventState, type EventWindow } from "../scoring";
import type { EventInfo } from "../participant/types";

// The authoritative event window lives in D1 (event_config, migration 0010) so organizers can
// change it without a deploy. lib/event.ts stays the public landing-page countdown copy.
export async function loadEventWindow(): Promise<EventWindow & { timezone: string }> {
 const row=await database().prepare("SELECT event_start_at AS startsAt,event_end_at AS endsAt,timezone FROM event_config WHERE id=1").first<EventWindow & {timezone:string}>();
 // Fail closed: without a configured window the server cannot decide whether play is allowed.
 if(!row) throw new Error("Event configuration missing");
 return row;
}

export async function getEventInfo(now=Date.now()): Promise<EventInfo> {
 const window=await loadEventWindow();
 return {name:eventConfig.name,...window,state:getEventState(window,now),serverNow:now};
}

// Gate for every gameplay mutation (start/next challenge, flag submission, future hints).
// `now` must be the server receipt time of the request; client clocks are never consulted.
export async function requireEventLive(now: number) {
 const window=await loadEventWindow();
 const state=getEventState(window,now);
 if(state==="UPCOMING") throw new ApiError(403,"The event has not started yet.","EVENT_NOT_STARTED");
 if(state==="ENDED") throw new ApiError(403,"The event has ended. Challenges and submissions are closed.","EVENT_ENDED");
 return window;
}
