/**
 * Business-hours SLA arithmetic matching backend/app/sla.py:
 * - Asia/Tehran local time
 * - Saturday..Wednesday (JS getDay(): 6, 0, 1, 2, 3), 09:00..17:00
 * - All 26 official 1405 public holidays excluded
 */

const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 17;
const SECONDS_PER_BUSINESS_DAY = (BUSINESS_END_HOUR - BUSINESS_START_HOUR) * 3600;
const MS_PER_DAY = 86_400_000;
const TEHRAN_STANDARD_OFFSET_MIN = 210; // UTC+03:30 (fixed year-round since 2023)

// Saturday=6, Sunday=0, Monday=1, Tuesday=2, Wednesday=3 (Thursday=4, Friday=5 off)
const BUSINESS_WEEKDAYS = new Set<number>([6, 0, 1, 2, 3]);

// Official 1405 public holidays from README.md converted to Gregorian YYYY-MM-DD in Asia/Tehran
export const PUBLIC_HOLIDAYS: ReadonlySet<string> = new Set([
  '2026-03-21', // 1405/01/01
  '2026-03-22', // 1405/01/02
  '2026-03-23', // 1405/01/03
  '2026-03-24', // 1405/01/04
  '2026-04-01', // 1405/01/12
  '2026-04-02', // 1405/01/13
  '2026-04-14', // 1405/01/25
  '2026-05-28', // 1405/03/07
  '2026-06-04', // 1405/03/14
  '2026-06-05', // 1405/03/15
  '2026-06-26', // 1405/04/05
  '2026-06-27', // 1405/04/06
  '2026-08-06', // 1405/05/15
  '2026-08-14', // 1405/05/23
  '2026-08-16', // 1405/05/25
  '2026-08-23', // 1405/06/01
  '2026-09-01', // 1405/06/10
  '2026-11-15', // 1405/08/24
  '2026-12-24', // 1405/10/03
  '2027-01-07', // 1405/10/17
  '2027-01-25', // 1405/11/05
  '2027-02-11', // 1405/11/22
  '2027-03-01', // 1405/12/10
  '2027-03-11', // 1405/12/20
  '2027-03-12', // 1405/12/21
  '2027-03-20', // 1405/12/29
]);

const YEAR_2023_UTC_MS = Date.UTC(2023, 0, 1, 0, 0, 0);

const tehranFormatter =
  typeof Intl !== 'undefined'
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tehran',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      })
    : null;

interface TehranParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayIndex: number; // floor(UTC date / 86400s) for Tehran calendar day
  weekday: number; // 0=Sun..6=Sat
  dateKey: string;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function makeDateKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function toTehranParts(utcMs: number): TehranParts {
  if (utcMs >= YEAR_2023_UTC_MS || !tehranFormatter) {
    const shifted = new Date(utcMs + TEHRAN_STANDARD_OFFSET_MIN * 60_000);
    const year = shifted.getUTCFullYear();
    const month = shifted.getUTCMonth() + 1;
    const day = shifted.getUTCDate();
    return {
      year,
      month,
      day,
      hour: shifted.getUTCHours(),
      minute: shifted.getUTCMinutes(),
      second: shifted.getUTCSeconds(),
      dayIndex: Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY),
      weekday: shifted.getUTCDay(),
      dateKey: makeDateKey(year, month, day),
    };
  }

  const parts = tehranFormatter.formatToParts(new Date(utcMs));
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = Number(p.value);
  }
  const year = map.year;
  const month = map.month;
  const day = map.day;
  const utcDay = new Date(Date.UTC(year, month - 1, day));
  return {
    year,
    month,
    day,
    hour: map.hour === 24 ? 0 : map.hour,
    minute: map.minute,
    second: map.second,
    dayIndex: Math.floor(utcDay.getTime() / MS_PER_DAY),
    weekday: utcDay.getUTCDay(),
    dateKey: makeDateKey(year, month, day),
  };
}

function dayIndexToWeekday(dayIndex: number): number {
  // 1970-01-01 (dayIndex 0) was Thursday (4)
  return (((4 + dayIndex) % 7) + 7) % 7;
}

function dayIndexToDateKey(dayIndex: number): string {
  const d = new Date(dayIndex * MS_PER_DAY);
  return makeDateKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function isBusinessDayIndex(dayIndex: number): boolean {
  const weekday = dayIndexToWeekday(dayIndex);
  if (!BUSINESS_WEEKDAYS.has(weekday)) return false;
  return !PUBLIC_HOLIDAYS.has(dayIndexToDateKey(dayIndex));
}

function secondsIntoDay(p: TehranParts): number {
  return p.hour * 3600 + p.minute * 60 + p.second;
}

export function businessSecondsBetween(startMs: number, endMs: number): number {
  if (endMs <= startMs || Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return 0;
  }

  const start = toTehranParts(startMs);
  const end = toTehranParts(endMs);
  const openSec = BUSINESS_START_HOUR * 3600;
  const closeSec = BUSINESS_END_HOUR * 3600;

  if (start.dayIndex === end.dayIndex) {
    if (!isBusinessDayIndex(start.dayIndex)) return 0;
    const lo = Math.max(openSec, secondsIntoDay(start));
    const hi = Math.min(closeSec, secondsIntoDay(end));
    return Math.max(0, hi - lo);
  }

  let totalSeconds = 0;

  if (isBusinessDayIndex(start.dayIndex)) {
    const lo = Math.max(openSec, secondsIntoDay(start));
    if (closeSec > lo) totalSeconds += closeSec - lo;
  }

  const fullDays = end.dayIndex - start.dayIndex - 1;
  if (fullDays > 0) {
    const firstMid = start.dayIndex + 1;
    const lastMid = end.dayIndex - 1;
    const fullWeeks = Math.floor(fullDays / 7);
    const rem = fullDays % 7;
    let bizDays = fullWeeks * BUSINESS_WEEKDAYS.size;
    const startWd = dayIndexToWeekday(firstMid);
    for (let i = 0; i < rem; i++) {
      if (BUSINESS_WEEKDAYS.has((startWd + i) % 7)) bizDays += 1;
    }
    const firstKey = dayIndexToDateKey(firstMid);
    const lastKey = dayIndexToDateKey(lastMid);
    for (const holiday of PUBLIC_HOLIDAYS) {
      if (holiday >= firstKey && holiday <= lastKey) {
        const [hy, hm, hd] = holiday.split('-').map(Number);
        const hWd = new Date(Date.UTC(hy, hm - 1, hd)).getUTCDay();
        if (BUSINESS_WEEKDAYS.has(hWd)) bizDays -= 1;
      }
    }
    totalSeconds += bizDays * SECONDS_PER_BUSINESS_DAY;
  }

  if (isBusinessDayIndex(end.dayIndex)) {
    const hi = Math.min(closeSec, secondsIntoDay(end));
    if (hi > openSec) totalSeconds += hi - openSec;
  }

  return totalSeconds;
}

export function businessMinutesLeft(
  receivedAtIso: string,
  nowMs: number,
  slaMinutes = 120,
): number {
  const startMs = Date.parse(receivedAtIso);
  if (Number.isNaN(startMs) || Number.isNaN(nowMs)) return 0;
  const elapsedSeconds = businessSecondsBetween(startMs, nowMs);
  const remainingSeconds = slaMinutes * 60 - elapsedSeconds;
  if (remainingSeconds > 0) {
    return Math.ceil(remainingSeconds / 60);
  }
  return Math.floor(remainingSeconds / 60);
}
