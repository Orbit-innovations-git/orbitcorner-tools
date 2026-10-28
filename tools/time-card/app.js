/**
 * Time Card Calculator: the interface. Enhances the form that tools/time-card/time-card.php
 * prints in each [data-oc-tool="time-card"] container (found by data-tc attributes, never
 * rebuilt). Needs time-card-calc.js loaded first.
 */
(function () {
  'use strict';

  var KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  var FIELDS = ['in', 'out', 'breakMin'];
  var SETTINGS = ['rate', 'ot', 'otx', 'rd', 'br', 'wk']; // data-tc names, also the URL keys.
  var urlTaken = false; // Only the first time card on a page reads and writes the URL.

  /** "2026-10-26" -> "Oct 26, 2026" */
  function longDate(iso) {
    return iso ? new Date(iso + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  }

  function todayIso() {
    var d = new Date();
    return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  /** One CSV cell; text can never run as a spreadsheet formula. */
  function csvCell(value) {
    value = String(value).replace(/^[=+\-@\t\r]/, '\'$&');
    return /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
  }

  function find(scope, attr, name) {
    return scope.querySelector('[' + attr + '="' + name + '"]');
  }

  function mount(root, calc) {
    var NAMES = calc.days;
    var useUrl = !urlTaken && typeof URLSearchParams === 'function';
    var el = {};
    var timers = {};
    var good = null; // The last result without errors, for Copy, Share and CSV.
    urlTaken = true;

    SETTINGS.concat('sum name bar result total sub stale xlabel warn note status fallback copy live gen'.split(' ')).forEach(function (key) {
      el[key] = find(root, 'data-tc', key);
    });

    var days = KEYS.map(function (key, d) {
      var body = find(root, 'data-tc-day', d);
      var day = { mini: find(root, 'data-tc-mini', d), hours: body.querySelector('.oc-tc-hours') };
      ['add', 'remove', 'dec', 'hm'].forEach(function (f) {
        day[f] = find(body, 'data-tc-f', f);
      });
      day.shifts = [].map.call(body.querySelectorAll('.oc-tc-shift'), function (row) {
        var sh = { row: row };
        FIELDS.concat('next', 'wrap', 'hint').forEach(function (f) {
          sh[f] = find(row, 'data-tc-f', f);
        });
        return sh;
      });
      day.second = !!(day.shifts[1]['in'].value || day.shifts[1].out.value);
      return day;
    });

    function shiftsOf(day) {
      return day.shifts.slice(0, day.second ? 2 : 1).map(function (sh) {
        return { 'in': sh['in'].value, out: sh.out.value, breakMin: sh.breakMin.value, nextDay: !sh.wrap.hidden && sh.next.checked };
      });
    }

    /** The overtime multiplier, or NaN unless it is 1 to 3. */
    function otx() {
      var x = el.otx.value && Number(el.otx.value);
      return x >= 1 && x <= 3 ? x : NaN;
    }

    /** "Weekly overtime over 40 h · No rounding · $20/h" (time-card.php prints the same). */
    function summary() {
      var rate = calc.parseRate(el.rate.value);
      var parts = [
        el.ot.options[el.ot.selectedIndex].getAttribute('data-short') + (el.ot.value !== 'none' && otx() && otx() !== 1.5 ? ' at ' + otx() + '×' : ''),
        +el.rd.value ? el.rd.value + '-min rounding' : 'No rounding',
        rate > 0 ? calc.formatMoney(rate).replace(/\.00$/, '') + '/h' : 'No hourly rate'
      ];
      return parts.concat(el.br.checked ? [] : 'Breaks not deducted').join(' · ');
    }

    /** [row, label, value] for the result card, Copy and CSV; value is '' on zero lines. */
    function totals(r) {
      var p = r.pay || {};
      return [
        ['reg', 'Regular hours', r.regularMinutes],
        ['ot', 'Overtime hours (×' + r.otMultiplier + ')', r.overtimeMinutes],
        ['dbl', 'Double-time hours (×2)', r.doubleMinutes],
        ['regPay', 'Regular pay', p.regular, 1],
        ['otPay', 'Overtime pay', p.overtime, 1],
        ['dblPay', 'Double-time pay', p.double, 1],
        ['gross', 'Gross pay', p.gross, 1]
      ].map(function (t) {
        return [t[0], t[1], t[2] ? (t[3] ? calc.formatMoney : calc.formatHours)(t[2]) : ''];
      });
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

    /** Shows "Ends the next day" when End is before Start, ticked the first time it appears. */
    function syncNext(sh) {
      var night = calc.parseTime(sh.out.value) < calc.parseTime(sh['in'].value);
      if (night && sh.wrap.hidden) {
        sh.next.checked = true;
      }
      sh.wrap.hidden = !night;
      sh.hint.hidden = !(night && sh.next.checked);
    }

    function showResult(r) {
      var n = r.daysWorked;
      el.total.textContent = calc.formatHours(r.totalMinutes);
      el.bar.textContent = el.total.textContent + ' hours';
      el.sub.textContent = n ? calc.formatHM(r.totalMinutes) + ' across ' + n + (n === 1 ? ' day' : ' days') : 'Enter your start and end times.';
      el.xlabel.textContent = r.otMultiplier;
      totals(r).forEach(function (t) {
        var row = find(el.result, 'data-tc-line', t[0]);
        row.hidden = !t[2];
        row.cells[1].textContent = t[2];
      });
      r.days.forEach(function (rd, d) {
        days[d].mini.hidden = !rd.minutes;
        days[d].mini.lastChild.textContent = calc.formatHours(rd.minutes);
      });
      el.warn.hidden = !r.warnings.length;
      el.warn.textContent = r.warnings.join(' ');
    }

    function update(changed) {
      days.forEach(function (day) {
        day.shifts[1].row.hidden = !day.second;
        day.add.hidden = day.second;
        day.remove.hidden = !day.second;
        day.shifts.forEach(syncNext);
      });

      var r = calc.compute({
        days: days.map(function (day, d) {
          return { name: NAMES[d], shifts: shiftsOf(day) };
        }),
        rate: el.rate.value,
        otRule: el.ot.value,
        otMultiplier: el.otx.value,
        rounding: el.rd.value,
        deductBreaks: el.br.checked
      });
      var rateBad = isNaN(calc.parseRate(el.rate.value));
      var bad = r.hasErrors || rateBad || isNaN(otx());
      setError(el.rate, rateBad && calc.messages.rate);
      setError(el.otx, isNaN(otx()) && 'Enter 1 to 3, like 1.5');

      r.days.forEach(function (rd, d) {
        var day = days[d];
        var ok = rd.minutes > 0 && !rd.error;
        day.shifts.forEach(function (sh, s) {
          var res = rd.shifts[s] || {};
          FIELDS.forEach(function (f) {
            setError(sh[f], res.field === f && res.error);
          });
        });
        day.dec.textContent = ok ? calc.formatHours(rd.minutes) : '—';
        day.hm.textContent = ok ? calc.formatHM(rd.minutes) : '';
        day.hours[ok ? 'setAttribute' : 'removeAttribute']('title', day.hm.textContent);
      });

      el.stale.hidden = !bad;
      el.result.classList.toggle('is-stale', bad);
      el.sum.textContent = summary();
      if (!bad) {
        good = r;
        showResult(r);
      }
      if (changed) {
        // Only the headline, once typing pauses.
        clearTimeout(timers.live);
        timers.live = setTimeout(function () {
          el.live.textContent = bad ? '' : 'Total this week: ' + el.total.textContent + ' hours';
        }, 600);
        writeUrl();
      }
    }

    /* ---------- Share links (format in README.md) ---------- */

    /** A setting as URL text: its value now, or (initial) as the page printed it. */
    function setting(key, initial) {
      var input = el[key];
      if (input.type === 'checkbox') {
        return String(+(initial ? input.defaultChecked : input.checked));
      }
      return !initial ? input.value : input.options ? input.querySelector('[selected]').value : input.defaultValue;
    }

    function readUrl() {
      var p = new URLSearchParams(window.location.search);
      if (KEYS.some(function (key) {
        return p.has(key);
      })) {
        days.forEach(function (day, d) {
          var shifts = calc.decodeDay(p.get(KEYS[d]));
          day.second = shifts.length > 1;
          day.shifts.forEach(function (sh, s) {
            FIELDS.forEach(function (f) {
              sh[f].value = (shifts[s] || {})[f] || '';
            });
            sh.wrap.hidden = true; // syncNext() ticks night shifts again.
          });
        });
      }
      // A valid setting replaces the page's default; an invalid one is ignored.
      SETTINGS.forEach(function (key) {
        var v = p.get(key);
        var input = el[key];
        var old = input.value;
        if (input.type === 'checkbox') {
          input.checked = /^[01]$/.test(v) ? v === '1' : input.checked;
        } else if (v !== null) {
          input.value = v;
          if (input.value !== v || isNaN(calc.parseRate(el.rate.value)) || isNaN(otx())) {
            input.value = old;
          }
        }
      });
    }

    /** Keeps every input except the name in the URL, so a shared link restores the same week. */
    function writeUrl() {
      if (!useUrl) {
        return;
      }
      var p = new URLSearchParams(window.location.search);
      var week = '';
      KEYS.concat(SETTINGS).forEach(function (key) {
        p['delete'](key);
      });
      days.forEach(function (day, d) {
        var value = calc.encodeDay(shiftsOf(day));
        if (value) {
          p.set(KEYS[d], value);
          week += value;
        }
      });
      if (!week) {
        p.set('mon', ''); // An empty week, not the default one.
      }
      SETTINGS.forEach(function (key) {
        if (setting(key) !== setting(key, true)) {
          p.set(key, setting(key));
        }
      });
      try {
        window.history.replaceState(window.history.state, '', window.location.pathname + '?' + p + window.location.hash);
      } catch (e) {
        // Blocked in some embedded browsers; nothing else depends on it.
      }
    }

    /* ---------- Copy and CSV ---------- */

    function header() {
      var name = el.name.value.trim();
      var week = longDate(el.wk.value);
      return ['Time card' + (week ? ', week of ' + week : '')].concat(name ? 'Name: ' + name : []);
    }

    function plainText(r) {
      var out = header();
      r.days.forEach(function (rd, d) {
        if (rd.minutes) {
          out.push(NAMES[d] + ': ' + calc.formatHours(rd.minutes) + ' h');
        }
      });
      out.push('Total: ' + calc.formatHours(r.totalMinutes) + ' hours (' + calc.formatHM(r.totalMinutes) + ')');
      totals(r).forEach(function (t) {
        if (t[2]) {
          out.push(t[1] + ': ' + t[2]);
        }
      });
      return out.concat('Settings: ' + summary(), el.note.textContent).join('\n');
    }

    function csv(r) {
      var rows = header().map(function (line) {
        return [line];
      });
      rows.push([], ['Day', 'Shift', 'Start', 'End', 'Ends next day', 'Break (min)', 'Hours']);
      days.forEach(function (day, d) {
        shiftsOf(day).forEach(function (s, i) {
          if (s['in'] && s.out) {
            rows.push([NAMES[d], i + 1, calc.formatTime(s['in']), calc.formatTime(s.out), s.nextDay ? 'Yes' : 'No',
              el.br.checked && calc.parseBreak(s.breakMin) || 0, calc.formatHours(r.days[d].shifts[i].minutes)]);
          }
        });
      });
      rows.push([], ['Total hours', calc.formatHours(r.totalMinutes)]);
      totals(r).forEach(function (t) {
        if (t[2]) {
          rows.push(t.slice(1));
        }
      });
      rows.push(['Settings', summary()]);
      return rows.map(function (row) {
        return row.map(csvCell).join(',');
      }).join('\r\n') + '\r\n';
    }

    /* ---------- Buttons ---------- */

    function setStatus(text) {
      clearTimeout(timers.status);
      el.status.textContent = text;
      timers.status = setTimeout(function () {
        el.status.textContent = '';
      }, 2500);
    }

    /** Copies text, or shows it in a box to copy by hand when the browser won't. */
    function copyOrShow(text, done) {
      function show() {
        el.fallback.hidden = false;
        el.copy.value = text;
        el.copy.focus();
        el.copy.select();
      }
      if (navigator.clipboard) { // Missing on http:// pages.
        navigator.clipboard.writeText(text).then(function () {
          el.fallback.hidden = true;
          setStatus(done);
        }, show);
      } else {
        show();
      }
    }

    function download(name, text) {
      var a = document.createElement('a');
      if (typeof Blob !== 'function' || !('download' in a)) {
        return setStatus('Your browser can\'t download files here.');
      }
      a.href = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }));
      a.download = name;
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
      }, 1000);
      setStatus('Downloaded ' + name);
    }

    function onAction(act, button) {
      var body = button.closest('[data-tc-day]');
      var day = body && days[body.getAttribute('data-tc-day')];
      if (/^(add|clear)/.test(act)) {
        (day ? [day] : days).forEach(function (one) {
          one.shifts.slice(act === 'add' ? 1 : 0).forEach(function (sh) {
            FIELDS.forEach(function (f) {
              sh[f].value = '';
            });
          });
          one.second = act === 'add' && !one.second;
        });
        update(true);
        if (act === 'add' && day.second) {
          day.shifts[1]['in'].focus();
        }
      } else if (el.result.classList.contains('is-stale')) {
        setStatus('Fix the highlighted field first.');
      } else if (act === 'print') {
        window.print();
      } else if (act === 'copy') {
        copyOrShow(plainText(good), 'Copied');
      } else if (act === 'download') {
        download('time-card-' + (el.wk.value || todayIso()) + '.csv', csv(good));
      } else {
        writeUrl();
        if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
          navigator.share({ title: document.title, url: window.location.href }).then(null, function () {});
        } else {
          copyOrShow(window.location.href, 'Link copied');
        }
      }
    }

    function changed() {
      update(true);
    }

    root.addEventListener('input', changed);
    root.addEventListener('change', changed);
    root.addEventListener('click', function (e) {
      var button = e.target.closest('[data-tc-act]');
      if (button) {
        onAction(button.getAttribute('data-tc-act'), button);
      }
    });
    root.addEventListener('keydown', function (e) {
      var t = e.target;
      if (e.key === 'Enter' && t.type === 'time') {
        e.preventDefault();
      } else if (e.key === 'Escape' && t.getAttribute('data-tc-f') === 'breakMin' && t.value) {
        t.value = '';
        changed();
      }
    });
    el.gen.textContent = ' on ' + longDate(todayIso());
    if (useUrl) {
      readUrl();
    }
    update(false);
  }

  function mountAll() {
    var roots = document.querySelectorAll('[data-oc-tool="time-card"]:not([data-oc-mounted])');
    for (var i = 0; window.OCTimeCardCalc && i < roots.length; i++) {
      roots[i].setAttribute('data-oc-mounted', '1');
      try {
        mount(roots[i], window.OCTimeCardCalc);
      } catch (err) {
        // The printed form and result stay as a static example.
        if (window.console) {
          window.console.error('[OrbitCorner Tools] time-card:', err);
        }
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAll);
  } else {
    mountAll();
  }
}());
