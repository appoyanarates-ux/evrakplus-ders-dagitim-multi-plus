'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const relDir = path.join(root, 'release');
const files = fs.readdirSync(relDir)
  .filter((f) => f !== 'SHA256SUMS.txt' && fs.statSync(path.join(relDir, f)).isFile())
  .sort();

const lines = files.map((f) => {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(relDir, f))).digest('hex');
  return `${hash}  ${f}`;
});
const outPath = path.join(relDir, 'SHA256SUMS.txt');
fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
console.log('Created SHA256SUMS.txt for', files.length, 'files');
