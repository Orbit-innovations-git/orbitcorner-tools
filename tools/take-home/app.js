/**
 * Freelancer Take-Home Calculator: the interface.
 *
 * Builds the form and results inside every [data-oc-tool="take-home"] container.
 * Needs window.OCToolData (rates.json, printed by the plugin) and
 * window.OCTakeHomeCalc (calc.js, loaded first).
 */
(function () {
  'use strict';

  var TOOL = 'take-home';
  var FEE_MIN = 0;
  var FEE_MAX = 15;
  var FEE_STEP = 0.5;
  var DEFAULT_AMOUNT = 1000;
  var MAX_URL_AMOUNT = 1000000000;
  var HIDE_BELOW_PKR = 0.5;
  var COPY_STATUS_MS = 2500;
  var ANNOUNCE_DELAY_MS = 800;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var LOAD_ERROR = 'The calculator could not load its data. Please refresh the page.';
  var URL_KEYS = ['amount', 'platform', 'fee', 'pseb'];

  var hasOwn = Object.prototype.hasOwnProperty;
  var autoId = 0;

  /* ------------------------------------------------------------------
   * Helpers
   * ------------------------------------------------------------------ */

  /** Escapes any value for use inside HTML text or a quoted attribute. */
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Only http(s) links are allowed in href attributes. */
  function safeUrl(url) {
    url = String(url || '');
    return /^https?:\/\//i.test(url) ? url : '';
  }

  /** A finite number from a number or text, otherwise NaN. */
  function toNumber(value) {
    var n = typeof value === 'number' ? value : String(value == null ? '' : value).replace(/,/g, '').trim();
    n = n === '' ? NaN : Number(n);
    return isFinite(n) ? n : NaN;
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function makeFormatter(minDigits, maxDigits) {
    if (typeof Intl !== 'undefined' && Intl.NumberFormat) {
      try {
        var f = new Intl.NumberFormat('en-PK', { minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits });
        return function (n) {
          return f.format(n);
        };
      } catch (e) {
        // Fall through to the manual formatter.
      }
    }
    return function (n) {
      var parts = Math.abs(n).toFixed(maxDigits).split('.');
      var frac = parts[1] || '';
      while (frac.length > minDigits && frac.charAt(frac.length - 1) === '0') {
        frac = frac.slice(0, -1);
      }
      return (n < 0 ? '-' : '') + parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (frac ? '.' + frac : '');
    };
  }

  var formatWhole = makeFormatter(0, 0);
  var formatUpTo2 = makeFormatter(0, 2);
  var formatFixed2 = makeFormatter(2, 2);

  /** "PKR 245,364" */
  function pkr(n) {
    var rounded = Math.round(n);
    return 'PKR ' + formatWhole(rounded === 0 ? 0 : rounded); // No "-0".
  }

  /** "87.3%" */
  function pct1(n) {
    var rounded = Math.round(n * 10) / 10;
    return (rounded === 0 ? 0 : rounded).toFixed(1) + '%';
  }

  /** "10%", "0.25%" */
  function pctPlain(n) {
    return formatUpTo2(n) + '%';
  }

  /** "2026-10-28" → "28 Oct 2026" */
  function formatDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31) {
      return String(iso || '');
    }
    return (+m[3]) + ' ' + MONTHS[+m[2] - 1] + ' ' + m[1];
  }

  function safeDecode(text) {
    try {
      return decodeURIComponent(text.replace(/\+/g, ' '));
    } catch (e) {
      return '';
    }
  }

  /** First value of each query parameter in the page URL. */
  function readParams() {
    var out = {};
    var search = window.location.search || '';
    if (typeof URLSearchParams === 'function') {
      var params = new URLSearchParams(search);
      URL_KEYS.forEach(function (key) {
        if (params.has(key)) {
          out[key] = params.get(key);
        }
      });
      return out;
    }
    search.replace(/^\?/, '').split('&').forEach(function (pair) {
      var i = pair.indexOf('=');
      var key = safeDecode(i === -1 ? pair : pair.slice(0, i));
      if (key && !hasOwn.call(out, key)) {
        out[key] = i === -1 ? '' : safeDecode(pair.slice(i + 1));
      }
    });
    return out;
  }

  /** The page URL with our parameters set (null removes one); other parameters are kept. */
  function buildUrl(values) {
    var loc = window.location;
    var base = loc.href.split('#')[0].split('?')[0];
    var query;
    if (typeof URLSearchParams === 'function') {
      var params = new URLSearchParams(loc.search);
      URL_KEYS.forEach(function (key) {
        if (values[key] == null) {
          params.delete(key);
        } else {
          params.set(key, String(values[key]));
        }
      });
      query = params.toString();
    } else {
      var kept = (loc.search || '').replace(/^\?/, '').split('&').filter(function (pair) {
        return pair && URL_KEYS.indexOf(safeDecode(pair.split('=')[0])) === -1;
      });
      URL_KEYS.forEach(function (key) {
        if (values[key] != null) {
          kept.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(values[key])));
        }
      });
      query = kept.join('&');
    }
    return base + (query ? '?' + query : '') + (loc.hash || '');
  }

  /** Copies text with the Clipboard API; done(false) if that isn't possible. */
  function copyText(text, done) {
    if (window.isSecureContext !== false && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(function () {
        done(true);
      }, function () {
        done(false);
      });
      return;
    }
    done(false);
  }

  function showError(root) {
    root.innerHTML = '<p class="oc-app-error" role="alert">' + esc(LOAD_ERROR) + '</p>';
  }

  /* ------------------------------------------------------------------
   * One calculator
   * ------------------------------------------------------------------ */

  function mount(root, data, calc) {
    var uid = root.id || ('oc-app-' + TOOL + '-auto-' + (++autoId));
    var platforms = data.platforms && typeof data.platforms === 'object' ? data.platforms : {};
    var platformKeys = Object.keys(platforms).filter(function (key) {
      return platforms[key] && typeof platforms[key] === 'object';
    });
    if (!platformKeys.length) {
      throw new Error('No platforms in OCToolData');
    }

    var market = data.market_rate || {};
    var tax = data.tax || {};
    var defaultRate = toNumber(market.usd_to_pkr);
    var platformName = uid + '-platform';
    var psebName = uid + '-pseb';
    var announceTimer = null;
    var statusTimer = null;
    var firstRender = true;

    function platformLabel(key) {
      return String(platforms[key].label || key);
    }

    function feeEditable(key) {
      return platforms[key].fee_editable === true;
    }

    function defaultFee(key) {
      var fee = toNumber(platforms[key].fee_pct_default);
      return isNaN(fee) ? 0 : clamp(fee, 0, 100);
    }

    // Starting values: defaults, then any valid values from a shared link.
    var start = {
      amount: DEFAULT_AMOUNT,
      platform: platformKeys[0],
      fee: defaultFee(platformKeys[0]),
      pseb: false,
      rate: defaultRate > 0 ? defaultRate : ''
    };
    var params = readParams();
    var urlAmount = toNumber(params.amount);
    if (urlAmount > 0 && urlAmount <= MAX_URL_AMOUNT) {
      start.amount = urlAmount;
    }
    if (platformKeys.indexOf(params.platform) !== -1) {
      start.platform = params.platform;
      start.fee = defaultFee(params.platform);
    }
    var urlFee = toNumber(params.fee);
    if (feeEditable(start.platform) && urlFee >= FEE_MIN && urlFee <= FEE_MAX) {
      start.fee = urlFee;
    }
    if (params.pseb === '1' || params.pseb === '0') {
      start.pseb = params.pseb === '1';
    }

    root.innerHTML =
      '<div class="oc-th">' +
        buildForm() +
        '<div class="oc-th-results">' +
          '<div class="oc-th-output" data-oc-output></div>' +
          '<div class="oc-th-actions" data-oc-actions>' +
            '<button type="button" class="oc-btn-outline" data-oc-copy>Copy link to this result</button>' +
            '<span class="oc-copy-status" role="status" data-oc-status></span>' +
            '<div class="oc-copy-fallback" data-oc-fallback hidden>' +
              '<label class="oc-label" for="' + esc(uid + '-link') + '">Copy this link:</label>' +
              '<div class="oc-input-wrap"><input class="oc-input" type="text" id="' + esc(uid + '-link') + '" readonly data-oc-link></div>' +
            '</div>' +
          '</div>' +
          buildHow() +
          '<p class="oc-disclaimer">Estimates for information only, not financial or tax advice.</p>' +
          '<p class="oc-sr-only" aria-live="polite" data-oc-announce></p>' +
        '</div>' +
      '</div>';

    var els = {
      form: root.querySelector('[data-oc-form]'),
      amount: document.getElementById(uid + '-amount'),
      fee: document.getElementById(uid + '-fee'),
      feeField: root.querySelector('[data-oc-fee-field]'),
      feeLabel: root.querySelector('[data-oc-fee-label]'),
      feeHint: root.querySelector('[data-oc-fee-hint]'),
      rate: document.getElementById(uid + '-rate'),
      platformRadios: root.querySelectorAll('input[data-oc-platform]'),
      psebRadios: root.querySelectorAll('input[data-oc-pseb]'),
      output: root.querySelector('[data-oc-output]'),
      actions: root.querySelector('[data-oc-actions]'),
      copy: root.querySelector('[data-oc-copy]'),
      status: root.querySelector('[data-oc-status]'),
      fallback: root.querySelector('[data-oc-fallback]'),
      link: root.querySelector('[data-oc-link]'),
      rateUsed: root.querySelector('[data-oc-rate-used]'),
      announce: root.querySelector('[data-oc-announce]')
    };

    /* ---------- Markup built once ---------- */

    function segmented(name, dataAttr, options, checkedValue) {
      return '<div class="oc-seg">' + options.map(function (opt, i) {
        var id = name + '-' + i;
        return '<input type="radio" class="oc-seg-input" ' + dataAttr + ' id="' + esc(id) + '" name="' + esc(name) + '" value="' + esc(opt.value) + '"' +
          (opt.value === checkedValue ? ' checked' : '') + '>' +
          '<label class="oc-seg-option" for="' + esc(id) + '">' + esc(opt.label) + '</label>';
      }).join('') + '</div>';
    }

    function buildForm() {
      var editable = feeEditable(start.platform);
      var rateHint = (market.last_checked ? 'Rate on ' + formatDate(market.last_checked) + '. ' : '') +
        'Change it to today\'s rate for a more exact answer.';

      return '<form class="oc-card oc-th-form" data-oc-form aria-label="Your payment">' +
        '<div class="oc-field">' +
          '<label class="oc-label" for="' + esc(uid + '-amount') + '">Client pays</label>' +
          '<div class="oc-input-wrap oc-has-prefix">' +
            '<span class="oc-affix oc-prefix" aria-hidden="true">$</span>' +
            '<input class="oc-input" type="number" id="' + esc(uid + '-amount') + '" min="0" step="any" inputmode="decimal" autocomplete="off"' +
              ' value="' + esc(start.amount) + '" aria-describedby="' + esc(uid + '-amount-hint') + '">' +
          '</div>' +
          '<p class="oc-hint" id="' + esc(uid + '-amount-hint') + '">Before any platform fees, in US dollars.</p>' +
        '</div>' +

        '<fieldset class="oc-field">' +
          '<legend class="oc-label">Where the client pays you</legend>' +
          segmented(platformName, 'data-oc-platform', platformKeys.map(function (key) {
            return { value: key, label: platformLabel(key) };
          }), start.platform) +
        '</fieldset>' +

        '<div class="oc-field" data-oc-fee-field' + (editable ? '' : ' hidden') + '>' +
          '<label class="oc-label" for="' + esc(uid + '-fee') + '" data-oc-fee-label>' + esc(platformLabel(start.platform) + ' fee on this contract') + '</label>' +
          '<div class="oc-input-wrap oc-has-suffix">' +
            '<input class="oc-input" type="number" id="' + esc(uid + '-fee') + '" min="' + FEE_MIN + '" max="' + FEE_MAX + '" step="' + FEE_STEP + '" inputmode="decimal" autocomplete="off"' +
              ' value="' + esc(start.fee) + '" aria-describedby="' + esc(uid + '-fee-hint') + '">' +
            '<span class="oc-affix oc-suffix" aria-hidden="true">%</span>' +
          '</div>' +
          '<p class="oc-hint" id="' + esc(uid + '-fee-hint') + '" data-oc-fee-hint>' + esc(feeHint(start.platform)) + '</p>' +
        '</div>' +

        '<fieldset class="oc-field">' +
          '<legend class="oc-label">Registered with PSEB?</legend>' +
          segmented(psebName, 'data-oc-pseb', [{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }], start.pseb ? '1' : '0') +
        '</fieldset>' +

        '<div class="oc-field">' +
          '<label class="oc-label" for="' + esc(uid + '-rate') + '">USD → PKR market rate</label>' +
          '<div class="oc-input-wrap oc-has-prefix">' +
            '<span class="oc-affix oc-prefix" aria-hidden="true">Rs</span>' +
            '<input class="oc-input" type="number" id="' + esc(uid + '-rate') + '" min="0" step="any" inputmode="decimal" autocomplete="off"' +
              ' value="' + esc(start.rate) + '" aria-describedby="' + esc(uid + '-rate-hint') + '">' +
          '</div>' +
          '<p class="oc-hint" id="' + esc(uid + '-rate-hint') + '">' + esc(rateHint) + '</p>' +
        '</div>' +
      '</form>';
    }

    function feeHint(key) {
      return platformLabel(key) + ' shows it before you send a proposal (' + FEE_MIN + '–' + FEE_MAX + '%).';
    }

    function sourceLink(url) {
      url = safeUrl(url);
      return url ? ' <a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">Source</a>' : '';
    }

    function buildHow() {
      var fees = platformKeys.map(function (key) {
        var fee = defaultFee(key);
        if (feeEditable(key)) {
          return platformLabel(key) + ': the fee you enter';
        }
        return platformLabel(key) + ': ' + (fee > 0 ? pctPlain(fee) : 'no fee');
      }).join('; ');
      var psebPct = toNumber(tax.pseb_rate_pct);
      var nonPsebPct = toNumber(tax.non_pseb_rate_pct);
      var taxLine = 'Tax rates: ' + pctPlain(isNaN(psebPct) ? 0 : psebPct) + ' if you are registered with PSEB, ' +
        pctPlain(isNaN(nonPsebPct) ? 0 : nonPsebPct) + ' if you are not' +
        (tax.last_checked ? ', last checked on ' + formatDate(tax.last_checked) : '') + '.';

      return '<details class="oc-card oc-how" data-oc-key="how">' +
        '<summary>How we calculate this</summary>' +
        '<div class="oc-how-body">' +
          '<ol class="oc-steps">' +
            '<li>We start with what the client pays, in US dollars.</li>' +
            '<li>We take off the platform fee (' + esc(fees) + ').</li>' +
            '<li>We take off the withdrawal and transfer fees for each route.</li>' +
            '<li>We convert what is left to rupees at the rate each route really gives you. This is usually a little below the market rate, so the gap is a hidden cost.</li>' +
            '<li>We take off the final tax on IT export income.</li>' +
            '<li>We compare what reaches your bank with the full payment at the market rate. The difference is what you lose.</li>' +
          '</ol>' +
          '<p>Market rate used: <span data-oc-rate-used></span>' + sourceLink(market.source_url) + '</p>' +
          '<p>' + esc(taxLine) + sourceLink(tax.source_url) + '</p>' +
          '<p>Platforms and payment companies change their fees and rates often, and some don\'t publish their exact daily rate. ' +
            'Results are estimates: check the amount shown in your own app before you withdraw.</p>' +
        '</div>' +
      '</details>';
    }

    /* ---------- Reading the form ---------- */

    function checkedValue(radios) {
      for (var i = 0; i < radios.length; i++) {
        if (radios[i].checked) {
          return radios[i].value;
        }
      }
      return '';
    }

    function selectedPlatform() {
      var key = checkedValue(els.platformRadios);
      return hasOwn.call(platforms, key) ? key : platformKeys[0];
    }

    function readForm() {
      var platform = selectedPlatform();
      var fee = feeEditable(platform) ? toNumber(els.fee.value) : defaultFee(platform);
      return {
        amountUsd: toNumber(els.amount.value),
        platform: platform,
        platformFeePct: isNaN(fee) ? 0 : clamp(fee, FEE_MIN, feeEditable(platform) ? FEE_MAX : 100),
        pseb: checkedValue(els.psebRadios) === '1',
        marketRate: toNumber(els.rate.value)
      };
    }

    /* ---------- Results ---------- */

    function breakdownTable(route, result, platform) {
      var b = route.breakdown;
      var lines = [
        [platformLabel(platform) + ' fee (' + pctPlain(result.platformFeePct) + ')', b.platformFeePkr],
        ['Withdrawal and transfer fees', b.routeFeePkr],
        ['Weaker exchange rate (Rs ' + formatFixed2(route.effectiveRate) + ' per $)', b.exchangeLossPkr],
        ['Tax (' + pctPlain(result.taxPct) + ')', b.taxPkr]
      ];
      var rows = '<tr><th scope="row">Client pays</th><td>' + esc(pkr(result.grossPkr)) + '</td></tr>';
      lines.forEach(function (line) {
        if (line[1] >= HIDE_BELOW_PKR) {
          rows += '<tr><th scope="row">' + esc(line[0]) + '</th><td>− ' + esc(pkr(line[1])) + '</td></tr>';
        }
      });
      rows += '<tr class="oc-total"><th scope="row">Reaches your bank</th><td>' + esc(pkr(route.finalPkr)) + '</td></tr>';
      return '<table class="oc-breakdown"><caption class="oc-sr-only">' + esc('Breakdown for ' + route.label) + '</caption><tbody>' + rows + '</tbody></table>';
    }

    function routeRow(route, index, result, platform) {
      var best = result.best;
      var isBest = index === 0;
      var width = best.finalPkr > 0 ? Math.max(4, route.finalPkr / best.finalPkr * 100) : 4;
      return '<li class="oc-route' + (isBest ? ' is-best' : '') + '">' +
        '<div class="oc-route-head">' +
          '<span class="oc-rank">' + (index + 1) + '</span>' +
          '<div class="oc-route-main">' +
            '<span class="oc-route-name">' + esc(route.label) + (isBest ? '<span class="oc-sr-only"> (best route)</span>' : '') + '</span>' +
            (route.speed ? ' <span class="oc-chip">' + esc(route.speed) + '</span>' : '') +
          '</div>' +
          '<span class="oc-route-amount">' + esc(pkr(route.finalPkr)) + '</span>' +
        '</div>' +
        '<div class="oc-bar" aria-hidden="true"><span class="oc-bar-fill" style="width:' + width.toFixed(1) + '%"></span></div>' +
        '<details class="oc-details" data-oc-key="' + esc('route:' + route.id) + '">' +
          '<summary>' + esc('Lose ' + pkr(route.lostPkr) + ' (' + pct1(route.lostPct) + '): see breakdown') + '</summary>' +
          breakdownTable(route, result, platform) +
          (route.note ? '<p class="oc-note">' + esc(route.note) + '</p>' : '') +
        '</details>' +
      '</li>';
    }

    function resultHtml(result, input) {
      var best = result.best;
      var html = '<section class="oc-card oc-summary" aria-label="Best route for you">' +
        '<p class="oc-eyebrow">Best route for you</p>' +
        '<p class="oc-summary-route">' + esc(best.label) + '</p>' +
        '<p class="oc-big">' + esc(pkr(best.finalPkr)) + '</p>' +
        '<p class="oc-summary-text">reaches your bank. You keep <strong>' + esc(pct1(best.keptPct)) + '</strong> of what the client paid and lose ' +
          esc(pkr(best.lostPkr)) + ' to fees, exchange rate and tax.</p>';

      if (result.routes.length > 1 && result.savingVsWorstPkr >= 1) {
        html += '<p class="oc-callout oc-callout-save">Using this route instead of <strong>' + esc(result.worst.label) + '</strong> saves you <strong>' +
          esc(pkr(result.savingVsWorstPkr)) + '</strong> on this payment, about <strong>' + esc(pkr(result.savingVsWorstPkr * 12)) +
          '</strong> a year if you get paid this much every month.</p>';
      }
      if (!input.pseb && result.psebSavingPkr >= 1) {
        html += '<p class="oc-callout oc-callout-tip">Registered with PSEB, you would pay <strong>' + esc(pkr(result.psebSavingPkr)) +
          '</strong> less tax on this payment.</p>';
      }
      html += '</section>';

      html += '<section class="oc-card oc-routes-card">' +
        '<h3 class="oc-card-title">All routes compared</h3>' +
        '<ol class="oc-routes" role="list">' + result.routes.map(function (route, i) {
          return routeRow(route, i, result, input.platform);
        }).join('') + '</ol>' +
      '</section>';
      return html;
    }

    function emptyMessage(input) {
      if (!(input.amountUsd > 0)) {
        return 'Enter how much the client pays to see what reaches your bank.';
      }
      if (!(input.marketRate > 0)) {
        return 'Enter the USD → PKR market rate to see what reaches your bank.';
      }
      return 'There are no withdrawal routes for this platform yet.';
    }

    function rateUsedText(rate) {
      if (!(rate > 0)) {
        return 'none entered yet.';
      }
      var checked = market.last_checked ? formatDate(market.last_checked) : '';
      if (rate === defaultRate) {
        return 'Rs ' + formatUpTo2(rate) + ' per US dollar' + (checked ? ', last checked on ' + checked : '') + '.';
      }
      return 'Rs ' + formatUpTo2(rate) + ' per US dollar (the rate you entered).' +
        (defaultRate > 0 ? ' Our last check was Rs ' + formatUpTo2(defaultRate) + (checked ? ' on ' + checked : '') + '.' : '');
    }

    function openDetailKeys() {
      var keys = {};
      var list = els.output.querySelectorAll('details[data-oc-key]');
      for (var i = 0; i < list.length; i++) {
        if (list[i].open) {
          keys[list[i].getAttribute('data-oc-key')] = true;
        }
      }
      return keys;
    }

    function reopenDetails(keys) {
      var list = els.output.querySelectorAll('details[data-oc-key]');
      for (var i = 0; i < list.length; i++) {
        if (keys[list[i].getAttribute('data-oc-key')]) {
          list[i].open = true;
        }
      }
    }

    function announce(text) {
      // One short sentence once typing pauses, instead of reading the whole results area on every key.
      clearTimeout(announceTimer);
      announceTimer = setTimeout(function () {
        els.announce.textContent = text;
      }, ANNOUNCE_DELAY_MS);
    }

    function render() {
      var input = readForm();
      var result = calc.compute(input, data);
      var open = openDetailKeys();
      var summary;

      if (result.best) {
        els.output.innerHTML = resultHtml(result, input);
        reopenDetails(open);
        summary = 'Best route: ' + result.best.label + '. ' + pkr(result.best.finalPkr) + ' reaches your bank.';
      } else {
        summary = emptyMessage(input);
        els.output.innerHTML = '<div class="oc-card oc-empty"><p>' + esc(summary) + '</p></div>';
      }
      els.actions.hidden = !result.best;
      els.rateUsed.textContent = rateUsedText(input.marketRate);

      if (firstRender) {
        firstRender = false;
      } else {
        announce(summary);
      }
    }

    /* ---------- Events ---------- */

    function onPlatformChange() {
      var key = selectedPlatform();
      els.fee.value = String(defaultFee(key));
      els.feeField.hidden = !feeEditable(key);
      els.feeLabel.textContent = platformLabel(key) + ' fee on this contract';
      els.feeHint.textContent = feeHint(key);
    }

    function onFormEvent(e) {
      var target = e.target;
      if (target.name === platformName) {
        if (e.type !== 'change') {
          return; // Radios fire input then change; handle once.
        }
        onPlatformChange();
      }
      if (target === els.fee && e.type === 'change') {
        // Snap an out-of-range fee into 0–15% when the visitor leaves the field.
        var fee = toNumber(els.fee.value);
        if (!isNaN(fee) && fee !== clamp(fee, FEE_MIN, FEE_MAX)) {
          els.fee.value = String(clamp(fee, FEE_MIN, FEE_MAX));
        }
      }
      render();
    }

    function setStatus(text) {
      clearTimeout(statusTimer);
      els.status.textContent = text;
      if (text) {
        statusTimer = setTimeout(function () {
          els.status.textContent = '';
        }, COPY_STATUS_MS);
      }
    }

    function onCopy() {
      var input = readForm();
      var url = buildUrl({
        amount: input.amountUsd > 0 ? input.amountUsd : null,
        platform: input.platform,
        fee: feeEditable(input.platform) ? input.platformFeePct : null,
        pseb: input.pseb ? '1' : '0'
      });
      try {
        if (window.history && typeof window.history.replaceState === 'function') {
          window.history.replaceState(window.history.state, '', url);
        }
      } catch (e) {
        // Some embedded browsers block replaceState; the link can still be copied.
      }
      copyText(url, function (ok) {
        if (ok) {
          els.fallback.hidden = true;
          setStatus('Link copied');
        } else {
          els.link.value = url;
          els.fallback.hidden = false;
          els.link.focus();
          els.link.select();
          setStatus('');
        }
      });
    }

    els.form.addEventListener('submit', function (e) {
      e.preventDefault();
    });
    els.form.addEventListener('input', onFormEvent);
    els.form.addEventListener('change', onFormEvent);
    els.copy.addEventListener('click', onCopy);
    els.link.addEventListener('focus', function () {
      els.link.select();
    });

    render();
  }

  /* ------------------------------------------------------------------
   * Start
   * ------------------------------------------------------------------ */

  function mountAll() {
    var roots = document.querySelectorAll('[data-oc-tool="' + TOOL + '"]');
    for (var i = 0; i < roots.length; i++) {
      var root = roots[i];
      if (root.getAttribute('data-oc-mounted')) {
        continue;
      }
      root.setAttribute('data-oc-mounted', '1');

      var data = window.OCToolData;
      var calc = window.OCTakeHomeCalc;
      if (!data || typeof data !== 'object' || !calc || typeof calc.compute !== 'function') {
        showError(root);
        continue;
      }
      try {
        mount(root, data, calc);
      } catch (err) {
        showError(root);
        if (window.console && typeof window.console.error === 'function') {
          window.console.error('[OrbitCorner Tools] ' + TOOL + ':', err);
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
