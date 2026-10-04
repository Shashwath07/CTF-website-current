import { api,json } from "@/lib/server/http";
import { requireParticipant } from "@/lib/server/auth";
import { getEventInfo } from "@/lib/server/event-window";
export async function GET(request:Request){return api(async()=>json({participant:await requireParticipant(request),event:await getEventInfo()}));}
