// Local-only helpers for integration tests that need a specific global event window.
// Every test that opens or moves the window restores the previous one in its finally block.
import { queryLocal, executeLocalSql } from '../scripts/local-participants.mjs';

export function readEventWindow() {
 const [row]=queryLocal('SELECT event_start_at AS startsAt,event_end_at AS endsAt FROM event_config WHERE id=1;');
 if(!row)throw new Error('event_config missing: run npm run db:migrate:local');
 return row;
}

export function setEventWindow(startsAt,endsAt) {
 executeLocalSql(`UPDATE event_config SET event_start_at=${Math.round(startsAt)},event_end_at=${endsAt===null?'NULL':Math.round(endsAt)},updated_at=${Date.now()} WHERE id=1;`,{quiet:true});
}

// Opens a LIVE window around now and returns a function that restores the previous window.
export function openEventWindow(hours=6) {
 const previous=readEventWindow();
 setEventWindow(Date.now()-60_000,Date.now()+hours*3_600_000);
 return ()=>setEventWindow(previous.startsAt,previous.endsAt);
}
