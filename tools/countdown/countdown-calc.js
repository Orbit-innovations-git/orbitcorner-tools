/**
 * Countdown & Date Tool: the date math, with no DOM access. window.OCCountdownCalc in the
 * browser, module.exports in Node. Nothing here reads the clock: every function takes `now`.
 * Everything is in the local time zone. Calendar dates are Dates at 12:00, so adding days
 * never lands on the wrong date across a daylight saving change.
 */
(function (root) {
  'use strict';

  var DAY = 864e5;
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /*
   * [key, name, month, day] is a fixed date; [key, name, month, weekday, n] is the nth weekday
   * of the month (0 = Sunday; n = -1 for the last). Easter and Black Friday are worked out below.
   * Months count from 0. In calendar order; countdown.php keeps the same list for the server.
   */
  var HOLIDAYS = [
    ['new-years', 'New Year\'s Day', 0, 1],
    ['mlk-day', 'Martin Luther King Jr. Day', 0, 1, 3],
    ['super-bowl', 'Super Bowl Sunday', 1, 0, 2],
    ['valentines-day', 'Valentine\'s Day', 1, 14],
    ['presidents-day', 'Presidents\' Day', 1, 1, 3],
    ['daylight-saving-starts', 'Daylight Saving Time Starts', 2, 0, 2],
    ['st-patricks-day', 'St. Patrick\'s Day', 2, 17],
    ['spring', 'First Day of Spring', 2, 20],
    ['easter', 'Easter', 0, 0],
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
    ['black-friday', 'Black Friday', 0, 0],
    ['winter', 'First Day of Winter', 11, 21],
    ['christmas-eve', 'Christmas Eve', 11, 24],
    ['christmas', 'Christmas', 11, 25],
    ['new-years-eve', 'New Year\'s Eve', 11, 31]
  ];
  var APPROX = ['spring', 'summer', 'fall', 'winter']; // Season dates move by a day; the UI says "approximately".

  function noon(y, m, d) {
    return new Date(y, m, d, 12);
  }

  function dateOnly(date) {
    return noon(date.getFullYear(), date.getMonth(), date.getDate());
  }

  /** Whole calendar days from a to b (negative if b is earlier); time of day is ignored. */
  function daysBetween(a, b) {
    return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / DAY);
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  /* ---------- Times of day ---------- */

  /** "3:30 pm", "3:30PM", "15:30", "1530", "3 pm", "noon", "midnight" -> { h, m }; null if not a time. */
  function parseTime(text) {
    var t = String(text == null ? '' : text).trim().toLowerCase().replace(/\./g, '');
    var m = /^(\d{1,2})(?::?(\d\d))?(?::\d\d)?\s*([ap])?m?$/.exec(t);
    var h, min;
    if (t === 'noon' || t === 'midnight') {
      return { h: t === 'noon' ? 12 : 0, m: 0 };
    }
    if (!m || (t.slice(-1) === 'm' && !m[3])) {
      return null;
    }
    h = +m[1];
    min = m[2] ? +m[2] : 0;
    if (m[3]) {
      if (h < 1 || h > 12) {
        return null;
      }
      h = h % 12 + (m[3] === 'p' ? 12 : 0);
    }
    return h < 24 && min < 60 ? { h: h, m: min } : null;
  }

  /** 15, 30 -> "3:30 PM" */
  function formatTime(h, m) {
    return ((h + 11) % 12 + 1) + ':' + pad2(m) + (h < 12 ? ' AM' : ' PM');
  }

  /** The next time the clock shows h:m: today if that is still ahead (or exactly now), else tomorrow. */
  function nextOccurrence(now, h, m) {
    var y = now.getFullYear();
    var mo = now.getMonth();
    var d = now.getDate();
    var target = new Date(y, mo, d, h, m);
    var isTomorrow = target < now;
    return { target: isTomorrow ? new Date(y, mo, d + 1, h, m) : target, isTomorrow: isTomorrow };
  }

  /** Time from now to target in whole parts; never negative (isPast says which way). */
  function diff(now, target) {
    var ms = target - now;
    var s = Math.floor(Math.abs(ms) / 1000);
    return {
      totalMs: Math.abs(ms), days: Math.floor(s / 86400), hours: Math.floor(s / 3600) % 24,
      minutes: Math.floor(s / 60) % 60, seconds: s % 60, isPast: ms < 0
    };
  }

  /** Share of the local day gone, 0 to 1 (23- and 25-hour days included). */
  function dayProgress(now) {
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return Math.min(1, Math.max(0, (now - start) / (end - start)));
  }

  function plural(n, word) {
    return formatNumber(n) + ' ' + word + (n === 1 ? '' : 's');
  }

  /** ["1 day", "2 hours", "5 minutes"] -> "1 day, 2 hours and 5 minutes" */
  function joinAnd(list) {
    return list.length > 1 ? list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1] : list.join('');
  }

  /**
   * diff() parts as words. Short, for the counter and Copy: "2 h 14 m 05 s", "3 d 2 h 14 m 05 s".
   * Spoken (spoken = true), for screen readers: "2 hours and 14 minutes", "less than a minute".
   */
  function describe(p, spoken) {
    if (!spoken) {
      return (p.days ? p.days + ' d ' : '') + p.hours + ' h ' + pad2(p.minutes) + ' m ' + pad2(p.seconds) + ' s';
    }
    var list = [];
    if (p.days) {
      list.push(plural(p.days, 'day'));
    }
    if (p.hours) {
      list.push(plural(p.hours, 'hour'));
    }
    if (p.minutes) {
      list.push(plural(p.minutes, 'minute'));
    }
    return list.length ? joinAnd(list) : 'less than a minute';
  }

  /* ---------- Calendar dates ---------- */

  /** n days after date (n < 0 = before). businessDays skips Saturdays and Sundays only, not holidays. */
  function addDays(date, n, opts) {
    var d = dateOnly(date);
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

  /** date moved by n months; a day the month doesn't have becomes its last day (Jan 31 + 1 = Feb 28). */
  function addMonths(date, n) {
    var y = date.getFullYear();
    var m = date.getMonth() + n;
    return noon(y, m, Math.min(date.getDate(), new Date(y, m + 1, 0).getDate()));
  }

  /**
   * Days, weeks, months and years from a to b. If b is before a they are swapped and
   * backwards is true. includeEnd counts the end date too (Jan 1 to Jan 1 = 1 day).
   *
   * Months and years are counted the way people count birthdays (as in Java's Period.between):
   * a month is complete when the end date's day of the month reaches the start's day, and the
   * days left over are counted from the start moved forward by the whole months (to the last
   * day of a shorter month). So Jan 31 to Feb 28 = 0 months 28 days, Jan 31 to Mar 1 = 1 month
   * 1 day (from Feb 28), and Feb 29, 2024 to Feb 28, 2026 = 1 year 11 months 30 days.
   */
  function between(a, b, opts) {
    var back = daysBetween(a, b) < 0;
    var s = dateOnly(back ? b : a);
    var e = dateOnly(back ? a : b);
    if (opts && opts.includeEnd) {
      e = noon(e.getFullYear(), e.getMonth(), e.getDate() + 1);
    }
    var days = daysBetween(s, e);
    var months = (e.getFullYear() - s.getFullYear()) * 12 + e.getMonth() - s.getMonth() - (e.getDate() < s.getDate() ? 1 : 0);
    var years = Math.floor(months / 12);
    return {
      days: days, weeks: Math.floor(days / 7), remDays: days % 7,
      months: months, remMonthsDays: daysBetween(addMonths(s, months), e),
      years: years, yearMonths: months % 12, remYearsDays: daysBetween(addMonths(s, years * 12), e),
      backwards: back
    };
  }

  /** ISO 8601 week number: weeks start on Monday; week 1 holds the year's first Thursday. */
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

  /** The nth weekday (0 = Sunday) of a month; n = -1 for the last one. */
  function nthWeekday(y, m, weekday, n) {
    if (n < 0) {
      var last = noon(y, m + 1, 0);
      return noon(y, m, last.getDate() - (last.getDay() - weekday + 7) % 7);
    }
    return noon(y, m, 1 + (weekday - noon(y, m, 1).getDay() + 7) % 7 + (n - 1) * 7);
  }

  /** Western Easter Sunday: the Anonymous Gregorian algorithm (Meeus/Jones/Butcher). */
  function easter(y) {
    var a = y % 19;
    var b = Math.floor(y / 100);
    var c = y % 100;
    var h = (19 * a + b - Math.floor(b / 4) - Math.floor((b - Math.floor((b + 8) / 25) + 1) / 3) + 15) % 30;
    var l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - c % 4) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var n = h + l - 7 * m + 114;
    return noon(y, Math.floor(n / 31) - 1, n % 31 + 1);
  }

  function holidayDate(row, y) {
    if (row[0] === 'easter') {
      return easter(y);
    }
    if (row[0] === 'black-friday') {
      return addDays(nthWeekday(y, 10, 4, 4), 1);
    }
    return row.length > 4 ? nthWeekday(y, row[2], row[3], row[4]) : noon(y, row[2], row[3]);
  }

  function holiday(row, y) {
    return { key: row[0], name: row[1], date: holidayDate(row, y), approx: APPROX.indexOf(row[0]) !== -1 };
  }

  /** Every holiday in the list for one year: [{ key, name, date, approx }]. */
  function holidays(year) {
    return HOLIDAYS.map(function (row) {
      return holiday(row, year);
    });
  }

  /** A holiday's date this year if it is today or still ahead, otherwise next year's; null for an unknown key. */
  function nextHoliday(now, key) {
    var row = HOLIDAYS.filter(function (r) {
      return r[0] === key;
    })[0];
    var h = row && holiday(row, now.getFullYear());
    if (!h) {
      return null;
    }
    return daysBetween(now, h.date) < 0 ? holiday(row, now.getFullYear() + 1) : h;
  }

  /* ---------- US formats ---------- */

  /** 1234 -> "1,234" */
  function formatNumber(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /** style 'long': "Friday, December 25, 2026"; 'medium': "December 25, 2026"; 'short': "Dec 25, 2026". */
  function formatDate(date, style) {
    var month = MONTHS[date.getMonth()];
    var text = (style === 'short' ? month.slice(0, 3) : month) + ' ' + date.getDate() + ', ' + date.getFullYear();
    return style === 'long' ? WEEKDAYS[date.getDay()] + ', ' + text : text;
  }

  /** 57 -> "8 weeks and 1 day", 63 -> "9 weeks", 6 -> "6 days" */
  function weeksDays(days) {
    var w = Math.floor(days / 7);
    var d = days % 7;
    return joinAnd((w ? [plural(w, 'week')] : []).concat(d || !w ? plural(d, 'day') : []));
  }

  /** Date -> "2026-12-25" */
  function iso(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  /** "2026-12-25" -> that date at 12:00; null unless a real date in the years 1000-9999. */
  function parseDate(text) {
    var m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(String(text == null ? '' : text).trim());
    var d = m && noon(+m[1], m[2] - 1, +m[3]);
    return d && +m[1] >= 1000 && d.getMonth() === m[2] - 1 && d.getDate() === +m[3] ? d : null;
  }

  var api = {
    parseTime: parseTime, formatTime: formatTime, nextOccurrence: nextOccurrence, diff: diff,
    dayProgress: dayProgress, describe: describe, addDays: addDays, addMonths: addMonths, between: between,
    daysBetween: daysBetween, weekNumber: weekNumber, dayOfYear: dayOfYear, daysLeftInYear: daysLeftInYear,
    easter: easter, holidays: holidays, nextHoliday: nextHoliday, formatNumber: formatNumber,
    formatDate: formatDate, weeksDays: weeksDays, plural: plural, joinAnd: joinAnd, iso: iso, parseDate: parseDate,
    dateOnly: dateOnly, weekdays: WEEKDAYS
  };

  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  } else {
    root.OCCountdownCalc = api;
  }
}(typeof window !== 'undefined' ? window : this));
