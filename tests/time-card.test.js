/**
 * Tests for tools/time-card/time-card-calc.js. No test framework needed.
 *
 *   node tests/time-card.test.js
 */
'use strict';

var assert = require('assert');

var calc = require('../tools/time-card/time-card-calc.js');
var MSG = calc.messages;
var NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

function shift(start, end, breakMin, nextDay) {
  return { in: start, out: end, breakMin: breakMin == null ? 0 : breakMin, nextDay: nextDay === true };
}

/** A week from a list of per-day shift lists (missing days are empty). */
function week(perDay, extra) {
  var input = {
    days: NAMES.map(function (name, i) {
      return { name: name, shifts: perDay[i] || [] };
    }),
    rate: null,
    otRule: 'weekly',
    otMultiplier: 1.5,
    rounding: 0,
    deductBreaks: true
  };
  Object.keys(extra || {}).forEach(function (key) {
    input[key] = extra[key];
  });
  return input;
}

/** The same shift on the first `count` days. */
function repeat(count, s) {
  var perDay = [];
  for (var i = 0; i < count; i++) {
    perDay.push([s]);
  }
  return perDay;
}

function minutes(result) {
  return [result.regularMinutes, result.overtimeMinutes, result.doubleMinutes];
}

/** Fails if any number anywhere in the result is NaN, Infinity or negative. */
function assertCleanNumbers(value, where) {
  if (typeof value === 'number') {
    assert.ok(isFinite(value) && value >= 0, where + ' is ' + value);
  } else if (value && typeof value === 'object') {
    Object.keys(value).forEach(function (key) {
      assertCleanNumbers(value[key], where + '.' + key);
    });
  }
}

/* ---------- The ten cases from the brief ---------- */

test('1. 9:00–17:00 with a 30-min break is 7.5 h; five days are 37.5 h with no overtime', function () {
  var one = calc.compute(week([[shift('09:00', '17:00', 30)]]));
  assert.strictEqual(one.days[0].minutes, 450);
  assert.strictEqual(calc.formatHours(one.totalMinutes), '7.50');

  var r = calc.compute(week(repeat(5, shift('09:00', '17:00', 30))));
  assert.strictEqual(r.totalMinutes, 2250);
  assert.strictEqual(calc.formatHours(r.totalMinutes), '37.50');
  assert.deepStrictEqual(minutes(r), [2250, 0, 0]);
  assert.strictEqual(r.daysWorked, 5);
  assert.deepStrictEqual(r.warnings, []);
  assert.strictEqual(r.hasErrors, false);
});

test('2. 8:00–17:00 with a 30-min break × 5 = 42.5 h → weekly: 40 regular + 2.5 overtime', function () {
  var r = calc.compute(week(repeat(5, shift('08:00', '17:00', 30))));
  assert.strictEqual(r.totalMinutes, 2550);
  assert.deepStrictEqual(minutes(r), [2400, 150, 0]);
});

test('3. Daily rule: one 10-hour day and four 7-hour days (38 h) → 2 h overtime', function () {
  var perDay = [[shift('08:00', '18:00')]].concat(repeat(4, shift('09:00', '16:00')));
  var r = calc.compute(week(perDay, { otRule: 'daily' }));
  assert.strictEqual(r.totalMinutes, 2280);
  assert.deepStrictEqual(minutes(r), [2160, 120, 0]);

  var weekly = calc.compute(week(perDay, { otRule: 'weekly' }));
  assert.deepStrictEqual(minutes(weekly), [2280, 0, 0], 'the same week has no weekly overtime');
});

test('4. California: 13-hour day; five 9-hour days; six 8-hour days', function () {
  var day13 = calc.compute(week([[shift('06:00', '19:00')]], { otRule: 'california' }));
  assert.deepStrictEqual(minutes(day13), [480, 240, 60], '8 regular, 4 overtime, 1 double');

  var five9 = calc.compute(week(repeat(5, shift('08:00', '17:00')), { otRule: 'california' }));
  assert.deepStrictEqual(minutes(five9), [2400, 300, 0], '40 regular, 5 overtime');

  var six8 = calc.compute(week(repeat(6, shift('09:00', '17:00')), { otRule: 'california' }));
  assert.deepStrictEqual(minutes(six8), [2400, 480, 0], '40 regular, 8 overtime');
});

