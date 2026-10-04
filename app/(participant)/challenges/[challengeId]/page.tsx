import Link from "next/link";
import { notFound } from "next/navigation";
import { requireParticipantPage } from "@/lib/server/auth";
import { assignment,progression } from "@/lib/server/competition";
import { getEventInfo } from "@/lib/server/event-window";
import StartChallenge from "@/components/participant/StartChallenge";
import ChallengeTiming from "@/components/participant/ChallengeTiming";
import GhostFrame from "@/components/participant/GhostFrame";
import PortalFrame from "@/components/participant/PortalFrame";
import EvidenceChallenge from "@/components/participant/EvidenceChallenge";
import DeadDropChallenge from "@/components/participant/DeadDropChallenge";
import ShiftChangeChallenge from "@/components/participant/ShiftChangeChallenge";
export default async function ChallengePage({params}:{params:Promise<{challengeId:string}>}) {
 const user=await requireParticipantPage();const {challengeId}=await params;const [challenge,event]=await Promise.all([assignment(user.id,challengeId),getEventInfo()]);if(!challenge)notFound();
 // Opening or refreshing this page only reads the persisted started_at; it never starts or restarts the clock.
 const timing=<ChallengeTiming timing={challenge} serverNow={event.serverNow} timezone={event.timezone} eventEndsAt={event.endsAt}/>;
 if(challenge.solvedAt!==null){const state=await progression(user.id);return <section className="arena-route"><h1>{challenge.challengeCode}</h1><h2>CHALLENGE COMPLETED ✓</h2>{timing}<StartChallenge assigned={!!state.assignedChallenge} completed allCompleted={state.allChallengesCompleted} eventState={event.state} assignedId={state.assignedChallenge?.id}/><Link href="/challenges">← Back to challenges</Link></section>;}
 const content=challenge.challengeCode==='WEB-101'?<GhostFrame/>
  :challenge.challengeCode==='WEB-102'?<PortalFrame/>
  :challenge.challengeCode==='FORENSICS-103'?<EvidenceChallenge challenge={challenge}/>
  :challenge.challengeCode==='CRYPTO-104'?<DeadDropChallenge challenge={challenge}/>
  :challenge.challengeCode==='CRYPTO-105'?<ShiftChangeChallenge challenge={challenge}/>
  :<section className="arena-route"><p className="arena-kicker">{challenge.challengeCode} / {challenge.category} / {challenge.difficulty}</p><h1>{challenge.title}</h1><div className="arena-panel arena-challenge-placeholder"><h2>ASSIGNED TO YOU</h2><p>{challenge.description}</p><p>Your assignment and start time are saved. The isolated challenge environment and flag-submission system are not implemented in this release.</p><Link href="/challenges">← Back to challenges</Link></div></section>;
 return <><div className="arena-timing-bar">{timing}</div>{content}</>;
}
