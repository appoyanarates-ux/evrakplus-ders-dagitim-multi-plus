'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const rendererDir = path.join(root, 'renderer');
const outHtml = path.join(root, 'release', 'EvrakPlus-Ders-Dagitim-Multi-Plus-1.0.0-HTML-Preview.html');
fs.mkdirSync(path.dirname(outHtml), { recursive: true });

let html = fs.readFileSync(path.join(rendererDir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(rendererDir, 'assets', 'styles.css'), 'utf8');
html = html.replace(/<link[^>]*styles\.css[^>]*>/i, `<style>${css}</style>`);
fs.writeFileSync(outHtml, html, 'utf8');
console.log('Created HTML Preview:', outHtml);