test('5. Night shift 22:00–06:00 with nextDay is 480 min; without nextDay it is an error', function () {
  var r = calc.compute(week([[shift('22:00', '06:00', 0, true)]]));
  assert.strictEqual(r.days[0].minutes, 480);
  assert.strictEqual(r.days[0].shifts[0].rawMinutes, 480);

  var bad = calc.compute(week([[shift('22:00', '06:00', 0, false)]]));
  assert.strictEqual(bad.days[0].minutes, 0);
  assert.strictEqual(bad.days[0].error, MSG.before);
  assert.strictEqual(bad.days[0].shifts[0].field, 'out');
  assert.strictEqual(bad.hasErrors, true);
});

test('6. Rounding: 15 → 7→0, 8→15, 22→15, 23→30; 6 → 3→6, 2→0; 5 → 2→0, 3→5', function () {
  [[7, 15, 0], [8, 15, 15], [22, 15, 15], [23, 15, 30], [3, 6, 6], [2, 6, 0], [2, 5, 0], [3, 5, 5], [7, 0, 7]].forEach(function (c) {
    assert.strictEqual(calc.roundMinutes(c[0], c[1]), c[2], c[0] + ' min at ' + c[1]);
  });
  // Applied per shift, after the break: 9:00–17:28 less 20 min = 488 → 495 (rounding first would give 510 − 20 = 490).
  var r = calc.compute(week([
    [shift('09:00', '17:07')],
    [shift('09:00', '17:08')],
    [shift('09:00', '17:28', 20)]
  ], { rounding: 15 }));
  assert.deepStrictEqual(r.days.slice(0, 3).map(function (d) { return d.minutes; }), [480, 495, 495]);
  assert.strictEqual(r.days[0].shifts[0].rawMinutes, 487, 'rawMinutes is before breaks and rounding');
});

test('7. Pay: 45 h at $20 weekly 1.5× = $950.00; California 13-hour day at $20 = $320.00', function () {
  var r = calc.compute(week(repeat(5, shift('08:00', '17:00')), { rate: 20 }));
  assert.strictEqual(r.totalMinutes, 2700);
  assert.deepStrictEqual(r.pay, { regular: 800, overtime: 150, double: 0, gross: 950 });
  assert.strictEqual(calc.formatMoney(r.pay.gross), '$950.00');

  var ca = calc.compute(week([[shift('06:00', '19:00')]], { otRule: 'california', rate: 20 }));
  assert.deepStrictEqual(ca.pay, { regular: 160, overtime: 120, double: 40, gross: 320 });
});

test('8. Breaks: not deducted when deductBreaks is false; a break longer than the shift gives 0 and an error', function () {
  var r = calc.compute(week([[shift('09:00', '17:00', 30)]], { deductBreaks: false }));
  assert.strictEqual(r.totalMinutes, 480);

  var noCheck = calc.compute(week([[shift('09:00', '17:00', 'abc')]], { deductBreaks: false }));
  assert.strictEqual(noCheck.totalMinutes, 480, 'the break box is ignored when breaks are not deducted');

  var long = calc.compute(week([[shift('09:00', '10:00', 90)]]));
  assert.strictEqual(long.days[0].minutes, 0);
  assert.strictEqual(long.days[0].error, MSG.breakLong);
  assert.strictEqual(long.days[0].shifts[0].field, 'breakMin');

  var equal = calc.compute(week([[shift('09:00', '10:00', 60)]]));
  assert.strictEqual(equal.days[0].minutes, 0);
  assert.strictEqual(equal.days[0].error, null, 'a break as long as the shift is 0, not an error');

  var letters = calc.compute(week([[shift('09:00', '17:00', 'half an hour')]]));
  assert.strictEqual(letters.days[0].error, MSG.breakText);
});

