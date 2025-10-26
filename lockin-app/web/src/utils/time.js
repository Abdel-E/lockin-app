// Local-time helpers to avoid UTC/ISO shifts

// Build a local Date from parts (no Z conversion)
export function dateLocal(year, monthIndex, day, hour = 0, minute = 0) {
  return new Date(year, monthIndex, day, hour, minute, 0, 0);
}

// Parse "9:00 - 11:00", "12:00-1:00 pm" etc. Returns minutes from midnight.
export function parseTimeRangeToMinutes(text) {
  const cleaned = String(text)
    .toLowerCase()
    .replace(/[–—−]/g, '-')       // normalize dashes
    .replace(/\s+/g, ' ')
    .replace(/l(?=\d)/g, '1');    // common OCR l->1

  const m = cleaned.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;

  const [ , h1, mm1 = '0', ap1, h2, mm2 = '0', ap2 ] = m;

  function to24(h, mm, ap, isEnd = false) {
    let hour = parseInt(h, 10) % 24;
    const min = parseInt(mm, 10) % 60;
    if (ap) {
      const pm = ap.toLowerCase() === 'pm';
      if (hour === 12) hour = pm ? 12 : 0;
      else if (pm) hour += 12;
    } else {
      // No AM/PM: assume campus-day times; push small hours to PM
      if (hour <= 6) hour += 12;
      if (isEnd && hour <= 6) hour += 12;
    }
    return hour * 60 + min;
  }

  let startM = to24(h1, mm1, ap1, false);
  let endM = to24(h2, mm2, ap2, true);
  if (endM <= startM && !ap2 && ap1 !== 'pm') endM += 12 * 60;

  return { startM, endM };
}

// Weekday label -> Date.getDay() index
export const WEEKDAY_INDEX = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

// Given a local weekStart Date (00:00) and weekday index/minutes, return a local Date
export function toLocalDateTime(weekStart, weekdayIndex, minutesFromMidnight) {
  const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate(), 0, 0, 0, 0);
  const curr = d.getDay();
  const delta = (weekdayIndex - curr + 7) % 7;
  d.setDate(d.getDate() + delta);
  d.setMinutes(minutesFromMidnight);
  return d;
}