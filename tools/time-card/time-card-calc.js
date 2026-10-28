/**
 * Time Card Calculator: the math, with no DOM access. window.OCTimeCardCalc in the browser,
 * module.exports in Node. Durations are minutes; times are 24-hour "HH:MM" strings.
 * Input and result shapes are in README.md.
 */
(function (root) {
  'use strict';

  var DAY = 1440;
  var WEEK_LIMIT = 2400; // 40 h a week: federal (FLSA) and California overtime.
  var DAY_LIMIT = 480; // 8 h a day: daily overtime.
  var DOUBLE_LIMIT = 720; // 12 h a day: California double time.
  var RULES = ['weekly', 'daily', 'california', 'none'];
  var DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var MSG = {
    time: 'Enter a time, like 9:00 AM',
    same: 'End time must be after start time',
    before: 'End time must be after start time. For a night shift, tick "Ends the next day".',
    breakText: 'Enter minutes, like 30',
    breakLong: 'Break can\'t be longer than the shift',
    rate: 'Enter an amount, like 18.50'
  };

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  /** Money and hours to 2 decimals, without float noise (137.475 -> 137.48). */
  function cents(n) {
    return Math.round(Number((n * 100).toPrecision(12))) / 100;
  }

  /** "09:00" or "9:05:30" -> minutes after midnight; NaN if not a time. */
  function parseTime(value) {
    var m = /^(\d{1,2}):(\d\d)(?::\d\d)?$/.exec(text(value));
    return m && +m[1] < 24 && +m[2] < 60 ? m[1] * 60 + +m[2] : NaN;
  }

  /** Break -> whole minutes: "30", "0:30", "45m", "45 min". Empty is 0, anything else NaN. */
  function parseBreak(value) {
    var t = text(value).toLowerCase();
    var m = /^(\d+)(?::([0-5]\d)|\s*m(?:in(?:ute)?s?)?)?$/.exec(t);
    var n = typeof value === 'number' ? value : t === '' ? 0 : m ? (m[2] ? m[1] * 60 + +m[2] : +m[1]) : NaN;
    return n >= 0 && n <= DAY && Math.floor(n) === n ? n : NaN;
  }

  /** Hourly rate: "20", "20.50", "$20", "$1,250". Empty is null, anything else NaN. */
  function parseRate(value) {
    var t = typeof value === 'number' ? String(value) : text(value).replace(/[\s,]/g, '').replace(/^\$/, '');
    if (t === '') {
      return null;
    }
    return /^(\d+\.?\d*|\.\d+)$/.test(t) && +t <= 1000000 ? +t : NaN;
  }

  /** To the nearest interval; exactly half rounds up. 0 = no rounding. */
  function roundMinutes(minutes, interval) {
    if (!(interval > 0)) {
      return minutes;
    }
    var rest = minutes % interval;
    return rest * 2 >= interval ? minutes - rest + interval : minutes - rest;
  }

  function computeShift(shift, deduct, rounding) {
    var s = { minutes: 0, rawMinutes: 0, error: null, field: null };
    function fail(message, field) {
      s.error = message;
      s.field = field; // The input to show the message under: 'in', 'out' or 'breakMin'.
      return s;
    }

    shift = shift || {};
    if (text(shift['in']) === '' || text(shift.out) === '') {
      return s; // Not filled in yet: ignored, not an error.
    }
    var start = parseTime(shift['in']);
    var end = parseTime(shift.out);
    if (isNaN(start) || isNaN(end)) {
      return fail(MSG.time, isNaN(start) ? 'in' : 'out');
    }
    if (end === start || (end < start && shift.nextDay !== true)) {
      return fail(end === start ? MSG.same : MSG.before, 'out');
    }
    s.rawMinutes = end - start + (shift.nextDay === true ? DAY : 0);

    var brk = deduct ? parseBreak(shift.breakMin) : 0;
    if (isNaN(brk) || brk > s.rawMinutes) {
      return fail(isNaN(brk) ? MSG.breakText : MSG.breakLong, 'breakMin');
    }
    s.minutes = roundMinutes(s.rawMinutes - brk, rounding);
    return s;
  }

  function compute(input) {
    input = input || {};
    var rule = RULES.indexOf(input.otRule) !== -1 ? input.otRule : 'weekly';
    var mult = Number(input.otMultiplier);
    var rounding = Number(input.rounding);
    var rate = parseRate(input.rate);
    var deduct = input.deductBreaks !== false;
    var r = {
      days: [], totalMinutes: 0, regularMinutes: 0, overtimeMinutes: 0, doubleMinutes: 0, daysWorked: 0,
      otRule: rule, otMultiplier: mult >= 1 && mult <= 3 ? mult : 1.5, rate: rate > 0 ? rate : null,
      pay: null, warnings: [], hasErrors: false
    };
    rounding = rounding >= 1 && rounding <= 60 && Math.floor(rounding) === rounding ? rounding : 0;

    (Array.isArray(input.days) ? input.days : []).forEach(function (day, d) {
      day = day || {};
      var name = text(day.name);
      var full = DAYS.filter(function (n) {
        return n.slice(0, 3) === name;
      })[0] || name || 'Day ' + (d + 1);
      var row = { name: name, minutes: 0, shifts: [], error: null };
      var long = false;

      (Array.isArray(day.shifts) ? day.shifts : []).forEach(function (shift) {
        var s = computeShift(shift, deduct, rounding);
        row.shifts.push(s);
        row.minutes += s.minutes;
        row.error = row.error || s.error;
        long = long || (!s.error && s.rawMinutes > 960);
      });
      if (long) {
        r.warnings.push(full + ' has a shift over 16 hours. Check the times.');
      }

      var m = row.minutes;
      r.hasErrors = r.hasErrors || !!row.error;
      r.totalMinutes += m;
      r.daysWorked += m > 0 ? 1 : 0;
      if (rule === 'daily' || rule === 'california') {
        var reg = Math.min(m, DAY_LIMIT);
        var dbl = rule === 'california' ? Math.max(m - DOUBLE_LIMIT, 0) : 0;
        r.regularMinutes += reg;
        r.overtimeMinutes += m - reg - dbl;
        r.doubleMinutes += dbl;
      }
      r.days.push(row);
    });

    if (rule === 'none') {
      r.regularMinutes = r.totalMinutes;
    } else if (rule === 'weekly') {
      r.regularMinutes = Math.min(r.totalMinutes, WEEK_LIMIT);
      r.overtimeMinutes = r.totalMinutes - r.regularMinutes;
    } else if (rule === 'california' && r.regularMinutes > WEEK_LIMIT) {
      // Weekly overtime only on hours not already paid as daily overtime.
      r.overtimeMinutes += r.regularMinutes - WEEK_LIMIT;
      r.regularMinutes = WEEK_LIMIT;
    }

    if (r.rate) {
      r.pay = {
        regular: cents(r.regularMinutes * rate / 60),
        overtime: cents(r.overtimeMinutes * rate * r.otMultiplier / 60),
        double: cents(r.doubleMinutes * rate * 2 / 60)
      };
      r.pay.gross = cents(r.pay.regular + r.pay.overtime + r.pay.double);
    }
    return r;
  }

  /* ---------- US formats ---------- */

  function fixed2(n) {
    var parts = cents(n).toFixed(2).split('.');
    return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + parts[1];
  }

  /** 2550 -> "42.50" */
  function formatHours(minutes) {
    return fixed2(minutes / 60);
  }

  /** 2550 -> "42 h 30 m", 480 -> "8 h", 45 -> "45 m" */
  function formatHM(minutes) {
    var h = Math.floor(minutes / 60);
    var m = Math.round(minutes - h * 60);
    return m && !h ? m + ' m' : h + ' h' + (m ? ' ' + m + ' m' : '');
  }

  /** 1234.5 -> "$1,234.50" */
  function formatMoney(n) {
    return '$' + fixed2(n);
  }

  function pad2(n) {
    return ('0' + n).slice(-2);
  }

  /** "15:30" -> "3:30 PM"; "" if not a time. */
  function formatTime(value) {
    var t = parseTime(value);
    var h = Math.floor(t / 60);
    return isNaN(t) ? '' : ((h + 11) % 12 + 1) + ':' + pad2(t % 60) + (h < 12 ? ' AM' : ' PM');
  }

  /* ---------- Share links: one day <-> "0900-1700-30.1800-2200" ---------- */

  /** Shifts [{ in, out, breakMin }] -> URL value; shifts with no times are left out. */
  function encodeDay(shifts) {
    return (shifts || []).map(function (s) {
      var times = [s['in'], s.out].map(function (value) {
        var t = parseTime(value);
        return isNaN(t) ? '' : pad2(Math.floor(t / 60)) + pad2(t % 60);
      });
      var brk = parseBreak(s.breakMin);
      return times[0] || times[1] ? times.join('-') + (brk > 0 ? '-' + brk : '') : '';
    }).filter(Boolean).join('.');
  }

  /** URL value -> up to 2 shifts [{ in, out, breakMin }]; invalid parts become empty. */
  function decodeDay(value) {
    return text(value).split('.').slice(0, 2).map(function (part) {
      var p = part.split('-');
      var times = [p[0], p[1]].map(function (t) {
        t = /^\d{4}$/.test(t) ? t.slice(0, 2) + ':' + t.slice(2) : '';
        return isNaN(parseTime(t)) ? '' : t;
      });
      var brk = parseBreak(p[2] || '');
      return { 'in': times[0], out: times[1], breakMin: brk > 0 ? String(brk) : '' };
    }).filter(function (s) {
      return s['in'] || s.out;
    });
  }

  var api = {
    compute: compute, parseTime: parseTime, parseBreak: parseBreak, parseRate: parseRate, roundMinutes: roundMinutes,
    formatHours: formatHours, formatHM: formatHM, formatMoney: formatMoney, formatTime: formatTime,
    encodeDay: encodeDay, decodeDay: decodeDay, rules: RULES, days: DAYS, messages: MSG
  };

  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  } else {
    root.OCTimeCardCalc = api;
  }
}(typeof window !== 'undefined' ? window : this));