test('9. Empty rows, missing fields, out = in, and two shifts in one day', function () {
  var empty = calc.compute(week([]));
  assert.strictEqual(empty.days.length, 7);
  assert.deepStrictEqual(minutes(empty), [0, 0, 0]);
  assert.strictEqual(empty.daysWorked, 0);
  assert.strictEqual(empty.hasErrors, false);

  var missing = calc.compute(week([[{ in: '09:00' }], [{ out: '17:00', breakMin: 30 }], [{}], [null]]));
  assert.strictEqual(missing.totalMinutes, 0);
  assert.strictEqual(missing.hasErrors, false, 'half-filled shifts are ignored, not errors');

  var same = calc.compute(week([[shift('09:00', '09:00')]]));
  assert.strictEqual(same.days[0].minutes, 0);
  assert.strictEqual(same.days[0].error, MSG.same);
  var sameNight = calc.compute(week([[shift('09:00', '09:00', 0, true)]]));
  assert.strictEqual(sameNight.days[0].error, MSG.same, 'not a 24-hour shift');

  var split = calc.compute(week([[shift('06:00', '10:00'), shift('14:00', '18:00')]]));
  assert.strictEqual(split.days[0].minutes, 480);
  assert.strictEqual(split.days[0].shifts.length, 2);

  var badTime = calc.compute(week([[shift('9am', '17:00')]]));
  assert.strictEqual(badTime.days[0].error, MSG.time);
  assert.strictEqual(badTime.days[0].shifts[0].field, 'in');
});

test('10. Warning when a shift is over 16 hours (once per day)', function () {
  var r = calc.compute(week([[shift('06:00', '23:00'), shift('23:15', '23:45')], [], [shift('05:00', '21:00')]]));
  assert.deepStrictEqual(r.warnings, ['Monday has a shift over 16 hours. Check the times.'], 'exactly 16 h is not warned');
});

/* ---------- More cases ---------- */

test('California: seven 12-hour night shifts → 40 regular, 44 overtime, no double time', function () {
  var r = calc.compute(week(repeat(7, shift('19:00', '07:00', 0, true)), { otRule: 'california', rate: 20 }));
  assert.strictEqual(r.totalMinutes, 84 * 60);
  assert.deepStrictEqual(minutes(r), [2400, 44 * 60, 0]);
  assert.deepStrictEqual(r.pay, { regular: 800, overtime: 1320, double: 0, gross: 2120 });
});

test('Two shifts on one day, the second across midnight', function () {
  var r = calc.compute(week([[shift('06:00', '10:00', 0), shift('20:00', '02:00', 30, true)]], { otRule: 'daily' }));
  assert.strictEqual(r.days[0].minutes, 240 + 330);
  assert.deepStrictEqual(minutes(r), [480, 90, 0]);
});

test('No overtime rule: everything is regular', function () {
  var r = calc.compute(week(repeat(6, shift('06:00', '20:00')), { otRule: 'none', rate: 10 }));
  assert.deepStrictEqual(minutes(r), [84 * 60, 0, 0]);
  assert.strictEqual(r.pay.gross, 840);
});

test('Overtime multiplier: 2× is used; out-of-range or missing falls back to 1.5×', function () {
  var base = week(repeat(5, shift('08:00', '17:00')), { rate: 20 });
  base.otMultiplier = 2;
  assert.strictEqual(calc.compute(base).pay.overtime, 200);
  [0.5, 4, 'abc', null, undefined].forEach(function (m) {
    base.otMultiplier = m;
    assert.strictEqual(calc.compute(base).pay.overtime, 150, 'multiplier ' + m);
  });
});

test('Pay is rounded to cents per line, and gross is the sum of the lines', function () {
  // 7.5 h × $18.33 = 137.475 → $137.48 (plain Math.round gives 137.47 here).
  var r = calc.compute(week([[shift('09:00', '17:00', 30)]], { rate: 18.33 }));
  assert.strictEqual(r.pay.regular, 137.48);
  assert.strictEqual(r.pay.gross, 137.48);

  var odd = calc.compute(week(repeat(5, shift('08:00', '17:07')), { rate: 17.77 }));
  assert.strictEqual(odd.pay.gross, Math.round((odd.pay.regular + odd.pay.overtime) * 100) / 100);
});

