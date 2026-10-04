import { api,json } from "@/lib/server/http";
import { requireParticipant } from "@/lib/server/auth";
import { getEventInfo } from "@/lib/server/event-window";
import { leaderboard } from "@/lib/server/leaderboard";
// Internal user IDs stay server-side; the caller's own row is flagged instead.
export async function GET(request:Request){return api(async()=>{const user=await requireParticipant(request);const [event,entries]=await Promise.all([getEventInfo(),leaderboard()]);return json({event,leaderboard:entries.map(({userId,...entry})=>({...entry,isYou:userId===user.id}))});});}
