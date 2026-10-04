"use client";
import { useEffect, useState } from "react";
// Display clock anchored to the server's timestamp so a skewed device clock cannot misreport
// countdowns or elapsed time. The first render uses serverNow exactly, so SSR and hydration match.
// Purely cosmetic: the backend re-checks every action against its own time.
export function useServerNow(serverNow: number) {
 const [now,setNow]=useState(serverNow);
 useEffect(()=>{
  const offset=serverNow-Date.now();
  const tick=()=>setNow(Date.now()+offset);
  const timer=setInterval(()=>{if(!document.hidden)tick();},1000);
  document.addEventListener('visibilitychange',tick);
  return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',tick);};
 },[serverNow]);
 return now;
}
