import {
  PUBLIC_HOLIDAYS,
  isBusinessDayIndex,
  businessSecondsBetween,
  businessMinutesLeft,
} from './sla';

describe('Tehran business-hours SLA calculations', () => {
  it('contains all 26 official 1405 public holidays', () => {
    expect(PUBLIC_HOLIDAYS.size).toBe(26);
    expect(PUBLIC_HOLIDAYS.has('2026-03-21')).toBe(true); // 1405/01/01
    expect(PUBLIC_HOLIDAYS.has('2026-08-23')).toBe(true); // 1405/06/01
    expect(PUBLIC_HOLIDAYS.has('2027-03-20')).toBe(true); // 1405/12/29
  });

  it('uses Saturday-Wednesday as business days and skips Thursday/Friday', () => {
    const dayIdx = (isoDate: string) => Math.floor(Date.parse(`${isoDate}T00:00:00Z`) / 86_400_000);
    expect(isBusinessDayIndex(dayIdx('2026-04-18'))).toBe(true);  // Sat
    expect(isBusinessDayIndex(dayIdx('2026-04-19'))).toBe(true);  // Sun
    expect(isBusinessDayIndex(dayIdx('2026-04-20'))).toBe(true);  // Mon
    expect(isBusinessDayIndex(dayIdx('2026-04-21'))).toBe(true);  // Tue
    expect(isBusinessDayIndex(dayIdx('2026-04-22'))).toBe(true);  // Wed
    expect(isBusinessDayIndex(dayIdx('2026-04-23'))).toBe(false); // Thu
    expect(isBusinessDayIndex(dayIdx('2026-04-24'))).toBe(false); // Fri
  });

  it('counts Tehran 09:00-17:00 business hours accurately (UTC+03:30 = 05:30-13:30 UTC)', () => {
    // 2026-04-19 is Sunday (normal business day, not a holiday)
    const start = Date.parse('2026-04-19T05:30:00Z'); // 09:00 Tehran
    const twoHoursLater = Date.parse('2026-04-19T07:30:00Z'); // 11:00 Tehran
    expect(businessSecondsBetween(start, twoHoursLater)).toBe(7200);
  });

  it('skips Thursday/Friday weekends and counts Saturday/Sunday normally', () => {
    // 2026-04-15 Wed 16:00 Tehran (12:30 UTC) -> 2026-04-18 Sat 10:00 Tehran (06:30 UTC)
    // Should only count Wed 16:00-17:00 (1h) + Sat 09:00-10:00 (1h) = 2h
    const start = '2026-04-15T12:30:00Z';
    const atOneHour59 = Date.parse('2026-04-18T06:29:00Z');
    const atExactTwoHours = Date.parse('2026-04-18T06:30:00Z');
    const atOneMinOver = Date.parse('2026-04-18T06:31:00Z');

    expect(businessMinutesLeft(start, atOneHour59)).toBe(1);
    expect(businessMinutesLeft(start, atExactTwoHours)).toBe(0);
    expect(businessMinutesLeft(start, atOneMinOver)).toBe(-1);
  });

  it('skips consecutive Nowruz holidays (1405/01/01-01/04) and single holiday (1405/06/01)', () => {
    // Received on 1405/01/01 (2026-03-21 Sat) morning, evaluated on 1405/01/05 (2026-03-25 Wed) at 10:00 Tehran (06:30 UTC)
    // 01/01..01/04 are holidays -> only 1h elapsed on Wed 09:00-10:00 => 60 minutes left
    const nowruzReceived = '2026-03-21T06:00:00Z';
    const mar25_1000Tehran = Date.parse('2026-03-25T06:30:00Z');
    expect(businessMinutesLeft(nowruzReceived, mar25_1000Tehran)).toBe(60);

    // 1405/06/01 is Sunday 2026-08-23 (holiday). Received 2026-08-22 Sat 16:00 Tehran (12:30Z),
    // checked 2026-08-24 Mon 09:30 Tehran (06:00Z) => 1h Sat + 0h Sun (holiday) + 30m Mon = 90m elapsed => 30m left
    const sat1600 = '2026-08-22T12:30:00Z';
    const mon0930 = Date.parse('2026-08-24T06:00:00Z');
    expect(businessMinutesLeft(sat1600, mon0930)).toBe(30);
  });
});
