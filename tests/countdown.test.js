/**
 * Tests for tools/countdown/countdown-calc.js. No test framework needed.
 *
 *   node tests/countdown.test.js
 *
 * Runs in New York time, so the daylight saving dates (Mar 8 and Nov 1, 2026) are real.
 */
'use strict';

process.env.TZ = 'America/New_York';

var assert = require('assert');

var calc = require('../tools/countdown/countdown-calc.js');

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok    ' + name);
  } catch (err) {
    failed++;
    console.log('  FAIL  ' + name + '\n        ' + err.message);
  }
}

/** A local date and time; months count from 1 here, unlike Date. */
function at(y, mo, d, h, mi, s) {
  return new Date(y, mo - 1, d, h || 0, mi || 0, s || 0);
}

/** Date -> "2026-12-25" */
function day(date) {
  return calc.iso(date);
}

function holiday(year, key) {
  return day(calc.holidays(year).filter(function (h) {
    return h.key === key;
  })[0].date);
}

/* ---------- 1. parseTime ---------- */

test('parseTime: 12-hour, 24-hour, compact and words', function () {
  assert.deepStrictEqual(calc.parseTime('3:30 pm'), { h: 15, m: 30 });
  assert.deepStrictEqual(calc.parseTime('3:30PM'), { h: 15, m: 30 });
  assert.deepStrictEqual(calc.parseTime('3:30 p.m.'), { h: 15, m: 30 });
  assert.deepStrictEqual(calc.parseTime('15:30'), { h: 15, m: 30 });
  assert.deepStrictEqual(calc.parseTime('1530'), { h: 15, m: 30 });
  assert.deepStrictEqual(calc.parseTime('3 pm'), { h: 15, m: 0 });
  assert.deepStrictEqual(calc.parseTime('12:00 am'), { h: 0, m: 0 });
  assert.deepStrictEqual(calc.parseTime('12:15 pm'), { h: 12, m: 15 });
  assert.deepStrictEqual(calc.parseTime('noon'), { h: 12, m: 0 });
  assert.deepStrictEqual(calc.parseTime(' Midnight '), { h: 0, m: 0 });
  assert.deepStrictEqual(calc.parseTime('09:05:30'), { h: 9, m: 5 }, 'time inputs can add seconds');
});

test('parseTime: rejects what is not a time', function () {
  ['25:00', 'abc', '', '13 pm', '0:30 am', '12:60', '3:30 xm', '3m', null, undefined].forEach(function (t) {
    assert.strictEqual(calc.parseTime(t), null, String(t));
  });
});

test('formatTime: 12-hour US format', function () {
  assert.strictEqual(calc.formatTime(15, 30), '3:30 PM');
  assert.strictEqual(calc.formatTime(0, 0), '12:00 AM');
  assert.strictEqual(calc.formatTime(12, 5), '12:05 PM');
  assert.strictEqual(calc.formatTime(9, 0), '9:00 AM');
});

/* ---------- 2. nextOccurrence ---------- */

test('nextOccurrence: later today, tomorrow, and exactly now', function () {
  var r = calc.nextOccurrence(at(2026, 10, 29, 14, 0), 15, 30);
  assert.strictEqual(r.isTomorrow, false);
  assert.strictEqual(+r.target, +at(2026, 10, 29, 15, 30));

  r = calc.nextOccurrence(at(2026, 10, 29, 16, 0), 15, 30);
  assert.strictEqual(r.isTomorrow, true);
  assert.strictEqual(+r.target, +at(2026, 10, 30, 15, 30));

  r = calc.nextOccurrence(at(2026, 10, 29, 15, 30, 0), 15, 30);
  assert.strictEqual(r.isTomorrow, false);
  assert.strictEqual(calc.diff(at(2026, 10, 29, 15, 30, 0), r.target).totalMs, 0);
});

test('nextOccurrence: 11:59:59 PM rolls to tomorrow, month and year', function () {
  var r = calc.nextOccurrence(at(2026, 12, 31, 23, 59, 59), 0, 0);
  assert.strictEqual(r.isTomorrow, true);
  assert.strictEqual(+r.target, +at(2027, 1, 1, 0, 0));
  assert.strictEqual(calc.diff(at(2026, 12, 31, 23, 59, 59), r.target).totalMs, 1000);
});

