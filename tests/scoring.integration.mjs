// Timed CTF end to end against the local app and local D1: event window enforcement, the individual
// challenge clock, persisted scoring, duplicate/concurrent solves, leaderboard ranking and the participant UI.
import '../scripts/sites-env.mjs';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {readFileSync,mkdirSync} from 'node:fs';
import bcrypt from 'bcryptjs';
import {queryLocal,executeLocalSql} from '../scripts/local-participants.mjs';
import {readEventWindow,setEventWindow} from './event-fixture.mjs';
import {calculateChallengeScore} from '../lib/scoring.ts';
const base=process.env.TEST_BASE_URL||'http://localhost:5173';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Local test only');
const vars=readFileSync('.dev.vars','utf8');
const flags=Object.fromEntries([['WEB-101','WEB101'],['WEB-102','WEB102']].map(([id,env])=>[id,vars.match(new RegExp('^'+env+'_FLAG="([^"]+)"','m'))?.[1]]));
assert.ok(flags['WEB-101']&&flags['WEB-102'],'WEB-101/WEB-102 flags required in .dev.vars');
const run='score-'+randomUUID().slice(0,8),password=randomBytes(24).toString('hex');
const users={a:run+'-a',b:run+'-b',c:run+'-c'},board=['l1','l2','l3','l4','l5'].map(k=>run+'-'+k);
const all=[...Object.values(users),...board];
const q=v=>"'"+String(v).replaceAll("'","''")+"'";
const sql=text=>executeLocalSql(text,{quiet:true});
const row=(user,challenge)=>queryLocal(`SELECT started_at AS startedAt,solved_at AS solvedAt,duration_seconds AS durationSeconds,awarded_points AS awardedPoints FROM participant_challenges WHERE user_id=${q(user)} AND challenge_id=${q(challenge)};`)[0];
const ledger=(user)=>queryLocal(`SELECT kind,points,challenge_id AS challengeId,created_at AS createdAt FROM score_events WHERE user_id=${q(user)};`);
const config=id=>queryLocal(`SELECT max_points AS maxPoints,min_points AS minPoints,decay_minutes AS decayMinutes FROM challenges WHERE id=${q(id)};`)[0];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let checks=0,browser,page;const check=(value,label)=>{assert.ok(value,label);checks++;};
async function request(path,cookie='',method='GET',body){return fetch(base+path,{method,redirect:'manual',headers:{Origin:base,Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});}
async function call(path,cookie,method='GET',body){const r=await request(path,cookie,method,body);return {status:r.status,body:await r.json()};}
async function login(id){const r=await request('/api/auth/login','','POST',{identifier:id,password});assert.equal(r.status,200,'login '+id);return r.headers.get('set-cookie').split(';')[0];}
const submit=(cookie,challengeId,flag)=>call('/api/submissions',cookie,'POST',{challengeId,flag});
const previous=readEventWindow();
const live=()=>setEventWindow(Date.now()-60_000,Date.now()+3_600_000);
try{
 const hash=await bcrypt.hash(password,12);
 sql(all.map((id,i)=>`INSERT INTO users(id,username,email,password_hash,display_name,participant_id,role,created_at) VALUES(${[id,id,id+'@example.test',hash,'Score QA '+id.slice(-2).toUpperCase(),run+'-P'+i,'participant'].map(q).join(',')},${Date.now()});`).join(''));

 // ---- Before the event: login/dashboard allowed, gameplay rejected server-side.
 setEventWindow(Date.now()+3_600_000,Date.now()+7_200_000);
 const a1=await login(users.a);check(true,'Login before event allowed');
 let dash=await call('/api/dashboard',a1);check(dash.status===200&&dash.body.event.state==='UPCOMING','Dashboard before event allowed, state UPCOMING');
 for(const path of ['/api/challenges/start','/api/challenges/next']){const r=await call(path,a1,'POST');check(r.status===403&&r.body.code==='EVENT_NOT_STARTED',path+' before event → EVENT_NOT_STARTED');}
 let r=await submit(a1,'WEB-101',flags['WEB-101']);check(r.status===403&&r.body.code==='EVENT_NOT_STARTED'&&r.body.correct===false,'Submit before event → EVENT_NOT_STARTED');
 check(queryLocal(`SELECT COUNT(*) AS n FROM participant_challenges WHERE user_id=${q(users.a)};`)[0].n===0,'No assignment created before event');
 check((await call('/api/submissions',a1)).body.submissions.length===0,'Rejected pre-event submission not recorded');

 // ---- During the event: first start writes started_at; refresh, re-open, second tab and re-login never move it.
 live();
 const a2=await login(users.a);// second "tab"/device session
 const before=Date.now();
 const starts=await Promise.all([a1,a2,a1,a2].map(cookie=>call('/api/challenges/start',cookie,'POST')));
 const after=Date.now();
 check(starts.every(s=>s.status===200),'Start during event allowed');
 const challengeA=starts[0].body.assignedChallenge;
 check(starts.every(s=>s.body.assignedChallenge.id===challengeA.id&&s.body.assignedChallenge.startedAt===challengeA.startedAt),'Concurrent starts in two tabs share one started_at');
 check(challengeA.startedAt>=before&&challengeA.startedAt<=after,'started_at is server time of first start');
 check(row(users.a,challengeA.id).startedAt===challengeA.startedAt,'started_at persisted');
 await wait(1100);
 check((await call('/api/challenges/start',a2,'POST')).body.assignedChallenge.startedAt===challengeA.startedAt,'Start again (second tab) keeps started_at');
 check((await call('/api/challenges/next',a1,'POST')).body.assignedChallenge.startedAt===challengeA.startedAt,'Next while unsolved keeps started_at');
 check((await call('/api/dashboard',a1)).body.assignedChallenge.startedAt===challengeA.startedAt,'Refresh keeps started_at');
 for(const cookie of [a1,a2,a1]){const page=await request('/challenges/'+challengeA.id,cookie);check(page.status===200&&(await page.text()).includes(String(challengeA.startedAt)),'Opening the challenge page renders the persisted started_at');}
 await request('/api/auth/logout',a1,'POST');const a3=await login(users.a);
 check((await call('/api/dashboard',a3)).body.assignedChallenge.startedAt===challengeA.startedAt,'Logout/login keeps started_at');
 check(row(users.a,challengeA.id).startedAt===challengeA.startedAt,'DB started_at unchanged after all of the above');

 // ---- Invalid and unassigned challenges.
 const otherStarting=challengeA.id==='WEB-101'?'WEB-102':'WEB-101';
 r=await submit(a3,'NOPE-999','DDC{x}');check(r.status===400&&r.body.message==='Invalid challenge ID.','Invalid challenge rejected');
 await wait(2100);r=await submit(a3,otherStarting,flags[otherStarting]);check(r.status===403&&r.body.message==='This challenge is not assigned to you.','Unassigned challenge rejected, even with its correct flag');

 // ---- Correct solve: simulate 15 minutes on the challenge, then check solved_at, duration and points.
 sql(`UPDATE participant_challenges SET started_at=started_at-900000,assigned_at=assigned_at-900000 WHERE user_id=${q(users.a)} AND challenge_id=${q(challengeA.id)};`);
 const startedA=row(users.a,challengeA.id).startedAt;
 await wait(2100);r=await submit(a3,challengeA.id,'DDC{definitely-wrong}');check(r.status===200&&!r.body.correct&&row(users.a,challengeA.id).solvedAt===null,'Wrong flag does not solve');
 await wait(2100);
 const t0=Date.now();r=await submit(a3,challengeA.id,flags[challengeA.id]);const t1=Date.now();
 const solvedA=row(users.a,challengeA.id),cfgA=config(challengeA.id);
 check(r.status===200&&r.body.correct&&r.body.message==='Flag accepted.','Correct flag accepted');
 check(solvedA.solvedAt>=t0&&solvedA.solvedAt<=t1&&r.body.solvedAt===solvedA.solvedAt,'solved_at is server receipt time');
 check(solvedA.durationSeconds===Math.floor((solvedA.solvedAt-startedA)/1000)&&solvedA.durationSeconds>=900&&solvedA.durationSeconds<960,'duration_seconds = solved_at - started_at (~15 min)');
 check(solvedA.awardedPoints===calculateChallengeScore(cfgA,solvedA.durationSeconds)&&r.body.awardedPoints===solvedA.awardedPoints,'awarded_points persisted from the formula');
 check(solvedA.awardedPoints<cfgA.maxPoints&&solvedA.awardedPoints>cfgA.minPoints,`15 min of a ${cfgA.decayMinutes} min window lands between min and max (${solvedA.awardedPoints})`);
 let entries=ledger(users.a);check(entries.length===1&&entries[0].kind==='SOLVE'&&entries[0].points===solvedA.awardedPoints&&entries[0].createdAt===solvedA.solvedAt,'One SOLVE ledger entry');

 // ---- Duplicate correct submissions change nothing.
 await wait(2100);r=await submit(a3,challengeA.id,flags[challengeA.id]);
 check(r.status===200&&r.body.alreadySolved&&r.body.awardedPoints===undefined,'Duplicate correct submission is a no-op');
 const dupe=row(users.a,challengeA.id);
 check(dupe.solvedAt===solvedA.solvedAt&&dupe.durationSeconds===solvedA.durationSeconds&&dupe.awardedPoints===solvedA.awardedPoints&&dupe.startedAt===startedA,'Duplicate keeps started_at, solved_at, duration, points');
 check(ledger(users.a).length===1,'Duplicate adds no ledger points');
 assert.throws(()=>sql(`INSERT INTO score_events(id,user_id,challenge_id,kind,points,created_at) VALUES(${q(randomUUID())},${q(users.a)},${q(challengeA.id)},'SOLVE',1,1);`));check(true,'Database rejects a second SOLVE for the same challenge');
 dash=await call('/api/dashboard',a3);check(dash.body.score===solvedA.awardedPoints&&typeof dash.body.rank==='number'&&dash.body.solves===1,'Dashboard score/rank from persisted points');
 check(dash.body.completedChallenges[0].awardedPoints===solvedA.awardedPoints&&dash.body.completedChallenges[0].durationSeconds===solvedA.durationSeconds,'Assignment exposes awarded points and duration');

 // ---- Simultaneous correct submissions from two sessions: exactly one solve, one ledger row.
 const b1=await login(users.b),b2=await login(users.b);
 const challengeB=(await call('/api/challenges/start',b1,'POST')).body.assignedChallenge;
 const burst=await Promise.all([b1,b2,b1,b2,b1].map(cookie=>submit(cookie,challengeB.id,flags[challengeB.id])));
 check(burst.filter(x=>x.status===200&&x.body.correct&&!x.body.alreadySolved).length===1,'Simultaneous correct submissions award once');
 check(ledger(users.b).length===1&&row(users.b,challengeB.id).awardedPoints===ledger(users.b)[0].points,'One ledger row after the burst');
 const fastB=row(users.b,challengeB.id);check(fastB.awardedPoints===config(challengeB.id).maxPoints&&fastB.durationSeconds<60,'Near-instant solve earns max points');

 // ---- Event end: started while LIVE, submitted after end → rejected. Submitted just before end → accepted.
 const c1=await login(users.c);
 const challengeC=(await call('/api/challenges/start',c1,'POST')).body.assignedChallenge;
 setEventWindow(Date.now()-3_600_000,Date.now()-1);
 r=await submit(c1,challengeC.id,flags[challengeC.id]);check(r.status===403&&r.body.code==='EVENT_ENDED','Started while LIVE, submitted after end → EVENT_ENDED');
 check(row(users.c,challengeC.id).solvedAt===null&&ledger(users.c).length===0,'Post-end submission persists nothing');
 for(const path of ['/api/challenges/start','/api/challenges/next']){const x=await call(path,c1,'POST');check(x.status===403&&x.body.code==='EVENT_ENDED',path+' after end → EVENT_ENDED');}
 check((await call('/api/dashboard',c1)).body.event.state==='ENDED','Dashboard still available after end');
 const finalBoard=await call('/api/leaderboard',c1);check(finalBoard.status===200&&finalBoard.body.event.state==='ENDED'&&finalBoard.body.leaderboard.some(e=>e.participantId===run+'-P0'),'Leaderboard visible after end');
 setEventWindow(Date.now()-3_600_000,Date.now()+3_000);
 r=await submit(c1,challengeC.id,flags[challengeC.id]);const endC=readEventWindow().endsAt;
 check(r.status===200&&r.body.correct&&row(users.c,challengeC.id).solvedAt<endC,'Submission received just before end is accepted');
 await wait(3_200);
 r=await submit(c1,challengeC.id,flags[challengeC.id]);check(r.status===403&&r.body.code==='EVENT_ENDED','Same request after end is rejected');

 // ---- Leaderboard: totals, solve counts, ranking and deterministic tie-breaks (fixture ledger rows).
 const T=1_900_000_000_000,big=100_000;
 const fixture={// [solves as [challenge, points, at]], hints
  [board[0]]:[[['WEB-101',big/2,T+100],['WEB-102',big/2,T+90]],[-10]],//500 pts -10 hint, 2 solves
  [board[1]]:[[['WEB-101',big/2,T+10],['WEB-102',big/4,T+20],['FORENSICS-103',big/4,T+200]],[]],//3 solves
  [board[2]]:[[['WEB-101',big/2,T+50],['WEB-102',big/2,T+40]],[]],//2 solves, earlier final solve
  [board[3]]:[[['WEB-101',big/2,T+50],['WEB-102',big/2,T+30]],[]],//identical to l3 → participant ID decides
  [board[4]]:[[['CRYPTO-104',big+5,T+999]],[]],//highest score, single solve
 };
 sql(Object.entries(fixture).map(([user,[solves,hints]])=>solves.map(([c,p,at])=>`INSERT INTO score_events(id,user_id,challenge_id,kind,points,created_at) VALUES(${q(randomUUID())},${q(user)},${q(c)},'SOLVE',${p},${at});`).join('')+hints.map(p=>`INSERT INTO score_events(id,user_id,challenge_id,kind,points,created_at) VALUES(${q(randomUUID())},${q(user)},'WEB-101','HINT',${p},${T});`).join('')).join(''));
 live();
 const lb=(await call('/api/leaderboard',c1)).body.leaderboard;
 check(lb.every((e,i)=>e.rank===i+1)&&!JSON.stringify(lb).includes('"userId"'),'Ranks are contiguous; internal IDs not exposed');
 const pos=id=>lb.findIndex(e=>e.participantId===run+'-P'+all.indexOf(id));
 const get=id=>lb[pos(id)];
 check(get(board[0]).score===big-10&&get(board[0]).solved===2,'Totals include future HINT penalties; hints are not solves');
 check(get(board[1]).score===big&&get(board[1]).solved===3,'Solve count and total');
 check(pos(board[4])<pos(board[1])&&pos(board[1])<pos(board[2])&&pos(board[2])<pos(board[3])&&pos(board[3])<pos(board[0]),'Order: score, then solves, then earliest final solve, then participant ID');
 check(get(users.a).score===solvedA.awardedPoints&&get(users.a).solved===1,'Real solve reflected on the leaderboard');
 check(lb.find(e=>e.isYou)?.participantId===run+'-P2','Caller row flagged');

 // ---- Browser: full participant path and event UI states.
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'file:///C:/Users/rithv/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
 browser=await chromium.launch({channel:'msedge',headless:true});
 page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const d=run+'-d';all.push(d);
 sql(`INSERT INTO users(id,username,email,password_hash,display_name,participant_id,role,created_at) VALUES(${[d,d,d+'@example.test',hash,'Score QA D',run+'-PD','participant'].map(q).join(',')},${Date.now()});`);
 await page.goto(base+'/login');await page.locator('input[name="username"]').fill(d);await page.locator('input[name="password"]').fill(password);await page.locator('button[type="submit"]').click();await page.waitForURL('**/dashboard');
 await page.locator('.arena-event-window .arena-clock[data-event-state="LIVE"]').waitFor();
 check((await page.locator('.arena-event-window').innerText()).includes('remaining'),'Dashboard shows LIVE with time remaining');
 await page.getByRole('button',{name:'START CHALLENGE',exact:true}).click();await page.waitForURL(/\/challenges\/(WEB-101|WEB-102)$/);
 const challengeD=decodeURIComponent(new URL(page.url()).pathname.split('/').pop());
 const timing=page.locator('[data-challenge-timing="IN PROGRESS"]');await timing.waitFor();
 const startedD=row(d,challengeD).startedAt;check(Number(await timing.getAttribute('data-started-at'))===startedD,'Challenge page shows persisted started_at');
 await wait(2_000);await page.reload();await timing.waitFor();
 check(Number(await timing.getAttribute('data-started-at'))===startedD&&row(d,challengeD).startedAt===startedD,'Reload leaves the challenge timer unchanged');
 check(/elapsed\s*\d+s/i.test(await timing.innerText()),'Elapsed timer shown');
 await page.goto(base+'/submissions?challenge='+challengeD);await page.getByLabel('Flag',{exact:true}).fill(flags[challengeD]);
 await page.getByRole('button',{name:'SUBMIT FLAG →',exact:true}).click();await page.getByText('Flag accepted.',{exact:true}).waitFor();
 const solvedD=row(d,challengeD);
 check(solvedD.solvedAt!==null&&solvedD.durationSeconds===Math.floor((solvedD.solvedAt-startedD)/1000)&&solvedD.awardedPoints===calculateChallengeScore(config(challengeD),solvedD.durationSeconds),'UI solve persisted solved_at, duration and points');
 check((await page.locator('[data-awarded-points]').innerText()).includes(`+${solvedD.awardedPoints} PTS`),'Submission shows awarded points');
 await page.goto(base+'/challenges/'+challengeD);await page.locator('[data-challenge-timing="SOLVED"]').waitFor();
 check((await page.locator('[data-challenge-timing="SOLVED"]').innerText()).includes(`${solvedD.awardedPoints} pts`),'Challenge page shows awarded points');
 await page.goto(base+'/leaderboard');const myRow=page.locator(`[data-leaderboard-row="${run}-PD"]`);await myRow.waitFor();
 check((await myRow.innerText()).includes(String(solvedD.awardedPoints))&&await myRow.getAttribute('aria-current')==='true','Leaderboard immediately reflects the new score');
 await page.goto(base+'/challenges');await page.locator('[data-challenge-timing="NOT STARTED"]').first().waitFor();check((await page.locator('[data-challenge-timing="NOT STARTED"]').first().innerText()).includes('PTS'),'Catalogue shows NOT STARTED with points');
 await page.goto(base+'/dashboard');await page.locator('.arena-stats').waitFor();
 check((await page.locator('.arena-stats').innerText()).includes(String(solvedD.awardedPoints)),'Dashboard score stat from persisted points');
 mkdirSync('outputs',{recursive:true});await page.screenshot({path:'outputs/scoring-dashboard.png',fullPage:true});
 await page.goto(base+'/leaderboard');await myRow.waitFor();await page.screenshot({path:'outputs/scoring-leaderboard.png',fullPage:true});
 await page.goto(base+'/challenges/'+challengeD);await page.locator('[data-challenge-timing="SOLVED"]').waitFor();await page.screenshot({path:'outputs/scoring-challenge-solved.png'});
 setEventWindow(Date.now()+5_400_000,Date.now()+9_000_000);
 await page.goto(base+'/dashboard');await page.locator('.arena-event-window .arena-clock[data-event-state="UPCOMING"]').waitFor();
 check(/EVENT STARTS IN\s*0?1:2\d:\d\d/.test(await page.locator('.arena-event-window').innerText()),'Upcoming countdown shown');
 setEventWindow(Date.now()-9_000_000,Date.now()-1_000);
 await page.goto(base+'/dashboard');await page.locator('.arena-event-window .arena-clock[data-event-state="ENDED"]').waitFor();
 check((await page.locator('.arena-event-window').innerText()).includes('Final standings'),'Ended state shows final standings');
 await page.goto(base+'/leaderboard');await page.getByRole('heading',{name:'FINAL STANDINGS'}).waitFor();check(true,'Leaderboard labelled final after end');
 check(errors.length===0,'No browser runtime errors: '+errors.join('; '));
 console.log(JSON.stringify({passed:checks,awarded:{a:{challenge:challengeA.id,...solvedA},d:{challenge:challengeD,...solvedD}}}));
}catch(error){
 await page?.screenshot({path:'outputs/scoring-failure.png',fullPage:true}).catch(()=>{});throw error;
}finally{
 await browser?.close();
 setEventWindow(previous.startsAt,previous.endsAt);
 sql(all.map(id=>`DELETE FROM score_events WHERE user_id=${q(id)};DELETE FROM submissions WHERE user_id=${q(id)};DELETE FROM submission_limits WHERE user_id=${q(id)};DELETE FROM web101_progress WHERE user_id=${q(id)};DELETE FROM web102_progress WHERE user_id=${q(id)};DELETE FROM sessions WHERE user_id=${q(id)};DELETE FROM participant_challenges WHERE user_id=${q(id)};DELETE FROM users WHERE id=${q(id)};DELETE FROM auth_limits WHERE key=${q('account:'+createHash('sha256').update(id).digest('hex'))};`).join(''));
}
