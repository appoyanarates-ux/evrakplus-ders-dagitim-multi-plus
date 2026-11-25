'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const stage = 'D:\\_build_cache\\cpanel_stage';
const pkg = require(path.join(root, 'package.json'));
const outZip = path.join(root, 'release', `DersOptima-Pro-Haftalik-Ders-Dagitim-Programi-${pkg.version}-cPanel.zip`);

fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
fs.mkdirSync(path.dirname(outZip), { recursive: true });

fs.cpSync(path.join(root, 'renderer'), stage, { recursive: true });
fs.cpSync(path.join(root, 'web'), stage, { recursive: true });

if (fs.existsSync(outZip)) fs.unlinkSync(outZip);
execFileSync('powershell', [
  '-NoProfile', '-Command',
  `Compress-Archive -Path "${stage}\\*" -DestinationPath "${outZip}" -Force`
], { stdio: 'inherit' });
fs.rmSync(stage, { recursive: true, force: true });
console.log('Created cPanel ZIP:', outZip);
