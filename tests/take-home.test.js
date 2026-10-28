/**
 * Tests for tools/take-home/calc.js. No test framework needed.
 *
 *   node tests/take-home.test.js
 */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var calc = require('../tools/take-home/calc.js');
var data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'rates.json'), 'utf8'));

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

function near(actual, expected, tolerance, label) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    (label || 'value') + ': expected ' + expected + ' (±' + tolerance + '), got ' + actual
  );
}

/** Upwork, $1000, 10% fee, not PSEB, rate 281, with any fields replaced by `extra`. */
function input(extra) {
  var base = { amountUsd: 1000, platform: 'upwork', platformFeePct: 10, pseb: false, marketRate: 281 };
  Object.keys(extra || {}).forEach(function (key) {
    base[key] = extra[key];
  });
  return base;
}

function ids(result) {
  return result.routes.map(function (r) {
    return r.id;
  });
}

function routeById(result, id) {
  var found = result.routes.filter(function (r) {
    return r.id === id;
  })[0];
  assert.ok(found, 'route ' + id + ' is in the result');
  return found;
}

/** Fails if any number anywhere in the result is NaN, Infinity or negative. */
function assertCleanNumbers(value, where) {
  if (typeof value === 'number') {
    assert.ok(isFinite(value), where + ' is ' + value);
    assert.ok(value >= 0, where + ' is negative (' + value + ')');
  } else if (value && typeof value === 'object') {
    Object.keys(value).forEach(function (key) {
      assertCleanNumbers(value[key], where + '.' + key);
    });
  }
}

function assertEmpty(result, label) {
  assert.strictEqual(result.best, null, label + ': best is null');
  assert.strictEqual(result.worst, null, label + ': worst is null');
  assert.deepStrictEqual(result.routes, [], label + ': no routes');
  // amountUsd and marketRate echo the input (may be negative); everything calculated must be clean.
  assert.ok(isFinite(result.amountUsd) && isFinite(result.marketRate), label + ': input echoes are finite');
  ['grossPkr', 'platformFeePct', 'taxPct', 'savingVsWorstPkr', 'psebSavingPkr'].forEach(function (key) {
    assertCleanNumbers(result[key], label + '.' + key);
  });
}

console.log('Take-Home Calculator: calc.js');

test('1. Upwork $1000 at 10%: 3 routes, best first, breakdown adds up', function () {
  var r = calc.compute(input(), data);
  assert.deepStrictEqual(ids(r).slice().sort(), ['payoneer_jazzcash', 'upwork_direct_bank', 'upwork_payoneer_bank']);
  for (var i = 1; i < r.routes.length; i++) {
    assert.ok(r.routes[i - 1].finalPkr >= r.routes[i].finalPkr, 'routes sorted highest first');
  }
  assert.strictEqual(r.best, r.routes[0]);
  assert.strictEqual(r.worst, r.routes[r.routes.length - 1]);
  near(r.savingVsWorstPkr, r.best.finalPkr - r.worst.finalPkr, 1e-9, 'savingVsWorstPkr');
  near(r.grossPkr, 281000, 1e-9, 'grossPkr');
  r.routes.forEach(function (route) {
    var b = route.breakdown;
    near(r.grossPkr - b.platformFeePkr - b.routeFeePkr - b.exchangeLossPkr - b.taxPkr, route.finalPkr, 0.01, route.id + ' breakdown');
    near(route.lostPkr, r.grossPkr - route.finalPkr, 1e-9, route.id + ' lostPkr');
    near(route.keptPct + route.lostPct, 100, 1e-9, route.id + ' kept + lost');
  });
  assertCleanNumbers(r, 'result');
});

test('2. Hand check: Upwork → Payoneer → bank = PKR 245,363.58', function () {
  var r = calc.compute(input(), data);
  var route = routeById(r, 'upwork_payoneer_bank');
  // 900 after Upwork's 10% → × 281 × 0.98 = 247,842 → minus 1% tax = 245,363.58
  near(route.effectiveRate, 275.38, 1e-9, 'effectiveRate');
  near(route.finalPkr, 245363.58, 0.005, 'finalPkr');
  near(route.breakdown.platformFeePkr, 28100, 1e-6, 'platformFeePkr');
  near(route.breakdown.routeFeePkr, 0, 1e-9, 'routeFeePkr');
  near(route.breakdown.exchangeLossPkr, 5058, 1e-6, 'exchangeLossPkr');
  near(route.breakdown.taxPkr, 2478.42, 1e-6, 'taxPkr');
  near(route.lostPkr, 35636.42, 0.005, 'lostPkr');
  near(route.keptPct, 87.318, 0.0001, 'keptPct');
  assert.strictEqual(r.best.id, 'upwork_payoneer_bank', 'best Upwork route with default data');
});

test('3. Fiverr: only Fiverr routes + JazzCash, JazzCash uses the $1 Fiverr fee', function () {
  var r = calc.compute(input({ platform: 'fiverr', platformFeePct: 20 }), data);
  assert.deepStrictEqual(ids(r).slice().sort(), ['fiverr_direct_bank', 'fiverr_payoneer_bank', 'payoneer_jazzcash']);
  var jazz = routeById(r, 'payoneer_jazzcash');
  // 800 after Fiverr's 20% → fee 800 × 2% + $1 = $17 → 783 × 279.595 × 0.99
  near(jazz.breakdown.routeFeePkr, 17 * 281, 1e-6, 'routeFeePkr');
  near(jazz.finalPkr, 783 * 281 * 0.995 * 0.99, 1e-6, 'finalPkr');
  assertCleanNumbers(r, 'result');
});

