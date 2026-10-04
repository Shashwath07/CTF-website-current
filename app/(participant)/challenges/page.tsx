import Link from "next/link";
import { requireParticipantPage } from "@/lib/server/auth";
import { availableChallenges,progression } from "@/lib/server/competition";
import { getEventInfo } from "@/lib/server/event-window";
import { categories } from "@/lib/participant/types";
import StartChallenge from "@/components/participant/StartChallenge";
import ChallengeTiming from "@/components/participant/ChallengeTiming";
export default async function ChallengesPage({searchParams}:{searchParams:Promise<{category?:string}>}) {
 const user=await requireParticipantPage();const {category}=await searchParams;const [all,state,event]=await Promise.all([availableChallenges(),progression(user.id),getEventInfo()]);const assigned=state.assignedChallenge;const selected=categories.find(c=>c===category);const filtered=selected?all.filter(c=>c.category===selected):all;
 const own=[...state.completedChallenges,...(assigned?[assigned]:[])];
 return <section className="arena-route"><p className="arena-kicker">EXPLORE THE GRID</p><h1>CHALLENGES</h1><div className="arena-filters"><Link href="/challenges" aria-current={!selected?'page':undefined}>ALL</Link>{categories.map(c=><Link href={'/challenges?category='+c} key={c} aria-current={selected===c?'page':undefined}>{c}</Link>)}</div><div className="arena-challenge-list">{filtered.map(c=>{const mine=own.find(a=>a.id===c.id);return <article className="arena-panel" key={c.id}><span className="arena-kicker">{c.challengeCode} / {c.category} / {c.difficulty}</span><h2>{c.title}</h2><p>{c.description}</p><ChallengeTiming timing={mine??{...c,startedAt:null,solvedAt:null,durationSeconds:null,awardedPoints:null}} serverNow={event.serverNow} timezone={event.timezone} eventEndsAt={event.endsAt}/>{mine&&mine.solvedAt!==null?<p>COMPLETED ✓</p>:assigned?.id===c.id?<><p>CURRENT</p><Link className="register arena-start" href={'/challenges/'+c.id}>CONTINUE →</Link></>:<p className="arena-empty">AVAILABLE · NOT ASSIGNED</p>}</article>;})}</div>{!filtered.length&&<p className="arena-empty">No {selected??''} challenges have been published yet.</p>}<StartChallenge assigned={!!assigned} completed={state.completedChallenges.length>0} allCompleted={state.allChallengesCompleted} eventState={event.state} assignedId={assigned?.id}/></section>;
}
