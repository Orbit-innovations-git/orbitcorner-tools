/**
 * Runs every tests/*.test.js file, each in its own Node process, and every tests/*.test.php
 * file with PHP when PHP is installed.
 *
 *   node tests/run-all.js
 */
'use strict';

var fs = require('fs');
var path = require('path');
var spawnSync = require('child_process').spawnSync;

var hasPhp = !spawnSync('php', ['-v']).error;
var files = fs.readdirSync(__dirname).filter(function (file) {
  return /\.test\.js$/.test(file) || (hasPhp && /\.test\.php$/.test(file));
}).sort();
var failedFiles = [];

files.forEach(function (file) {
  console.log('\n' + file);
  var run = spawnSync(/\.php$/.test(file) ? 'php' : process.execPath, [path.join(__dirname, file)], { stdio: 'inherit' });
  if (run.status !== 0) {
    failedFiles.push(file);
  }
});
if (!hasPhp) {
  console.log('\nPHP is not installed: skipped the *.test.php files.');
}

console.log('\n' + (failedFiles.length ? 'FAILED: ' + failedFiles.join(', ') : 'All ' + files.length + ' test files passed.'));
process.exitCode = failedFiles.length ? 1 : 0;