test('nextOccurrence: daylight saving nights count real time', function () {
  // Mar 8, 2026: 2:00 AM jumps to 3:00 AM, so 1:00 AM to 3:00 AM is one hour.
  var now = at(2026, 3, 8, 1, 0);
  assert.strictEqual(calc.diff(now, calc.nextOccurrence(now, 3, 0).target).totalMs, 3600e3);
  // Nov 1, 2026: 1:00-2:00 AM happens twice, so midnight to 3:00 AM is four hours.
  now = at(2026, 11, 1, 0, 0);
  assert.strictEqual(calc.diff(now, calc.nextOccurrence(now, 3, 0).target).totalMs, 4 * 3600e3);
});

/* ---------- 3. diff, dayProgress, describe ---------- */

test('diff: exact parts, and a past target', function () {
  var now = at(2026, 10, 29, 12, 0, 0);
  var p = calc.diff(now, new Date(+now + ((26 * 60 + 3) * 60 + 4) * 1000));
  assert.deepStrictEqual([p.days, p.hours, p.minutes, p.seconds, p.isPast], [1, 2, 3, 4, false]);

  p = calc.diff(now, at(2026, 10, 29, 9, 30, 15));
  assert.deepStrictEqual([p.days, p.hours, p.minutes, p.seconds, p.isPast], [0, 2, 29, 45, true]);
  assert.ok(p.totalMs > 0);
});

test('dayProgress: share of the local day, 23-hour day included', function () {
  assert.strictEqual(calc.dayProgress(at(2026, 10, 29, 0, 0)), 0);
  assert.strictEqual(calc.dayProgress(at(2026, 10, 29, 12, 0)), 0.5);
  assert.strictEqual(calc.dayProgress(at(2026, 10, 29, 15, 21, 36)), 0.64);
  // Mar 8, 2026 has 23 hours: at 12:00 PM, 11 of them are gone.
  assert.strictEqual(calc.dayProgress(at(2026, 3, 8, 12, 0)), 11 / 23);
});

test('describe: counter text and spoken sentence', function () {
  var p = { days: 0, hours: 2, minutes: 14, seconds: 5 };
  assert.strictEqual(calc.describe(p), '2 h 14 m 05 s');
  assert.strictEqual(calc.describe(p, true), '2 hours and 14 minutes');
  p = { days: 3, hours: 1, minutes: 1, seconds: 0 };
  assert.strictEqual(calc.describe(p), '3 d 1 h 01 m 00 s');
  assert.strictEqual(calc.describe(p, true), '3 days, 1 hour and 1 minute');
  assert.strictEqual(calc.describe({ days: 1200, hours: 0, minutes: 0, seconds: 9 }, true), '1,200 days');
  assert.strictEqual(calc.describe({ days: 0, hours: 0, minutes: 0, seconds: 40 }, true), 'less than a minute');
});

/* ---------- 4. addDays ---------- */

test('addDays: 75 days ahead and back', function () {
  assert.strictEqual(day(calc.addDays(at(2026, 10, 29), 75)), '2027-01-12');
  assert.strictEqual(day(calc.addDays(at(2026, 10, 29), -75)), '2026-08-15');
  assert.strictEqual(day(calc.addDays(at(2026, 10, 29), 0)), '2026-10-29');
});

test('addDays: business days skip weekends only', function () {
  assert.strictEqual(day(calc.addDays(at(2026, 10, 29), 30, { businessDays: true })), '2026-12-10');
  assert.strictEqual(day(calc.addDays(at(2026, 10, 30), 1, { businessDays: true })), '2026-11-02', 'Friday + 1 = Monday');
  assert.strictEqual(day(calc.addDays(at(2026, 10, 31), 1, { businessDays: true })), '2026-11-02', 'Saturday + 1 = Monday');
  assert.strictEqual(day(calc.addDays(at(2026, 11, 2), -1, { businessDays: true })), '2026-10-30', 'Monday - 1 = Friday');
  assert.strictEqual(day(calc.addDays(at(2026, 10, 29), 75, { businessDays: true })), '2027-02-11');
});

test('addDays: daylight saving changes and late-night times keep the right date', function () {
  assert.strictEqual(day(calc.addDays(at(2026, 10, 31, 23, 59, 59), 1)), '2026-11-01');
  assert.strictEqual(day(calc.addDays(at(2026, 10, 31, 0, 30), 2)), '2026-11-02');
  assert.strictEqual(day(calc.addDays(at(2026, 11, 1, 1, 30), -1)), '2026-10-31');
  assert.strictEqual(day(calc.addDays(at(2026, 3, 7, 23, 0), 1)), '2026-03-08');
  assert.strictEqual(day(calc.addDays(at(2026, 3, 8, 3, 0), 1)), '2026-03-09');
  assert.strictEqual(calc.addDays(at(2026, 11, 1, 1, 30), 1).getHours(), 12, 'dates come back at 12:00');
});

