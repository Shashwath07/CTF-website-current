// Pure scoring/event-clock rules. Run: npm run test:scoring (no server or database needed).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateChallengeScore,getChallengeElapsed,getEventState,isEventLive} from '../lib/scoring.ts';
let checks=0;const check=(value,label)=>{assert.ok(value,label);checks++;};
const min=m=>m*60;

// Worked example from the spec: 200 → 100 over 60 minutes.
const example={maxPoints:200,minPoints:100,decayMinutes:60};
for(const [minutes,points] of [[0,200],[15,175],[30,150],[45,125],[60,100],[90,100],[600,100]])
 check(calculateChallengeScore(example,min(minutes))===points,`${minutes} min → ${points}`);

// 0/25/50/75/100/>100% of every seeded challenge's decay window, read from the migration itself.
const migration=readFileSync(new URL('../db/migrations/0010_timed_scoring.sql',import.meta.url),'utf8');
const seeded=[...migration.matchAll(/max_points=(\d+),min_points=(\d+),decay_minutes=(\d+) WHERE id='([^']+)'/g)].map(([,max,mn,decay,id])=>({id,maxPoints:+max,minPoints:+mn,decayMinutes:+decay}));
check(seeded.length===5,'All five existing challenges have seeded scoring');
check(new Set(seeded.map(c=>c.maxPoints)).size===seeded.length,'Seeded max points are not all the same');
for(const c of seeded){
 const span=c.maxPoints-c.minPoints;
 check(c.minPoints>0&&c.minPoints<c.maxPoints&&Math.abs(c.minPoints-c.maxPoints/2)<=5,c.id+' min ≈ 50% of max');
 for(const [fraction,expected] of [[0,c.maxPoints],[.25,c.maxPoints-span*.25],[.5,c.maxPoints-span*.5],[.75,c.maxPoints-span*.75],[1,c.minPoints],[1.5,c.minPoints],[10,c.minPoints]])
  check(calculateChallengeScore(c,min(c.decayMinutes*fraction))===Math.round(expected),`${c.id} at ${fraction*100}% of decay`);
}

// Clamping and defensive inputs.
check(calculateChallengeScore(example,-500)===200,'Negative duration (clock skew) never exceeds max');
check(calculateChallengeScore(example,Number.NaN)===100,'Unknown duration falls to min, never above');
check(calculateChallengeScore({maxPoints:100,minPoints:150,decayMinutes:30},0)===100,'min above max is clamped to max');
check(calculateChallengeScore({maxPoints:100,minPoints:-20,decayMinutes:30},min(60))===0,'Never negative');
check(calculateChallengeScore({maxPoints:100,minPoints:50,decayMinutes:0},0)===50,'Zero decay window awards min');
check(calculateChallengeScore(example,min(7.5))===188,'Rounds to an integer (187.5 → 188)');
check(Number.isInteger(calculateChallengeScore(example,1234)),'Integer result');

// Individual challenge clock.
check(getChallengeElapsed(1_000,1_000+min(25)*1000)===1500,'25 minutes elapsed');
check(getChallengeElapsed(5_000,4_000)===0,'Start after now clamps to 0');
check(getChallengeElapsed(1_000,2_999)===1,'Whole seconds (floor)');
check(getChallengeElapsed(null,5_000)===null&&getChallengeElapsed(undefined,5_000)===null,'Missing start time detected');

// Global event clock: start inclusive, end exclusive, null end means open-ended.
const event={startsAt:1_000,endsAt:2_000};
check(getEventState(event,999)==='UPCOMING','Before start');
check(getEventState(event,1_000)==='LIVE'&&isEventLive(event,1_000),'At start');
check(getEventState(event,1_999)==='LIVE','Immediately before end');
check(getEventState(event,2_000)==='ENDED'&&!isEventLive(event,2_000),'At end');
check(getEventState(event,9_999)==='ENDED','After end');
check(getEventState({startsAt:1_000,endsAt:null},9e15)==='LIVE','No configured end stays LIVE');

// The event clock must never feed the score: same duration, wildly different event times, same points.
check(calculateChallengeScore(example,getChallengeElapsed(10_000,10_000+min(15)*1000))===calculateChallengeScore(example,getChallengeElapsed(9_000_000,9_000_000+min(15)*1000)),'Score independent of when in the event the challenge started');

console.log(JSON.stringify({passed:checks,seeded}));
