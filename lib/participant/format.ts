// Display-only formatting. Values are UTC epoch milliseconds rendered in the event's timezone
// (Asia/Kolkata), so server and client output match regardless of the viewer's locale.
export const EVENT_TIMEZONE = "Asia/Kolkata";

export function formatEventDate(at: number, timeZone = EVENT_TIMEZONE) {
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone }).format(at);
  return `${day} • ${formatClockTime(at, timeZone)}`;
}

export function formatClockTime(at: number, timeZone = EVENT_TIMEZONE) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone }).format(at);
}

// Countdown as HH:MM:SS, prefixed with whole days when longer than 24 hours.
export function formatCountdown(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(s / 86400), pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(Math.floor(s / 3600) % 24)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  return days ? `${days}D ${clock}` : clock;
}

// Human duration such as "18m 31s" or "1h 05m 12s".
export function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sec = s % 60;
  if (h) return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  return m ? `${m}m ${String(sec).padStart(2, "0")}s` : `${sec}s`;
}
