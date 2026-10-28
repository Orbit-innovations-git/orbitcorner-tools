/**
 * Countdown & Date Tool: the date math, with no DOM access. window.OCCountdownCalc in the
 * browser, module.exports in Node. Never reads the clock: functions take `now`. Local time zone
 * throughout; calendar dates are Dates at 12:00, so daylight saving changes never move a date.
 */
(function (root) {
  'use strict';

  var DAY = 864e5;
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // [key, name, month, day] or [key, name, month, weekday, nth] (0 = Sunday, -1 = last); months
  // from 0. Easter and Black Friday are worked out below. countdown.php has the same list.
  var HOLIDAYS = [
    ['new-years', 'New Year\'s Day', 0, 1],
    ['mlk-day', 'Martin Luther King Jr. Day', 0, 1, 3],
    ['super-bowl', 'Super Bowl Sunday', 1, 0, 2],
    ['valentines-day', 'Valentine\'s Day', 1, 14],
    ['presidents-day', 'Presidents\' Day', 1, 1, 3],
    ['daylight-saving-starts', 'Daylight Saving Time Starts', 2, 0, 2],
    ['st-patricks-day', 'St. Patrick\'s Day', 2, 17],
    ['spring', 'First Day of Spring', 2, 20],
    ['easter', 'Easter'],
    ['tax-day', 'Tax Day', 3, 15],
    ['mothers-day', 'Mother\'s Day', 4, 0, 2],
    ['memorial-day', 'Memorial Day', 4, 1, -1],
    ['juneteenth', 'Juneteenth', 5, 19],
    ['fathers-day', 'Father\'s Day', 5, 0, 3],
    ['summer', 'First Day of Summer', 5, 21],
    ['4th-of-july', '4th of July', 6, 4],
    ['labor-day', 'Labor Day', 8, 1, 1],
    ['fall', 'First Day of Fall', 8, 22],
    ['halloween', 'Halloween', 9, 31],
    ['daylight-saving-ends', 'Daylight Saving Time Ends', 10, 0, 1],
    ['thanksgiving', 'Thanksgiving', 10, 4, 4],
    ['black-friday', 'Black Friday'],
    ['winter', 'First Day of Winter', 11, 21],
    ['christmas-eve', 'Christmas Eve', 11, 24],
    ['christmas', 'Christmas', 11, 25],
    ['new-years-eve', 'New Year\'s Eve', 11, 31]
  ];
  var APPROX = /^(spring|summer|fall|winter)$/; // Season dates move by a day: shown as approximate.

  function noon(y, m, d) {
    return new Date(y, m, d, 12);
  }

  /** Whole calendar days from a to b (negative if b is earlier). */
  function daysBetween(a, b) {
    return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / DAY);
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  /** 1234 -> "1,234" */
  function formatNumber(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /** 1, 'day' -> "1 day"; 1200 -> "1,200 days" */
  function plural(n, word) {
    return formatNumber(n) + ' ' + word + (n === 1 ? '' : 's');
  }

  /** ['a', 'b', 'c'] -> "a, b and c" */
  function joinAnd(list) {
    return list.length > 1 ? list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1] : list.join('');
  }

  /* ---------- Times of day ---------- */

  /** "3:30 pm", "3:30PM", "15:30", "1530", "3 pm", "noon", "midnight" -> { h, m }; null if not a time. */
  function parseTime(text) {
    var t = String(text == null ? '' : text).trim().toLowerCase().replace(/\./g, '');
    var m = /^(\d{1,2})(?::?(\d\d))?(?::\d\d)?\s*([ap])?m?$/.exec(t);
    var h = m ? +m[1] : 0;
    if (t === 'noon' || t === 'midnight') {
      return { h: t === 'noon' ? 12 : 0, m: 0 };
    }
    if (!m || (m[3] && (h < 1 || h > 12)) || (!m[3] && /m$/.test(t))) {
      return null;
    }
    h = m[3] ? h % 12 + (m[3] === 'p' ? 12 : 0) : h;
    return h < 24 && !(m[2] > 59) ? { h: h, m: +(m[2] || 0) } : null;
  }

  /** 15, 30 -> "3:30 PM" */
  function formatTime(h, m) {
    return ((h + 11) % 12 + 1) + ':' + pad2(m) + (h < 12 ? ' AM' : ' PM');
  }

  /** The next time the clock shows h:m: today if still ahead (or exactly now), otherwise tomorrow. */
  function nextOccurrence(now, h, m) {
    var target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    var isTomorrow = target < now;
    return { target: isTomorrow ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, h, m) : target, isTomorrow: isTomorrow };
  }

  /** Real time from now to target in whole parts, never negative (isPast says which way). */
  function diff(now, target) {
    var s = Math.floor(Math.abs(target - now) / 1000);
    return {
      totalMs: Math.abs(target - now), days: Math.floor(s / 86400), hours: Math.floor(s / 3600) % 24,
      minutes: Math.floor(s / 60) % 60, seconds: s % 60, isPast: target < now
    };
  }

  /** Share of the local day gone, 0 to 1; days with a clock change have 23 or 25 hours. */
  function dayProgress(now) {
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return (now - start) / (new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - start);
  }

  /** diff() parts as "2 h 14 m 05 s" (counter), or spoken: "2 hours and 14 minutes", "less than a minute". */
  function describe(p, spoken) {
    var list = [[p.days, 'day'], [p.hours, 'hour'], [p.minutes, 'minute']].filter(function (x) {
      return x[0];
    }).map(function (x) {
      return plural(x[0], x[1]);
    });
    if (!spoken) {
      return (p.days ? p.days + ' d ' : '') + p.hours + ' h ' + pad2(p.minutes) + ' m ' + pad2(p.seconds) + ' s';
    }
    return list.length ? joinAnd(list) : 'less than a minute';
  }

  /* ---------- Calendar dates ---------- */

  /** n days after date (negative = before). Business days skip Saturdays and Sundays, not holidays. */
  function addDays(date, n, opts) {
    var d = noon(date.getFullYear(), date.getMonth(), date.getDate());
    var step = n < 0 ? -1 : 1;
    var left = Math.floor(Math.abs(n)) || 0;
    if (!(opts && opts.businessDays)) {
      return noon(d.getFullYear(), d.getMonth(), d.getDate() + step * left);
    }
    while (left > 0) {
      d = noon(d.getFullYear(), d.getMonth(), d.getDate() + step);
      left -= d.getDay() % 6 ? 1 : 0;
    }
    return d;
  }

  /** n months later; a day the month lacks becomes its last day (Jan 31 + 1 month = Feb 28). */
  function addMonths(date, n) {
    var y = date.getFullYear();
    var m = date.getMonth() + n;
    return noon(y, m, Math.min(date.getDate(), new Date(y, m + 1, 0).getDate()));
  }

  /**
   * Days, weeks, months and years from a to b; swapped (backwards: true) if b is earlier.
   * includeEnd counts the last day too. Months count like birthdays (Java's Period.between): a month
   * is complete when the day of the month reaches the start's, and leftover days count from the start
   * moved on by the whole months. Jan 31 to Feb 28 = 0 months 28 days; Jan 31 to Mar 1 = 1 month
   * 1 day (from Feb 28); Feb 29, 2024 to Feb 28, 2026 = 1 year 11 months 30 days.
   */
  function between(a, b, opts) {
    var back = daysBetween(a, b) < 0;
    var s = addDays(back ? b : a, 0);
    var e = addDays(back ? a : b, opts && opts.includeEnd ? 1 : 0);
    var days = daysBetween(s, e);
    var months = (e.getFullYear() - s.getFullYear()) * 12 + e.getMonth() - s.getMonth() - (e.getDate() < s.getDate() ? 1 : 0);
    var years = Math.floor(months / 12);
    return {
      days: days, weeks: Math.floor(days / 7), remDays: days % 7, months: months,
      remMonthsDays: daysBetween(addMonths(s, months), e), years: years, yearMonths: months % 12,
      remYearsDays: daysBetween(addMonths(s, years * 12), e), backwards: back
    };
  }

  /** ISO 8601 week: weeks start on Monday; week 1 holds the year's first Thursday. */
  function weekNumber(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    return Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / DAY + 1) / 7);
  }

  function dayOfYear(date) {
    return daysBetween(noon(date.getFullYear(), 0, 1), date) + 1;
  }

  function daysLeftInYear(date) {
    return daysBetween(date, noon(date.getFullYear(), 11, 31));
  }

  /* ---------- Holidays ---------- */

  /** The nth weekday (0 = Sunday) of a month; n = -1 for the last. */
  function nthWeekday(y, m, weekday, n) {
    var last = noon(y, m + 1, 0);
    return n < 0 ? noon(y, m, last.getDate() - (last.getDay() - weekday + 7) % 7) :
      noon(y, m, 1 + (weekday - noon(y, m, 1).getDay() + 7) % 7 + (n - 1) * 7);
  }

  /** Western Easter Sunday: the Anonymous Gregorian algorithm. */
  function easter(y) {
    var a = y % 19;
    var b = Math.floor(y / 100);
    var c = y % 100;
    var h = (19 * a + b - Math.floor(b / 4) - Math.floor((b - Math.floor((b + 8) / 25) + 1) / 3) + 15) % 30;
    var l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - c % 4) % 7;
    var n = h + l - 7 * Math.floor((a + 11 * h + 22 * l) / 451) + 114;
    return noon(y, Math.floor(n / 31) - 1, n % 31 + 1);
  }

  function holiday(row, y) {
    return {
      key: row[0], name: row[1], approx: APPROX.test(row[0]),
      date: row[0] === 'easter' ? easter(y) : row[0] === 'black-friday' ? addDays(nthWeekday(y, 10, 4, 4), 1) :
        row[4] ? nthWeekday(y, row[2], row[3], row[4]) : noon(y, row[2], row[3])
    };
  }

  /** Every holiday for one year, in calendar order: [{ key, name, date, approx }]. */
  function holidays(year) {
    return HOLIDAYS.map(function (row) {
      return holiday(row, year);
    });
  }

  /** A holiday this year if it is today or still ahead, otherwise next year; null for an unknown key. */
  function nextHoliday(now, key) {
    var row = HOLIDAYS.filter(function (r) {
      return r[0] === key;
    })[0];
    var h = row && holiday(row, now.getFullYear());
    return !h ? null : daysBetween(now, h.date) < 0 ? holiday(row, now.getFullYear() + 1) : h;
  }

  /* ---------- US formats ---------- */

  /** 'long': "Friday, December 25, 2026"; 'medium': "December 25, 2026"; 'short': "Dec 25, 2026" */
  function formatDate(date, style) {
    var month = MONTHS[date.getMonth()];
    var text = (style === 'short' ? month.slice(0, 3) : month) + ' ' + date.getDate() + ', ' + date.getFullYear();
    return style === 'long' ? WEEKDAYS[date.getDay()] + ', ' + text : text;
  }

  /** 57 -> "8 weeks and 1 day", 63 -> "9 weeks", 6 -> "6 days" */
  function weeksDays(days) {
    var w = Math.floor(days / 7);
    return joinAnd((w ? [plural(w, 'week')] : []).concat(days % 7 || !w ? plural(days % 7, 'day') : []));
  }

  /** Date -> "2026-12-25" */
  function iso(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  /** "2026-12-25" -> that date at 12:00; null unless a real date in the years 1000-9999. */
  function parseDate(text) {
    var m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(String(text == null ? '' : text).trim());
    var d = m && noon(+m[1], m[2] - 1, +m[3]);
    return d && m[1] >= 1000 && iso(d) === m[0] ? d : null;
  }

  var api = {
    parseTime: parseTime, formatTime: formatTime, nextOccurrence: nextOccurrence, diff: diff,
    dayProgress: dayProgress, describe: describe, addDays: addDays, addMonths: addMonths, between: between,
    daysBetween: daysBetween, weekNumber: weekNumber, dayOfYear: dayOfYear, daysLeftInYear: daysLeftInYear,
    easter: easter, holidays: holidays, nextHoliday: nextHoliday, formatNumber: formatNumber,
    formatDate: formatDate, weeksDays: weeksDays, plural: plural, joinAnd: joinAnd, iso: iso,
    parseDate: parseDate, weekdays: WEEKDAYS
  };

  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  } else {
    root.OCCountdownCalc = api;
  }
}(typeof window !== 'undefined' ? window : this));
