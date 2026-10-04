import { requireParticipant } from "@/lib/server/auth";
import { ApiError,api,json,readJson,sameOrigin } from "@/lib/server/http";
import { submissionHistory,submitFlag } from "@/lib/server/submissions";
export async function GET(request:Request) {
  return api(async()=>{const user=await requireParticipant(request);return json({submissions:await submissionHistory(user.id)});});
}
export async function POST(request:Request) {
  // Receipt time is captured before any other work so the event cutoff and solve time are exact.
  const receivedAt=Date.now();
  return api(async()=>{
    try {
      const user=await requireParticipant(request);sameOrigin(request);
      return json(await submitFlag(user.id,await readJson(request),receivedAt));
    } catch(error) {
      if(error instanceof ApiError) return json({correct:false,message:error.message,...(error.code?{code:error.code}:{})},error.status,error.status===429?{'Retry-After':'2'}:{});
      throw error;
    }
  });
}
