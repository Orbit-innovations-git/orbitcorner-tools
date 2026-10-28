/**
 * Freelancer Take-Home Calculator: the math.
 *
 * Pure functions, no DOM access. In the browser it is window.OCTakeHomeCalc;
 * in Node it is module.exports (see tests/take-home.test.js).
 *
 *   compute(input, data) -> result
 *   input = { amountUsd, platform, platformFeePct, pseb, marketRate }
 *   data  = the rates.json object
 */
(function (root) {
  'use strict';

  var hasOwn = Object.prototype.hasOwnProperty;

  /** A finite number from a number or numeric string, otherwise the fallback. */
  function toNumber(value, fallback) {
    if (typeof value === 'string') {
      value = value.trim() === '' ? NaN : Number(value);
    }
    return typeof value === 'number' && isFinite(value) ? value : fallback;
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  /** map[platform] if the route overrides a fee for this platform, otherwise the fallback. */
  function forPlatform(map, platform, fallback) {
    if (map && typeof map === 'object' && hasOwn.call(map, platform)) {
      return toNumber(map[platform], fallback);
    }
    return fallback;
  }

  function computeRoute(route, ctx) {
    var platform = ctx.platform;
    var marketRate = ctx.marketRate;

    var routePct = clamp(forPlatform(route.fee_pct_by_platform, platform, toNumber(route.fee_pct, 0)), 0, 100);
    var routeFlat = Math.max(0, forPlatform(route.flat_fee_usd_by_platform, platform, toNumber(route.flat_fee_usd, 0)));
    var routeFeeUsd = Math.min(ctx.afterPlatform, ctx.afterPlatform * routePct / 100 + routeFlat);
    var usdConverted = ctx.afterPlatform - routeFeeUsd;

    var markupPct = clamp(toNumber(route.fx_markup_pct, 0), 0, 100);
    var effectiveRate = marketRate * (1 - markupPct / 100);
    var pkrBeforeTax = usdConverted * effectiveRate;
    var taxPkr = pkrBeforeTax * ctx.taxPct / 100;
    var finalPkr = pkrBeforeTax - taxPkr;
    var lostPkr = ctx.grossPkr - finalPkr;

    return {
      id: String(route.id || ''),
      label: String(route.label || route.id || ''),
      speed: String(route.speed || ''),
      note: String(route.note || ''),
      verify: route.verify === true,
      effectiveRate: effectiveRate,
      finalPkr: finalPkr,
      lostPkr: lostPkr,
      lostPct: lostPkr / ctx.grossPkr * 100,
      keptPct: finalPkr / ctx.grossPkr * 100,
      breakdown: {
        platformFeePkr: ctx.platformFeeUsd * marketRate,
        routeFeePkr: routeFeeUsd * marketRate,
        exchangeLossPkr: usdConverted * marketRate - pkrBeforeTax,
        taxPkr: taxPkr
      },
      otherTaxPkr: pkrBeforeTax * ctx.otherTaxPct / 100
    };
  }

  function compute(input, data) {
    input = input || {};
    data = data || {};

    var amountUsd = toNumber(input.amountUsd, 0);
    var marketRate = toNumber(input.marketRate, 0);
    var platform = typeof input.platform === 'string' ? input.platform : '';
    var platformFeePct = clamp(toNumber(input.platformFeePct, 0), 0, 100);
    var pseb = input.pseb === true;

    var tax = data.tax || {};
    var psebPct = clamp(toNumber(tax.pseb_rate_pct, 0), 0, 100);
    var nonPsebPct = clamp(toNumber(tax.non_pseb_rate_pct, 0), 0, 100);
    var platforms = data.platforms && typeof data.platforms === 'object' ? data.platforms : {};
    var routes = Array.isArray(data.routes) ? data.routes : [];

    var result = {
      amountUsd: amountUsd,
      marketRate: marketRate,
      grossPkr: 0,
      platformFeePct: platformFeePct,
      taxPct: pseb ? psebPct : nonPsebPct,
      routes: [],
      best: null,
      worst: null,
      savingVsWorstPkr: 0,
      psebSavingPkr: 0
    };

    var grossPkr = amountUsd * marketRate;
    if (!(amountUsd > 0) || !(marketRate > 0) || !isFinite(grossPkr)) {
      return result;
    }
    result.grossPkr = grossPkr;
    if (!platform || !hasOwn.call(platforms, platform)) {
      return result;
    }

    var platformFeeUsd = amountUsd * platformFeePct / 100;
    var ctx = {
      platform: platform,
      marketRate: marketRate,
      grossPkr: grossPkr,
      platformFeeUsd: platformFeeUsd,
      afterPlatform: amountUsd - platformFeeUsd,
      taxPct: result.taxPct,
      otherTaxPct: pseb ? nonPsebPct : psebPct
    };

    // Keep each route's original position so ties stay in rates.json order.
    var rows = [];
    for (var i = 0; i < routes.length; i++) {
      var route = routes[i];
      if (route && Array.isArray(route.platforms) && route.platforms.indexOf(platform) !== -1) {
        rows.push({ index: i, route: computeRoute(route, ctx) });
      }
    }
    rows.sort(function (a, b) {
      return (b.route.finalPkr - a.route.finalPkr) || (a.index - b.index);
    });
    for (var j = 0; j < rows.length; j++) {
      result.routes.push(rows[j].route);
    }

    if (result.routes.length) {
      result.best = result.routes[0];
      result.worst = result.routes[result.routes.length - 1];
      result.savingVsWorstPkr = result.best.finalPkr - result.worst.finalPkr;
      result.psebSavingPkr = pseb ? 0 : Math.max(0, result.best.breakdown.taxPkr - result.best.otherTaxPkr);
    }
    return result;
  }

  var api = { compute: compute };

  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  } else {
    root.OCTakeHomeCalc = api;
  }
}(typeof window !== 'undefined' ? window : this));
