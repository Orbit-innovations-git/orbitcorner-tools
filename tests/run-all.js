/**
 * Runs every tests/*.test.js file, each in its own Node process.
 *
 *   node tests/run-all.js
 */
'use strict';

var fs = require('fs');
var path = require('path');
var spawnSync = require('child_process').spawnSync;

var files = fs.readdirSync(__dirname).filter(function (file) {
  return /\.test\.js$/.test(file);
}).sort();
var failedFiles = [];

files.forEach(function (file) {
  console.log('\n' + file);
  var run = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit' });
  if (run.status !== 0) {
    failedFiles.push(file);
  }
});

console.log('\n' + (failedFiles.length ? 'FAILED: ' + failedFiles.join(', ') : 'All ' + files.length + ' test files passed.'));
process.exitCode = failedFiles.length ? 1 : 0;