test('addDays: Feb 29', function () {
  assert.strictEqual(day(calc.addDays(at(2028, 2, 28), 1)), '2028-02-29');
  assert.strictEqual(day(calc.addDays(at(2028, 2, 29), 365)), '2029-02-28');
  assert.strictEqual(day(calc.addDays(at(2027, 2, 28), 1)), '2027-03-01');
});

/* ---------- 5. between ---------- */

test('between: Jan 1 to Dec 31, with and without the end date', function () {
  assert.strictEqual(calc.between(at(2026, 1, 1), at(2026, 12, 31)).days, 364);
  assert.strictEqual(calc.between(at(2026, 1, 1), at(2026, 12, 31), { includeEnd: true }).days, 365);
  var r = calc.between(at(2026, 1, 1), at(2026, 12, 31), { includeEnd: true });
  assert.deepStrictEqual([r.years, r.yearMonths, r.remMonthsDays], [1, 0, 0]);
});

test('between: Jan 31 to Mar 1 = 29 days, 1 month 1 day', function () {
  var r = calc.between(at(2026, 1, 31), at(2026, 3, 1));
  assert.deepStrictEqual([r.days, r.months, r.remMonthsDays], [29, 1, 1]);
  r = calc.between(at(2026, 1, 31), at(2026, 2, 28));
  assert.deepStrictEqual([r.days, r.months, r.remMonthsDays], [28, 0, 28], 'a month needs the 31st, or the month\'s end');
});

test('between: Feb 29, 2024 to Feb 28, 2026 = 1 year 11 months 30 days', function () {
  var r = calc.between(at(2024, 2, 29), at(2026, 2, 28));
  assert.deepStrictEqual([r.days, r.years, r.yearMonths, r.remMonthsDays, r.remYearsDays], [730, 1, 11, 30, 365]);
  r = calc.between(at(2024, 2, 29), at(2025, 3, 1));
  assert.deepStrictEqual([r.years, r.yearMonths, r.remMonthsDays], [1, 0, 1], 'Feb 29 + 1 year = Feb 28, then 1 day');
});

test('between: today to Dec 31 (the default), weeks and backwards', function () {
  var r = calc.between(at(2026, 10, 29, 15, 0), at(2026, 12, 31));
  assert.deepStrictEqual([r.days, r.weeks, r.remDays, r.months, r.remMonthsDays, r.backwards], [63, 9, 0, 2, 2, false]);
  r = calc.between(at(2026, 12, 31), at(2026, 10, 29));
  assert.deepStrictEqual([r.days, r.months, r.remMonthsDays, r.backwards], [63, 2, 2, true]);
  r = calc.between(at(2026, 3, 1), at(2026, 3, 1));
  assert.deepStrictEqual([r.days, r.backwards], [0, false]);
  assert.strictEqual(calc.between(at(2026, 3, 7), at(2026, 3, 9)).days, 2, 'across a daylight saving change');
});

/* ---------- 6. holidays ---------- */

test('holidays: Easter (Anonymous Gregorian algorithm)', function () {
  assert.strictEqual(holiday(2026, 'easter'), '2026-04-05');
  assert.strictEqual(holiday(2027, 'easter'), '2027-03-28');
  assert.strictEqual(day(calc.easter(2024)), '2024-03-31');
  assert.strictEqual(day(calc.easter(2025)), '2025-04-20');
  assert.strictEqual(day(calc.easter(2038)), '2038-04-25', 'latest possible');
  assert.strictEqual(day(calc.easter(2285)), '2285-03-22', 'earliest possible');
});

test('holidays: 2026 and 2027 dates', function () {
  var expected = {
    'thanksgiving': ['2026-11-26', '2027-11-25'],
    'memorial-day': ['2026-05-25'],
    'labor-day': ['2026-09-07'],
    'mlk-day': ['2026-01-19'],
    'presidents-day': ['2026-02-16'],
    'mothers-day': ['2026-05-10'],
    'fathers-day': ['2026-06-21'],
    'black-friday': ['2026-11-27', '2027-11-26'],
    'daylight-saving-starts': ['2026-03-08'],
    'daylight-saving-ends': ['2026-11-01'],
    'super-bowl': ['2026-02-08', '2027-02-14'],
    'christmas': ['2026-12-25'],
    '4th-of-july': ['2026-07-04'],
    'summer': ['2026-06-21']
  };
  Object.keys(expected).forEach(function (key) {
    expected[key].forEach(function (date, i) {
      assert.strictEqual(holiday(2026 + i, key), date, key + ' ' + (2026 + i));
    });
  });
});

