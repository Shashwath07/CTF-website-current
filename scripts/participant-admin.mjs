import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { quote, migrateLocalDatabase, executeLocalSql, createLocalParticipant, queryLocal } from './local-participants.mjs';
const command=process.argv[2];
const ist=at=>at===null?'not set (LIVE with no end)':new Date(at).toLocaleString('en-GB',{timeZone:'Asia/Kolkata',dateStyle:'medium',timeStyle:'short'})+' IST';
function showEvent(){
 const [row]=queryLocal('SELECT event_start_at AS startsAt,event_end_at AS endsAt,timezone FROM event_config WHERE id=1;');
 if(!row)throw new Error('event_config missing: run npm run db:migrate:local');
 const now=Date.now(),state=now<row.startsAt?'UPCOMING':row.endsAt!==null&&now>=row.endsAt?'ENDED':'LIVE';
 console.log(`Local event window (${row.timezone})\n  start: ${ist(row.startsAt)}\n  end:   ${ist(row.endsAt)}\n  state: ${state}`);
}
if(command==='migrate') {migrateLocalDatabase();}
else if(command==='show-event') {showEvent();}
else if(command==='set-event') {
 // Times are ISO 8601 with an explicit offset, e.g. 2026-10-12T10:00:00+05:30. --live <hours> opens a window starting now.
 const {values}=parseArgs({args:process.argv.slice(3),options:{start:{type:'string'},end:{type:'string'},live:{type:'string'}}});
 const parse=(value,label)=>{if(!/(Z|[+-]\d\d:\d\d)$/.test(value))throw new Error(label+' needs an explicit UTC offset, e.g. +05:30');const at=Date.parse(value);if(!Number.isFinite(at))throw new Error('Invalid '+label);return at;};
 let start,end;
 if(values.live!==undefined){const hours=Number(values.live);if(!(hours>0))throw new Error('--live expects a positive number of hours');start=Date.now();end=start+Math.round(hours*3600000);}
 else{
  if(!values.start)throw new Error('Use --start <ISO time> [--end <ISO time>|none], or --live <hours>.');
  start=parse(values.start,'--start');end=values.end===undefined||values.end==='none'?null:parse(values.end,'--end');
 }
 if(end!==null&&end<=start)throw new Error('End must be after start');
 executeLocalSql(`UPDATE event_config SET event_start_at=${start},event_end_at=${end??'NULL'},updated_at=${Date.now()} WHERE id=1;`,{quiet:true});
 showEvent();
}
else {
 if(!['create-user','add-challenge'].includes(command))throw new Error('Use migrate, create-user, add-challenge, show-event or set-event. JSON input is read from stdin; only the local database is modified.');
 const data=JSON.parse(readFileSync(0,'utf8'));
 if(command==='create-user') {
  await createLocalParticipant(data);
 } else {
  for(const key of ['id','challengeCode','title','category','difficulty','description'])if(typeof data[key]!=='string'||!data[key].trim())throw new Error('Missing '+key);
  if(!/^[a-z0-9-]+$/.test(data.id)||!['WEB','CRYPTO','PWN','REVERSE','FORENSICS','OSINT'].includes(data.category))throw new Error('Invalid challenge id/category');
  // Optional scoring; omitted values use the schema defaults (100 / 50 / 60 minutes).
  const scoring={maxPoints:data.maxPoints??100,minPoints:data.minPoints??50,decayMinutes:data.decayMinutes??60};
  if(!Object.values(scoring).every(Number.isInteger)||scoring.maxPoints<=0||scoring.minPoints<0||scoring.minPoints>scoring.maxPoints||scoring.decayMinutes<=0)throw new Error('Invalid maxPoints/minPoints/decayMinutes');
  executeLocalSql(`INSERT INTO challenges(id,challenge_code,title,category,difficulty,description,active,starting,max_points,min_points,decay_minutes) VALUES(${['id','challengeCode','title','category','difficulty','description'].map(k=>quote(data[k])).join(',')},${data.active===true?1:0},${data.starting===true?1:0},${scoring.maxPoints},${scoring.minPoints},${scoring.decayMinutes});`);
 }
}
