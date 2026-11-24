'use strict';

/**
 * POSIX (/) yol ayiricili, UTF-8 bayrakli saf Node.js ZIP paketleyici.
 * PowerShell Compress-Archive'in Windows '\' ayiricisi kullanip Linux cPanel/WordPress
 * sunucularinda klasor yapisi bozmasi riskini tamamen ortadan kaldirir.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function collectFiles(baseRoot, relPaths, stripPrefix = '') {
  const entries = [];
  const normStrip = stripPrefix ? stripPrefix.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') + '/' : '';
  function walk(absPath, zipRel) {
    const stat = fs.statSync(absPath);
    let posixName = zipRel.split(path.sep).join('/').replace(/^\/+/, '');
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(absPath)) {
        if (child === '__pycache__' || child === '.pytest_cache' || child === 'node_modules') continue;
        walk(path.join(absPath, child), posixName ? `${posixName}/${child}` : child);
      }
    } else if (stat.isFile()) {
      if (normStrip && posixName.startsWith(normStrip)) {
        posixName = posixName.slice(normStrip.length);
      }
      entries.push({ name: posixName, data: fs.readFileSync(absPath) });
    }
  }
  for (const rel of relPaths) {
    const abs = path.resolve(baseRoot, rel);
    if (!fs.existsSync(abs)) {
      throw new Error(`ZIP kaynağı bulunamadı: ${rel}`);
    }
    walk(abs, rel.replace(/\\/g, '/'));
  }
  return entries;
}

function buildZipBuffer(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    // Kesinlikle POSIX '/' ayirici kullan
    const cleanName = entry.name.replace(/\\/g, '/');
    const nameBuf = Buffer.from(cleanName, 'utf8');
    const raw = entry.data;
    const compressed = zlib.deflateRawSync(raw, { level: 6 });
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8
    local.writeUInt16LE(8, 8);      // Deflate
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);

    localParts.push(local, nameBuf, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4); // Unix / POSIX uyumlu
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8); // UTF-8
    central.writeUInt16LE(8, 10);     // Deflate
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // POSIX 0644 dosya izni
    central.writeUInt32LE(offset, 42);

    centralParts.push(central, nameBuf);
    offset += local.length + nameBuf.length + compressed.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, centralBuf, eocd]);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  let stripPrefix = '';
  const filtered = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--strip-prefix' && args[i + 1]) {
      stripPrefix = args[++i];
    } else {
      filtered.push(args[i]);
    }
  }
  const [outZip, ...inputs] = filtered;
  if (!outZip || inputs.length === 0) {
    console.error('Kullanım: node scripts/create_zip.cjs [--strip-prefix klasor] <hedef.zip> <dosya_veya_klasor...>');
    process.exit(1);
  }
  const root = path.resolve(__dirname, '..');
  const entries = collectFiles(root, inputs, stripPrefix);
  const buf = buildZipBuffer(entries);
  const outAbs = path.resolve(root, outZip);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, buf);
  console.log(`POSIX ZIP oluşturuldu: ${outZip} (${entries.length} dosya, ${buf.length} bayt)`);
}

module.exports = { collectFiles, buildZipBuffer };
