/**
 * Countdown & Date Tool: the interface. Enhances the HTML that countdown.php prints in each
 * [data-oc-tool="countdown"] (found by data-cd attributes, never rebuilt) and redoes the answer
 * in the visitor's time zone. Needs countdown-calc.js. All tools share one 1-second timer.
 */
(function () {
  'use strict';

  var MODES = ['time', 'date', 'from', 'between'];
  var KEYS = { time: ['t'], date: ['h', 'd', 'l'], from: ['n', 'biz', 'from'], between: ['start', 'end', 'inc'] }; // URL keys.
  var ticks = [];
  var timer = null;
  var urlTaken = false; // Only the first tool on a page reads the URL.

  function find(scope, name) {
    return scope.querySelector('[data-cd="' + name + '"]');
  }

  /** set(panel, { head: 'Time until 3:30 PM' }) sets the text of each named element. */
  function set(scope, texts, attr) {
    Object.keys(texts).forEach(function (name) {
      scope.querySelector('[' + (attr || 'data-cd') + '="' + name + '"]').textContent = texts[name];
    });
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function tickAll() {
    ticks.forEach(function (tick) {
      tick();
    });
  }

  /** Starts the timer just after a whole second, so the seconds change on time. */
  function start() {
    if (timer === null && !document.hidden && ticks.length) {
      timer = setTimeout(function () {
        timer = setInterval(tickAll, 1000);
        tickAll();
      }, 1010 - Date.now() % 1000);
    }
  }

  document.addEventListener('visibilitychange', function () {
    clearTimeout(timer);
    clearInterval(timer);
    timer = null;
    if (!document.hidden) {
      tickAll(); // Every value comes from the clock, so it is right at once.
      start();
    }
  });

  function mount(root, C) {
    var fake = Date.parse(root.getAttribute('data-oc-now') || ''); // Fake clock: tests/build-preview.php.
    var offset = fake ? Math.round((fake - Date.now()) / 1000) * 1000 : 0;
    var tabs = [].slice.call(root.querySelectorAll('[role="tab"]'));
    var intro = root.querySelector('[data-cd-intro]');
    var P = {};
    var mode;
    var lastTarget = 0; // Time mode: the moment counted to, kept 5 seconds after it passes.
    var lastMinute;
    var lastDay;
    var timers = {};

    MODES.forEach(function (m) {
      P[m] = root.querySelector('[data-cd-panel="' + m + '"]');
      mode = P[m] && !P[m].hidden ? m : mode;
    });

    function now() {
      return new Date(Math.floor((Date.now() + offset) / 1000) * 1000);
    }

    /** Shows or clears the error line under an input (the element with its id + "-err"). */
    function setError(input, message) {
      var err = document.getElementById(input.id + '-err');
      var ids = ((input.getAttribute('aria-describedby') || '').replace(err.id, '') + (message ? ' ' + err.id : '')).trim();
      err.textContent = message || '';
      err.hidden = !message;
      input[message ? 'setAttribute' : 'removeAttribute']('aria-invalid', 'true');
      input[ids ? 'setAttribute' : 'removeAttribute']('aria-describedby', ids);
    }

    function dateOf(p, name) {
      var d = C.parseDate(find(p, name).value);
      setError(find(p, name), !d && 'Enter a date');
      return d;
    }

    /** The counter boxes; the days box shows when asked to, or from one day up. */
    function counter(p, parts, showDays) {
      var boxes = p.querySelectorAll('[data-cd-u]');
      [parts.days, parts.hours, parts.minutes, parts.seconds].forEach(function (v, i) {
        boxes[i].textContent = i ? pad2(v) : C.formatNumber(v);
      });
      boxes[0].parentNode.hidden = !(showDays || parts.days);
    }

    /* Each mode fills its panel and returns { live, copy }, or null while an input is invalid. */
    var R = {
      time: function (p, t) {
        var tm = C.parseTime(find(p, 't').value);
        setError(find(p, 't'), !tm && 'Enter a time, like 3:30 PM');
        if (!tm) {
          return null;
        }
        var label = C.formatTime(tm.h, tm.m);
        var next = t - lastTarget >= 0 && t - lastTarget < 5000 ? null : C.nextOccurrence(t, tm.h, tm.m);
        var parts = C.diff(t, next ? next.target : t);
        var party = !parts.totalMs; // Just reached: "It's 3:30 PM!" for 5 seconds, then tomorrow's.
        var at = party ? '' : C.formatTime(next.target.getHours(), next.target.getMinutes()) + (next.isTomorrow ? ' tomorrow' : ' today');
        var pct = Math.floor(C.dayProgress(t) * 100) + '%';
        lastTarget = next ? +next.target : lastTarget;
        counter(p, parts);
        find(p, 'bar').style.width = pct;
        find(p, 'at').classList.toggle('is-now', party);
        set(p, {
          head: 'Time until ' + label, pre: party ? '' : 'That\'s at ', when: party ? 'It\'s ' + label + '!' : at,
          post: party ? '' : next.isTomorrow ? ', ' + C.formatDate(next.target, 'long') + '.' : '.', pct: pct + ' of today is done'
        });
        return party ? { live: 'It\'s ' + label, copy: 'It\'s ' + label + '!' } :
          { live: C.describe(parts, true) + ' until ' + label, copy: C.describe(parts, true) + ' until ' + at + ' (' + C.formatDate(next.target, 'long') + ')' };
      },

      date: function (p, t) {
        var hol = find(p, 'h').value && C.nextHoliday(t, find(p, 'h').value);
        if (hol) {
          find(p, 'd').value = C.iso(hol.date); // Moves on to next year's once the day is over.
        }
        var d = dateOf(p, 'd');
        if (!d) {
          return null;
        }
        var name = find(p, 'l').value.trim();
        var label = name || C.formatDate(d, 'short');
        var days = C.daysBetween(t, d);
        var parts = C.diff(t, days ? new Date(d.getFullYear(), d.getMonth(), d.getDate()) : t);
        var ago = C.plural(-days, 'day') + ' ago';
        var text = days > 0 ? C.plural(days, 'day') + ' until ' + label : days ? label + ' was ' + ago : 'Today is ' + label;
        var next = C.addMonths(d, 12 * Math.max(0, t.getFullYear() - d.getFullYear())); // For "Count to Christmas 2027".
        var button = p.querySelector('[data-cd-act="next"]');
        next = C.daysBetween(t, next) < 0 ? C.addMonths(next, 12) : next;
        counter(p, parts, true);
        find(p, 'line').parentNode.classList.toggle('is-now', !days);
        set(p, {
          head: (days < 0 ? 'Time since ' : 'Time until ') + label,
          date: C.formatDate(d, 'long') + (hol && hol.approx ? ' (approximately)' : ''),
          line: days > 0 ? ' · that\'s ' + C.plural(days, 'day') + (days >= 7 ? ', or ' + C.weeksDays(days) : '') : days ? ' · that was ' + ago : ' · that\'s today!',
          doy: 'Day ' + C.dayOfYear(d) + ' of the year'
        });
        button.hidden = days >= 0;
        button.textContent = 'Count to ' + (name ? name + ' ' + next.getFullYear() : C.formatDate(next, 'short'));
        button.setAttribute('data-d', C.iso(next));
        return { live: days > 0 ? C.describe(parts, true) + ' until ' + label : text, copy: text + ' (' + C.formatDate(d, 'long') + ')' };
      },

      from: function (p, t) {
        var raw = find(p, 'n').value.replace(/[\s,]/g, '').replace(/^[−–]/, '-');
        var n = /^[-+]?\d+$/.test(raw) ? +raw : NaN;
        var from = dateOf(p, 'from');
        setError(find(p, 'n'), raw === '' ? 'Enter a number of days, like 30' : isNaN(n) ? 'Enter a whole number, like 30' : Math.abs(n) > 10000 && 'Enter a number up to 10,000');
        if (!(Math.abs(n) <= 10000) || !from) {
          return null;
        }
        var biz = { businessDays: find(p, 'biz').checked };
        var unit = C.plural(Math.abs(n), biz.businessDays ? 'business day' : 'day');
        var today = !C.daysBetween(t, from);
        var fwd = C.addDays(from, Math.abs(n), biz);
        var back = C.addDays(from, -Math.abs(n), biz);
        var main = n < 0 ? back : fwd;
        var span = Math.abs(C.daysBetween(from, main));
        var ahead = unit + ' from ' + (today ? 'today' : C.formatDate(from, 'short'));
        var ago = today ? unit + ' ago' : unit + ' before ' + C.formatDate(from, 'short');
        var first = (n < 0 ? ago + (today ? ' was ' : ' is ') : ahead + ' is ') + C.formatDate(main, 'short') + '.';
        set(p, {
          head: n < 0 ? ago : ahead,
          big: C.formatDate(main, 'long'),
          line: first + (span < 7 ? '' : ' That\'s ' + (biz.businessDays ? C.plural(span, 'calendar day') + ', or ' : '') + C.weeksDays(span) + '.'),
          other: (n < 0 ? ahead + ' is ' + C.formatDate(fwd, 'long') : ago + (today ? ' was ' : ' is ') + C.formatDate(back, 'long')) + '.',
          small: 'Week ' + C.weekNumber(main) + ' · Day ' + C.dayOfYear(main) + ' of the year'
        });
        return { live: first, copy: first + ' ' + find(p, 'other').textContent };
      },

      between: function (p) {
        var s = dateOf(p, 'start');
        var e = dateOf(p, 'end');
        if (!s || !e) {
          return null;
        }
        var r = C.between(s, e, { includeEnd: find(p, 'inc').checked });
        var ymd = [[r.years, 'year'], [r.yearMonths, 'month'], [r.remMonthsDays, 'day']].filter(function (x) {
          return x[0];
        }).map(function (x) {
          return C.plural(x[0], x[1]);
        });
        var span = C.formatDate(s, 'short') + ' to ' + C.formatDate(e, 'short');
        find(p, 'back').hidden = !r.backwards;
        set(p, {
          head: 'From ' + span,
          big: C.plural(r.days, 'day'),
          line: [C.weeksDays(r.days)].concat(r.months ? C.joinAnd(ymd) : [], C.plural(r.days * 24, 'hour')).join(' · '),
          share: 'That\'s ' + (r.days < 365 ? Math.round(r.days / 365 * 100) + '% of a year.' : 'about ' + C.plural(Math.round(r.days / 36.525) / 10, 'year') + '.')
        });
        return { live: C.plural(r.days, 'day') + ' from ' + span, copy: C.plural(r.days, 'day') + ' from ' + span + ': ' + find(p, 'line').textContent };
      }
    };

    function render(changed) {
      var t = now();
      var p = P[mode];
      var r = R[mode](p, t);
      var minute = Math.floor(t / 6e4);
      p.querySelector('[data-cd-ans]').classList.toggle('is-stale', !r);
      if (changed || (r && minute !== lastMinute && p.querySelector('[data-cd-u]'))) {
        // Only the headline: once typing pauses, and once a minute while a counter runs.
        lastMinute = minute;
        clearTimeout(timers.live);
        timers.live = setTimeout(function () {
          if (r && find(root, 'live').textContent !== r.live) {
            find(root, 'live').textContent = r.live;
          }
        }, changed ? 600 : 0);
      }
      return r;
    }

    /** Focused pages: the dates in the paragraph under the tool, as countdown.php prints it. */
    function renderIntro(t) {
      var n = +intro.getAttribute('data-n');
      var d = n ? C.addDays(t, n) : intro.getAttribute('data-h') ? C.nextHoliday(t, intro.getAttribute('data-h')).date : C.parseDate(intro.getAttribute('data-d'));
      var days = C.daysBetween(t, d);
      set(intro, n ? { f: C.formatDate(d, 'medium'), w: C.weekdays[d.getDay()], b: C.formatDate(C.addDays(t, -n), 'medium'), z: C.formatDate(C.addDays(t, n, { businessDays: true }), 'medium') } : {
        d: C.formatDate(d, 'long'),
        n: days ? C.plural(Math.abs(days), 'day') + (days > 0 ? ' from today' : ' ago') : 'today',
        w: days >= 14 ? ', or about ' + C.plural(Math.round(days / 7), 'week') : ''
      }, 'data-cd-i');
    }

    /** Every second: a live counter; otherwise only when the date changes. */
    function tick() {
      var t = now();
      var newDay = C.iso(t) !== lastDay;
      lastDay = C.iso(t);
      if (newDay && intro) {
        renderIntro(t);
      }
      if (newDay || mode === 'time' || mode === 'date') {
        render(false);
      }
    }

    function show(m) {
      mode = m;
      tabs.forEach(function (tab) {
        var on = tab.getAttribute('data-cd-tab') === m;
        tab.setAttribute('aria-selected', on);
        tab.tabIndex = on ? 0 : -1;
        P[tab.getAttribute('data-cd-tab')].hidden = !on;
      });
    }

    function changed() {
      lastTarget = 0;
      render(true);
    }

    /* ---------- Copy and Share ---------- */

    function status(p, text) {
      clearTimeout(timers.status);
      find(p, 'status').textContent = text;
      timers.status = setTimeout(function () {
        find(p, 'status').textContent = '';
      }, 2500);
    }

    /** Copies text, or shows it in a box to copy by hand when the browser won't. */
    function copy(p, text, done) {
      function showBox() {
        find(p, 'fallback').hidden = false;
        find(p, 'copy').value = text;
        find(p, 'copy').select();
      }
      if (navigator.clipboard) { // Missing on http:// pages.
        navigator.clipboard.writeText(text).then(function () {
          find(p, 'fallback').hidden = true;
          status(p, done);
        }, showBox);
      } else {
        showBox();
      }
    }

    /** This mode's inputs as a link; a holiday's date and today's date stay out, so they stay current. */
    function shareUrl(p) {
      var q = new URLSearchParams({ mode: mode });
      var h = find(p, 'h');
      KEYS[mode].forEach(function (k) {
        var el = find(p, k);
        var v = el.type === 'checkbox' ? (el.checked ? '1' : '') : el.value.trim();
        if (v && !(h && h.value && (k === 'd' || v === h.options[h.selectedIndex].text)) && !((k === 'from' || k === 'start') && v === C.iso(now()))) {
          q.set(k, v);
        }
      });
      return location.protocol + '//' + location.host + location.pathname + '?' + q + location.hash;
    }

    /** Restores a shared link. Date, time and select inputs reject bad values; others are put back. */
    function readUrl() {
      var q = new URLSearchParams(location.search);
      var h = P.date && find(P.date, 'h');
      var hOk;
      mode = MODES.indexOf(q.get('mode')) !== -1 && P[q.get('mode')] ? q.get('mode') : mode;
      MODES.forEach(function (m) {
        (P[m] ? KEYS[m] : []).forEach(function (k) {
          var el = find(P[m], k);
          var v = q.get(k);
          var old = el.value;
          var tm = k === 't' && C.parseTime(v);
          if (v !== null && el.type === 'checkbox') {
            el.checked = v === '1' || (el.checked && v !== '0');
          } else if (v !== null) {
            el.value = tm ? pad2(tm.h) + ':' + pad2(tm.m) : v.trim();
            if ((!tm && el.value !== v.trim()) || v.length > 40 || (k === 'n' && !(/^-?\d{1,5}$/.test(v) && Math.abs(v) <= 10000))) {
              el.value = old;
            }
          }
        });
      });
      // A valid holiday wins; otherwise a valid date is a custom date. The name follows unless given.
      hOk = h && h.value && h.value === q.get('h');
      if (h && (hOk || (q.get('d') && find(P.date, 'd').value === q.get('d')))) {
        h.value = hOk ? h.value : '';
        find(P.date, 'l').value = q.get('l') ? find(P.date, 'l').value : h.value ? h.options[h.selectedIndex].text : '';
      }
    }

    /* ---------- Events ---------- */

    root.addEventListener('input', onInput);
    root.addEventListener('change', onInput);
    function onInput(e) {
      var name = e.target.getAttribute('data-cd');
      var hol = name === 'h' && e.target.value && C.nextHoliday(now(), e.target.value);
      if (name === 'd') {
        find(P.date, 'h').value = ''; // A date picked by hand is no longer the holiday.
      }
      if (hol) {
        find(P.date, 'd').value = C.iso(hol.date);
        find(P.date, 'l').value = hol.name;
      }
      if (name !== 'copy') {
        changed();
      }
    }

    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cd-act]');
      var act = b && b.getAttribute('data-cd-act');
      var p = P[mode];
      var r;
      if (act === 'tab') {
        show(b.getAttribute('data-cd-tab'));
      } else if (act === 'pick') {
        find(p, 't').value = b.getAttribute('data-cd-pick');
      } else if (act === 'plus' || act === 'minus') {
        r = parseInt(find(p, 'n').value.replace(/[\s,]/g, ''), 10) || 0;
        find(p, 'n').value = Math.max(-10000, Math.min(10000, r + (act === 'plus' ? 1 : -1)));
      } else if (act === 'next') {
        find(p, 'd').value = b.getAttribute('data-d');
        find(p, 'd').focus(); // The button is about to hide.
      } else if (act) {
        r = render(false);
        if (!r || act === 'copy') {
          return r ? copy(p, r.copy, 'Copied') : status(p, 'Fix the highlighted field first.');
        }
        r = shareUrl(p);
        try {
          window.history.replaceState(window.history.state, '', r);
        } catch (err) {
          // Blocked in some embedded browsers; the link is still shared.
        }
        return navigator.share && window.matchMedia('(pointer: coarse)').matches ?
          navigator.share({ title: document.title, url: r }).then(null, function () {}) : copy(p, r, 'Link copied');
      }
      if (act) {
        changed();
      }
    });

    root.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(e.target);
      var to = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (i !== -1 && to !== undefined) {
        e.preventDefault();
        to = tabs[(to + tabs.length) % tabs.length];
        to.focus();
        show(to.getAttribute('data-cd-tab'));
        changed();
      } else if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        e.preventDefault(); // Never submits a form the theme may wrap around the tool.
      }
    });

    // Dates printed as Eastern "today" become the visitor's today; a shared link may then change them.
    [].forEach.call(root.querySelectorAll('[data-cd-def]'), function (input) {
      input.value = C.iso(input.getAttribute('data-cd-def') === 'eoy' ? new Date(now().getFullYear(), 11, 31) : now());
    });
    if (!urlTaken && typeof URLSearchParams === 'function') {
      readUrl();
    }
    urlTaken = true;
    if (tabs.length) {
      show(mode);
    }
    try {
      set(root, { tz: 'Times are in your time zone (' + Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ') + ').' });
    } catch (err) {
      set(root, { tz: 'Times are in your time zone.' });
    }
    lastDay = C.iso(now());
    if (intro) {
      renderIntro(now());
    }
    render(true);
    return tick;
  }

  function mountAll() {
    var roots = document.querySelectorAll('[data-oc-tool="countdown"]:not([data-oc-mounted])');
    for (var i = 0; window.OCCountdownCalc && i < roots.length; i++) {
      roots[i].setAttribute('data-oc-mounted', '1');
      try {
        ticks.push(mount(roots[i], window.OCCountdownCalc));
      } catch (err) {
        // The printed tool and its Eastern Time answer stay as they are.
        if (window.console) {
          window.console.error('[OrbitCorner Tools] countdown:', err);
        }
      }
    }
    start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAll);
  } else {
    mountAll();
  }
}());
