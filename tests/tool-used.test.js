/**
 * Tests for the shared tool_used analytics event in assets/oc-tools.js. The file runs in a
 * sandbox with a stand-in document, so these tests exercise the real script.
 *
 *   node tests/tool-used.test.js
 */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'oc-tools.js'), 'utf8');
var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok    ' + name);
  } catch (e) {
    failed++;
    console.log('  FAIL  ' + name + '\n        ' + e.message);
  }
}

// An element with attributes and a parent.
function el(attrs, parent) {
  return {
    parentNode: parent || null,
    getAttribute: function (name) { return attrs && attrs[name] !== undefined ? attrs[name] : null; }
  };
}

// Runs assets/oc-tools.js once, like one page view. Returns the page and a fire(type, target) helper.
function page(globals, dnt) {
  var listeners = { input: [], change: [] };
  var sandbox = {
    navigator: { doNotTrack: dnt === undefined ? null : dnt },
    document: {
      addEventListener: function (type, fn, capture) {
        assert.strictEqual(capture, true, 'listens in the capture phase');
        listeners[type].push(fn);
      },
      removeEventListener: function (type, fn) {
        listeners[type] = listeners[type].filter(function (f) { return f !== fn; });
      }
    }
  };
  Object.keys(globals || {}).forEach(function (key) { sandbox[key] = globals[key]; });
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox);
  return {
    sandbox: sandbox,
    listeners: listeners,
    fire: function (type, target, trusted) {
      listeners[type].slice().forEach(function (fn) {
        fn({ type: type, target: target, isTrusted: trusted !== false });
      });
    }
  };
}

var tool = el({ 'data-oc-tool': 'time-card' });
var field = el({ name: 'rate', value: '25.50' }, el(null, tool));
var outside = el({ name: 'search' }, el(null));

test('gtag: one tool_used event with only the shortcode name', function () {
  var calls = [];
  var p = page({ gtag: function () { calls.push([].slice.call(arguments)); } });
  p.fire('input', field);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0][0], 'event');
  assert.strictEqual(calls[0][1], 'tool_used');
  assert.deepStrictEqual(Object.keys(calls[0][2]), ['tool_name']);
  assert.strictEqual(calls[0][2].tool_name, 'time-card');
});

test('never more than once per page view (more typing, changes, other tools)', function () {
  var calls = 0;
  var p = page({ gtag: function () { calls++; } });
  p.fire('input', field);
  p.fire('input', field);
  p.fire('change', field);
  p.fire('change', el(null, el({ 'data-oc-tool': 'countdown' })));
  assert.strictEqual(calls, 1);
  assert.strictEqual(p.listeners.input.length + p.listeners.change.length, 0, 'listeners removed');
});

test('a change event counts too (dropdowns, checkboxes, date pickers)', function () {
  var calls = [];
  var p = page({ gtag: function (a, b, c) { calls.push(c.tool_name); } });
  p.fire('change', el(null, el({ 'data-oc-tool': 'countdown' })));
  assert.deepStrictEqual(calls, ['countdown']);
});

test('dataLayer when there is no gtag', function () {
  var dataLayer = [];
  var p = page({ dataLayer: dataLayer });
  p.fire('input', field);
  p.fire('input', field);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(dataLayer)), [{ event: 'tool_used', tool_name: 'time-card' }]);
});

test('gtag wins when both exist', function () {
  var calls = 0;
  var dataLayer = [];
  var p = page({ gtag: function () { calls++; }, dataLayer: dataLayer });
  p.fire('input', field);
  assert.strictEqual(calls, 1);
  assert.strictEqual(dataLayer.length, 0);
});

test('no analytics on the page: nothing happens and nothing throws', function () {
  var p = page({});
  p.fire('input', field);
  assert.strictEqual(p.listeners.input.length, 0);
});

test('Do Not Track: no listeners, nothing sent', function () {
  var calls = 0;
  var p = page({ gtag: function () { calls++; } }, '1');
  assert.strictEqual(p.listeners.input.length + p.listeners.change.length, 0);
  p.fire('input', field);
  assert.strictEqual(calls, 0);
  // Only '1' means Do Not Track.
  page({ gtag: function () { calls++; } }, '0').fire('input', field);
  assert.strictEqual(calls, 1);
});

test('inputs outside a tool and script-made events are ignored', function () {
  var calls = 0;
  var p = page({ gtag: function () { calls++; } });
  p.fire('input', outside);
  p.fire('input', field, false);
  assert.strictEqual(calls, 0);
  p.fire('input', field);
  assert.strictEqual(calls, 1);
});

test('odd tool names are never sent', function () {
  var calls = 0;
  var p = page({ gtag: function () { calls++; } });
  p.fire('input', el(null, el({ 'data-oc-tool': 'Time Card <b>' })));
  p.fire('input', el(null, el({ 'data-oc-tool': new Array(42).join('x') })));
  assert.strictEqual(calls, 0);
});

test('a throwing gtag or dataLayer never reaches the tool, and is not retried', function () {
  var calls = 0;
  var p = page({ gtag: function () { calls++; throw new Error('blocked'); } });
  assert.doesNotThrow(function () { p.fire('input', field); });
  p.fire('input', field);
  assert.strictEqual(calls, 1);
  var q = page({ dataLayer: { push: function () { throw new Error('blocked'); } } });
  assert.doesNotThrow(function () { q.fire('input', field); });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exitCode = failed ? 1 : 0;