test('4. Direct client: JazzCash uses the 3% direct-client fee', function () {
  var r = calc.compute(input({ platform: 'direct', platformFeePct: 0 }), data);
  assert.deepStrictEqual(ids(r).slice().sort(), ['direct_payoneer_bank', 'direct_wise_bank', 'payoneer_jazzcash']);
  var jazz = routeById(r, 'payoneer_jazzcash');
  // No platform fee → fee $1000 × 3% = $30, no flat fee → 970 × 279.595 × 0.99
  near(jazz.breakdown.platformFeePkr, 0, 1e-9, 'platformFeePkr');
  near(jazz.breakdown.routeFeePkr, 30 * 281, 1e-6, 'routeFeePkr');
  near(jazz.finalPkr, 970 * 281 * 0.995 * 0.99, 1e-6, 'finalPkr');
});

test('5. PSEB: more money, and psebSavingPkr only shows when not registered', function () {
  var no = calc.compute(input({ pseb: false }), data);
  var yes = calc.compute(input({ pseb: true }), data);
  assert.strictEqual(no.taxPct, 1);
  assert.strictEqual(yes.taxPct, 0.25);
  no.routes.forEach(function (route) {
    assert.ok(routeById(yes, route.id).finalPkr > route.finalPkr, route.id + ' pays more with PSEB');
  });
  assert.strictEqual(yes.psebSavingPkr, 0);
  assert.ok(no.psebSavingPkr > 0, 'psebSavingPkr > 0 when not PSEB');
  // Best route: tax on 247,842 at 1% vs 0.25% = 2,478.42 − 619.605
  near(no.psebSavingPkr, 1858.815, 1e-6, 'psebSavingPkr');
  near(routeById(yes, 'upwork_payoneer_bank').finalPkr, 247842 * 0.9975, 1e-6, 'PSEB finalPkr');
});

test('6. Bad input returns best === null without throwing', function () {
  assertEmpty(calc.compute(input({ amountUsd: 0 }), data), 'amount 0');
  assertEmpty(calc.compute(input({ amountUsd: -50 }), data), 'amount -50');
  assertEmpty(calc.compute(input({ marketRate: 0 }), data), 'rate 0');
  assertEmpty(calc.compute(input({ marketRate: -281 }), data), 'rate -281');
  assertEmpty(calc.compute(input({ platform: 'paypal' }), data), 'unknown platform');
  assertEmpty(calc.compute(input({ platform: 'toString' }), data), 'platform "toString"');
  assertEmpty(calc.compute(input({ platform: undefined }), data), 'missing platform');
  assertEmpty(calc.compute(input({ amountUsd: NaN }), data), 'amount NaN');
  assertEmpty(calc.compute(input({ amountUsd: 'abc' }), data), 'amount "abc"');
  assertEmpty(calc.compute(input({ amountUsd: 1e308 }), data), 'amount too big');
  assertEmpty(calc.compute(undefined, data), 'no input');
  assertEmpty(calc.compute(input(), undefined), 'no data');
  assertEmpty(calc.compute(input(), {}), 'empty data');
});

test('7. Fee 150% clamps to 100% with no negative or NaN values', function () {
  var r = calc.compute(input({ platformFeePct: 150 }), data);
  assert.strictEqual(r.platformFeePct, 100);
  assert.strictEqual(r.routes.length, 3);
  r.routes.forEach(function (route) {
    assert.strictEqual(route.finalPkr, 0, route.id + ' finalPkr');
    near(route.keptPct, 0, 1e-9, route.id + ' keptPct');
  });
  assertCleanNumbers(r, 'result');
  assert.strictEqual(calc.compute(input({ platformFeePct: -20 }), data).platformFeePct, 0, 'negative fee clamps to 0');
});

test('Withdrawal fees never exceed the money left (tiny $1 Fiverr order)', function () {
  // $0.80 left after Fiverr's 20%, but the local bank route charges a flat $3.
  var r = calc.compute(input({ amountUsd: 1, platform: 'fiverr', platformFeePct: 20 }), data);
  var bank = routeById(r, 'fiverr_direct_bank');
  near(bank.breakdown.routeFeePkr, 0.8 * 281, 1e-9, 'routeFeePkr capped');
  assert.strictEqual(bank.finalPkr, 0);
  assertCleanNumbers(r, 'result');
});

test('Numbers typed as text work the same as numbers', function () {
  var asText = calc.compute({ amountUsd: '1000', platform: 'upwork', platformFeePct: '10', pseb: false, marketRate: '281' }, data);
  near(asText.best.finalPkr, calc.compute(input(), data).best.finalPkr, 1e-9, 'finalPkr');
});

test('rates.json: route ids are unique and every route uses known platforms', function () {
  var seen = {};
  data.routes.forEach(function (route) {
    assert.ok(route.id && !seen[route.id], 'unique id: ' + route.id);
    seen[route.id] = true;
    assert.ok(Array.isArray(route.platforms) && route.platforms.length, route.id + ' has platforms');
    route.platforms.forEach(function (p) {
      assert.ok(Object.prototype.hasOwnProperty.call(data.platforms, p), route.id + ' uses unknown platform "' + p + '"');
    });
  });
  Object.keys(data.platforms).forEach(function (p) {
    var r = calc.compute(input({ platform: p, platformFeePct: data.platforms[p].fee_pct_default }), data);
    assert.ok(r.routes.length > 0, 'platform "' + p + '" has at least one route');
  });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exitCode = failed ? 1 : 0;
