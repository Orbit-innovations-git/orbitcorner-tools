/**
 * Time Card Calculator: the math.
 *
 * Pure functions, no DOM access. In the browser it is window.OCTimeCardCalc;
 * in Node it is module.exports (see tests/time-card.test.js).
 *
 *   compute(input) -> result
 *   input  = { days: [{ name, shifts: [{ in, out, nextDay, breakMin }] }],
 *              rate, otRule, otMultiplier, rounding, deductBreaks }
 *   result = { days: [{ name, minutes, shifts: [{ minutes, rawMinutes, start, error, field }], error }],
 *              totalMinutes, regularMinutes, overtimeMinutes, doubleMinutes, daysWorked,
 *              pay: null | { regular, overtime, double, gross }, warnings, hasErrors, ... }
 *
 * Times are 24-hour "HH:MM" strings, as <input type="time"> gives them. Durations are minutes.
 */
(function (root) {
  'use strict';

  var DAY = 1440;
  var WEEK_LIMIT = 2400; // 40 h a week: federal (FLSA) and California overtime.
  var DAY_LIMIT = 480; // 8 h a day: daily overtime.
  var DOUBLE_LIMIT = 720; // 12 h a day: California double time.
  var LONG_SHIFT = 960; // Warn about shifts over 16 h.
  var RULES = ['weekly', 'daily', 'california', 'none'];
  var FULL_DAY = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

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
    var m = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(text(value));
    if (!m || +m[1] > 23 || +m[2] > 59) {
      return NaN;
    }
    return +m[1] * 60 + +m[2];
  }

  /** Break -> whole minutes: "30", "0:30", "45m", "45 min", "1h", "1h 30m". Empty is 0, anything else NaN. */
  function parseBreak(value) {
    var t = text(value).toLowerCase();
    var n = NaN;
    var m;
    if (typeof value === 'number') {
      n = Math.floor(value) === value ? value : NaN;
    } else if (t === '') {
      n = 0;
    } else if (/^\d+$/.test(t)) {
      n = +t;
    } else if ((m = /^(\d+):([0-5]\d)$/.exec(t))) {
      n = +m[1] * 60 + +m[2];
    } else if ((m = /^(?:(\d+)\s*h(?:rs?|ours?)?)?\s*(?:(\d+)\s*m(?:in(?:ute)?s?)?)?$/.exec(t)) && (m[1] || m[2])) {
      n = (+m[1] || 0) * 60 + (+m[2] || 0);
    }
    return n >= 0 && n <= DAY ? n : NaN;
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
    var s = { minutes: 0, rawMinutes: 0, start: null, error: null, field: null };
    function fail(message, field) {
      s.minutes = 0;
      s.error = message;
      s.field = field;
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
    if (end === start) {
      return fail(MSG.same, 'out');
    }
    if (shift.nextDay === true) {
      end += DAY;
    } else if (end < start) {
      return fail(MSG.before, 'out');
    }
    s.start = start;
    s.rawMinutes = end - start;

    var net = s.rawMinutes;
    if (deduct) {
      var brk = parseBreak(shift.breakMin);
      if (isNaN(brk)) {
        return fail(MSG.breakText, 'break');
      }
      if (brk > net) {
        return fail(MSG.breakLong, 'break');
      }
      net -= brk;
    }
    s.minutes = roundMinutes(net, rounding);
    return s;
  }

  function compute(input) {
    input = input || {};
    var rule = RULES.indexOf(input.otRule) !== -1 ? input.otRule : 'weekly';
    var mult = Number(input.otMultiplier);
    var rounding = Number(input.rounding);
    var rate = parseRate(input.rate);
    var deduct = input.deductBreaks !== false;
    var days = Array.isArray(input.days) ? input.days : [];

    mult = mult >= 1 && mult <= 3 ? mult : 1.5;
    rounding = rounding >= 1 && rounding <= 60 && Math.floor(rounding) === rounding ? rounding : 0;

    var result = {
      days: [],
      totalMinutes: 0,
      regularMinutes: 0,
      overtimeMinutes: 0,
      doubleMinutes: 0,
      daysWorked: 0,
      otRule: rule,
      otMultiplier: mult,
      rate: rate > 0 ? rate : null,
      pay: null,
      warnings: [],
      hasErrors: false
    };
    var spans = [];

    days.forEach(function (day, d) {
      day = day || {};
      var name = text(day.name);
      var full = FULL_DAY[name] || name || 'Day ' + (d + 1);
      var row = { name: name, minutes: 0, shifts: [], error: null };
      var long = false;

      (Array.isArray(day.shifts) ? day.shifts : []).forEach(function (shift) {
        var s = computeShift(shift, deduct, rounding);
        row.shifts.push(s);
        row.minutes += s.minutes;
        if (s.error) {
          row.error = row.error || s.error;
          result.hasErrors = true;
        } else if (s.rawMinutes) {
          long = long || s.rawMinutes > LONG_SHIFT;
          spans.push({ day: full, start: d * DAY + s.start, end: d * DAY + s.start + s.rawMinutes });
        }
      });
      if (long) {
        result.warnings.push(full + ' has a shift over 16 hours. Check the times.');
      }

      var m = row.minutes;
      result.totalMinutes += m;
      result.daysWorked += m > 0 ? 1 : 0;
      if (rule === 'daily' || rule === 'california') {
        var reg = Math.min(m, DAY_LIMIT);
        var dbl = rule === 'california' ? Math.max(m - DOUBLE_LIMIT, 0) : 0;
        result.regularMinutes += reg;
        result.overtimeMinutes += m - reg - dbl;
        result.doubleMinutes += dbl;
      }
      result.days.push(row);
    });

    // Overlapping shifts would count the same time twice, including a night shift running into the next day.
    spans.sort(function (a, b) {
      return a.start - b.start;
    });
    var lastEnd = -1;
    spans.forEach(function (span) {
      var warning = span.day + ' has shifts that overlap. Check the times.';
      if (span.start < lastEnd && result.warnings.indexOf(warning) === -1) {
        result.warnings.push(warning);
      }
      lastEnd = Math.max(lastEnd, span.end);
    });

    var total = result.totalMinutes;
    if (rule === 'none') {
      result.regularMinutes = total;
    } else if (rule === 'weekly') {
      result.regularMinutes = Math.min(total, WEEK_LIMIT);
      result.overtimeMinutes = total - result.regularMinutes;
    } else if (rule === 'california' && result.regularMinutes > WEEK_LIMIT) {
      // Weekly overtime only on hours not already paid as daily overtime.
      result.overtimeMinutes += result.regularMinutes - WEEK_LIMIT;
      result.regularMinutes = WEEK_LIMIT;
    }

    if (result.rate) {
      var pay = {
        regular: cents(result.regularMinutes * rate / 60),
        overtime: cents(result.overtimeMinutes * rate * mult / 60),
        double: cents(result.doubleMinutes * rate * 2 / 60)
      };
      pay.gross = cents(pay.regular + pay.overtime + pay.double);
      result.pay = pay;
    }
    return result;
  }

  /* ---------- Formatting (US) ---------- */

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

  /** "15:30" -> "3:30 PM"; "" if not a time. */
  function formatTime(value) {
    var t = parseTime(value);
    if (isNaN(t)) {
      return '';
    }
    var h = Math.floor(t / 60);
    var m = t % 60;
    return ((h + 11) % 12 + 1) + ':' + (m < 10 ? '0' : '') + m + (h < 12 ? ' AM' : ' PM');
  }

  var api = {
    compute: compute,
    parseTime: parseTime,
    parseBreak: parseBreak,
    parseRate: parseRate,
    roundMinutes: roundMinutes,
    formatHours: formatHours,
    formatHM: formatHM,
    formatMoney: formatMoney,
    formatTime: formatTime,
    rules: RULES,
    messages: MSG
  };

  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  } else {
    root.OCTimeCardCalc = api;
  }
}(typeof window !== 'undefined' ? window : this));