test('Rate: "$18.50" works; 0 and empty give no pay; text gives no pay', function () {
  var w = week(repeat(5, shift('09:00', '17:00', 30)));
  w.rate = '$18.50';
  assert.strictEqual(calc.compute(w).pay.gross, 693.75);
  [0, '0', '', null, 'abc', -5].forEach(function (rate) {
    w.rate = rate;
    assert.strictEqual(calc.compute(w).pay, null, 'rate ' + JSON.stringify(rate));
  });
});

test('parseRate, parseBreak and parseTime', function () {
  assert.strictEqual(calc.parseRate('20'), 20);
  assert.strictEqual(calc.parseRate('20.50'), 20.5);
  assert.strictEqual(calc.parseRate(' $1,250 '), 1250);
  assert.strictEqual(calc.parseRate('.5'), 0.5);
  assert.strictEqual(calc.parseRate(''), null);
  assert.ok(isNaN(calc.parseRate('abc')));
  assert.ok(isNaN(calc.parseRate('-5')));
  assert.ok(isNaN(calc.parseRate('20 dollars')));

  [['30', 30], ['0:30', 30], ['1:15', 75], ['45m', 45], ['45 min', 45], ['45 minutes', 45], ['45mins', 45], ['', 0], [' ', 0],
    [30, 30], [0, 0]].forEach(function (c) {
    assert.strictEqual(calc.parseBreak(c[0]), c[1], JSON.stringify(c[0]));
  });
  ['abc', '-5', '1.5', '0:75', 'm', '1h', '30 m 5', 2000, -1, 7.5, NaN].forEach(function (bad) {
    assert.ok(isNaN(calc.parseBreak(bad)), JSON.stringify(bad) + ' is not a break');
  });

  assert.strictEqual(calc.parseTime('09:00'), 540);
  assert.strictEqual(calc.parseTime('9:05:30'), 545, 'seconds from <input type="time" step> are ignored');
  assert.strictEqual(calc.parseTime('00:00'), 0);
  assert.strictEqual(calc.parseTime('23:59'), 1439);
  ['24:00', '12:60', '9', '', null, '9:00 AM'].forEach(function (bad) {
    assert.ok(isNaN(calc.parseTime(bad)), JSON.stringify(bad) + ' is not a 24-hour time');
  });
});

test('US formats: hours, h m, money, 12-hour times', function () {
  assert.strictEqual(calc.formatHours(2550), '42.50');
  assert.strictEqual(calc.formatHours(0), '0.00');
  assert.strictEqual(calc.formatHours(1), '0.02');
  assert.strictEqual(calc.formatHours(100000), '1,666.67');
  assert.strictEqual(calc.formatHM(2550), '42 h 30 m');
  assert.strictEqual(calc.formatHM(480), '8 h');
  assert.strictEqual(calc.formatHM(45), '45 m');
  assert.strictEqual(calc.formatHM(0), '0 h');
  assert.strictEqual(calc.formatMoney(1234.5), '$1,234.50');
  assert.strictEqual(calc.formatMoney(0), '$0.00');
  assert.strictEqual(calc.formatTime('15:30'), '3:30 PM');
  assert.strictEqual(calc.formatTime('00:05'), '12:05 AM');
  assert.strictEqual(calc.formatTime('12:00'), '12:00 PM');
  assert.strictEqual(calc.formatTime('09:00'), '9:00 AM');
  assert.strictEqual(calc.formatTime('x'), '');
});