test('holidays: 26 events with unique keys, in calendar order for 2026', function () {
  var list = calc.holidays(2026);
  var keys = list.map(function (h) {
    return h.key;
  });
  assert.strictEqual(list.length, 26);
  assert.strictEqual(keys.filter(function (k, i) {
    return keys.indexOf(k) === i;
  }).length, 26);
  list.forEach(function (h, i) {
    assert.ok(i === 0 || h.date >= list[i - 1].date, h.key + ' is out of order');
    assert.strictEqual(h.approx, ['spring', 'summer', 'fall', 'winter'].indexOf(h.key) !== -1);
  });
});

/* ---------- 7. nextHoliday ---------- */

test('nextHoliday: today counts, yesterday rolls to next year', function () {
  assert.strictEqual(day(calc.nextHoliday(at(2026, 12, 26), 'christmas').date), '2027-12-25');
  assert.strictEqual(day(calc.nextHoliday(at(2026, 12, 25, 23, 59), 'christmas').date), '2026-12-25');
  assert.strictEqual(day(calc.nextHoliday(at(2026, 10, 29), 'christmas').date), '2026-12-25');
  assert.strictEqual(day(calc.nextHoliday(at(2026, 4, 6), 'easter').date), '2027-03-28');
  assert.strictEqual(calc.nextHoliday(at(2026, 10, 29), 'christmas').name, 'Christmas');
  assert.strictEqual(calc.nextHoliday(at(2026, 10, 29), 'nope'), null);
});

/* ---------- 8. weekNumber, dayOfYear, daysLeftInYear ---------- */

test('weekNumber (ISO), dayOfYear, daysLeftInYear', function () {
  assert.strictEqual(calc.weekNumber(at(2027, 1, 1)), 53);
  assert.strictEqual(calc.weekNumber(at(2026, 10, 29)), 44);
  assert.strictEqual(calc.weekNumber(at(2026, 1, 1)), 1);
  assert.strictEqual(calc.weekNumber(at(2024, 12, 30)), 1, 'Dec 30, 2024 is in week 1 of 2025');
  assert.strictEqual(calc.dayOfYear(at(2026, 10, 29)), 302);
  assert.strictEqual(calc.daysLeftInYear(at(2026, 10, 29)), 63);
  assert.strictEqual(calc.dayOfYear(at(2028, 12, 31)), 366);
});

/* ---------- Formats ---------- */

test('formats: dates, numbers, weeks', function () {
  var xmas = at(2026, 12, 25);
  assert.strictEqual(calc.formatDate(xmas, 'long'), 'Friday, December 25, 2026');
  assert.strictEqual(calc.formatDate(xmas, 'medium'), 'December 25, 2026');
  assert.strictEqual(calc.formatDate(xmas, 'short'), 'Dec 25, 2026');
  assert.strictEqual(calc.formatNumber(1512), '1,512');
  assert.strictEqual(calc.formatNumber(1234567), '1,234,567');
  assert.strictEqual(calc.weeksDays(57), '8 weeks and 1 day');
  assert.strictEqual(calc.weeksDays(63), '9 weeks');
  assert.strictEqual(calc.weeksDays(6), '6 days');
  assert.strictEqual(calc.weeksDays(0), '0 days');
  assert.strictEqual(calc.weeksDays(8), '1 week and 1 day');
});

test('parseDate: real dates only', function () {
  assert.strictEqual(day(calc.parseDate('2026-12-25')), '2026-12-25');
  assert.strictEqual(calc.parseDate('2026-12-25').getHours(), 12);
  assert.strictEqual(day(calc.parseDate('2028-02-29')), '2028-02-29');
  ['2026-02-29', '2026-13-01', '2026-1-1', '', 'abc', '0999-01-01', null].forEach(function (t) {
    assert.strictEqual(calc.parseDate(t), null, String(t));
  });
});

test('never NaN: odd inputs to addDays and describe', function () {
  assert.strictEqual(day(calc.addDays(at(2026, 10, 29), NaN)), '2026-10-29');
  assert.strictEqual(day(calc.addDays(at(2026, 10, 29), 2.9)), '2026-10-31');
  assert.ok(!/NaN/.test(calc.describe(calc.diff(at(2026, 1, 1), at(2026, 1, 1)), true)));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exitCode = failed ? 1 : 0;