test('Share links: a day encodes to "0900-1700-30" and decodes back', function () {
  assert.strictEqual(calc.encodeDay([shift('09:00', '17:00', '30')]), '0900-1700-30');
  assert.strictEqual(calc.encodeDay([shift('06:00', '10:00', ''), shift('22:00', '06:00', '0:45', true)]), '0600-1000.2200-0600-45');
  assert.strictEqual(calc.encodeDay([shift('', '', '30'), shift('', '')]), '', 'a break with no times is not saved');
  assert.strictEqual(calc.encodeDay([shift('09:00', '', 'abc')]), '0900-', 'a half-filled shift is kept; a bad break is dropped');
  assert.strictEqual(calc.encodeDay(undefined), '');

  assert.deepStrictEqual(calc.decodeDay('0900-1700-30'), [{ in: '09:00', out: '17:00', breakMin: '30' }]);
  assert.deepStrictEqual(calc.decodeDay('0600-1000.2200-0600-45'), [
    { in: '06:00', out: '10:00', breakMin: '' },
    { in: '22:00', out: '06:00', breakMin: '45' }
  ]);
  assert.deepStrictEqual(calc.decodeDay('2500-1700-30'), [{ in: '', out: '17:00', breakMin: '30' }], 'invalid time is dropped');
  assert.deepStrictEqual(calc.decodeDay('0900-1700-abc.0100-0200.0300-0400'), [
    { in: '09:00', out: '17:00', breakMin: '' },
    { in: '01:00', out: '02:00', breakMin: '' }
  ], 'bad break dropped, at most 2 shifts');
  assert.deepStrictEqual(calc.decodeDay(''), []);
  assert.deepStrictEqual(calc.decodeDay('<script>'), []);
});

test('Settings that are missing or invalid fall back to the defaults', function () {
  var r = calc.compute({ days: week(repeat(5, shift('08:00', '17:00', 30))).days });
  assert.strictEqual(r.otRule, 'weekly');
  assert.deepStrictEqual(minutes(r), [2400, 150, 0]);
  var odd = calc.compute({ days: week(repeat(1, shift('09:00', '17:07'))).days, otRule: 'monthly', rounding: 7.5 });
  assert.strictEqual(odd.otRule, 'weekly');
  assert.strictEqual(odd.totalMinutes, 487, 'invalid rounding means no rounding');
});

test('Garbage input never gives NaN, Infinity or negative numbers', function () {
  var junk = [
    undefined, null, {}, { days: 'x' }, { days: [null, 5, 'Mon', { shifts: 'x' }] },
    { days: [{ name: 'Mon', shifts: [{ in: {}, out: [], breakMin: {} }, { in: '25:00', out: '26:00' }] }], rate: 'NaN', otMultiplier: Infinity, rounding: -15 },
    week([[shift('09:00', '17:00', -30)], [shift('09:00', '17:00', Infinity)]], { rate: 1e30, otRule: 'california' }),
    week(repeat(7, shift('00:00', '23:59', 0, true)), { rate: '999999', otRule: 'california', rounding: 15 })
  ];
  junk.forEach(function (input, i) {
    var r = calc.compute(input);
    assertCleanNumbers({ total: r.totalMinutes, regular: r.regularMinutes, overtime: r.overtimeMinutes, double: r.doubleMinutes, days: r.days, pay: r.pay }, 'junk[' + i + ']');
    assert.strictEqual(r.regularMinutes + r.overtimeMinutes + r.doubleMinutes, r.totalMinutes, 'junk[' + i + '] parts add up');
  });
});

test('Regular + overtime + double always equals the total, for every rule', function () {
  var weeks = [
    repeat(7, shift('19:00', '07:00', 0, true)),
    repeat(5, shift('06:00', '19:30', 45)),
    [[shift('00:00', '23:00')], [shift('09:00', '12:00')], [], [shift('09:00', '21:00', 15)]]
  ];
  calc.rules.forEach(function (rule) {
    weeks.forEach(function (perDay, i) {
      var r = calc.compute(week(perDay, { otRule: rule }));
      assert.strictEqual(r.regularMinutes + r.overtimeMinutes + r.doubleMinutes, r.totalMinutes, rule + ' week ' + i);
      if (rule === 'weekly' || rule === 'california') {
        assert.ok(r.regularMinutes <= 2400, rule + ' week ' + i + ': regular is at most 40 h');
      }
    });
  });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exitCode = failed ? 1 : 0;
