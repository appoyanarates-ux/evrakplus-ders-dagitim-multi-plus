'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Saf Node.js ile 256x256 PNG ve Windows ICO olusturucu (harici bagimlilik gerektirmez)
const CRC_TABLE = (() => {
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
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createIconPng(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const rCorner = size * 0.22;

  for (let y = 0; y < size; y++) {
    const rowOff = y * (size * 4 + 1);
    raw[rowOff] = 0; // filter None
    for (let x = 0; x < size; x++) {
      const px = rowOff + 1 + x * 4;
      // Yuvarlatilmis kare icinde mi?
      const dx = Math.max(rCorner - x, 0, x - (size - 1 - rCorner));
      const dy = Math.max(rCorner - y, 0, y - (size - 1 - rCorner));
      const dist = Math.hypot(dx, dy);
      if (dist > rCorner) {
        raw[px] = 0; raw[px + 1] = 0; raw[px + 2] = 0; raw[px + 3] = 0;
        continue;
      }

      // Indigo -> koyu mavi dikey gecis (#4f46e5 -> #1e1b4b)
      const t = y / size;
      let R = Math.round(79 * (1 - t) + 30 * t);
      let G = Math.round(70 * (1 - t) + 27 * t);
      let B = Math.round(229 * (1 - t) + 75 * t);
      let A = 255;

      // Beyaz takvim/cizelge cercevesi
      const nx = x / size;
      const ny = y / size;
      const inCard = nx >= 0.18 && nx <= 0.82 && ny >= 0.22 && ny <= 0.82;
      const inHeader = nx >= 0.18 && nx <= 0.82 && ny >= 0.22 && ny <= 0.35;
      const inPin1 = nx >= 0.30 && nx <= 0.37 && ny >= 0.14 && ny <= 0.27;
      const inPin2 = nx >= 0.63 && nx <= 0.70 && ny >= 0.14 && ny <= 0.27;

      if (inPin1 || inPin2) {
        R = 255; G = 255; B = 255;
      } else if (inHeader) {
        R = 165; G = 180; B = 252; // indigo-300
      } else if (inCard) {
        R = 255; G = 255; B = 255;
        // 3x3 ders programi blok izgara hucreleri
        const gx = (nx - 0.23) / 0.54;
        const gy = (ny - 0.40) / 0.37;
        if (gx >= 0 && gx <= 1 && gy >= 0 && gy <= 1) {
          const col = Math.floor(gx * 3);
          const row = Math.floor(gy * 3);
          const lx = (gx * 3) - col;
          const ly = (gy * 3) - row;
          if (lx > 0.12 && lx < 0.88 && ly > 0.14 && ly < 0.86) {
            if ((col + row) % 2 === 0) {
              R = 79; G = 70; B = 229; // indigo-600
            } else {
              R = 16; G = 185; B = 129; // emerald-500 (dogrulanmis yerlesim)
            }
          }
        }
      }

      raw[px] = R; raw[px + 1] = G; raw[px + 2] = B; raw[px + 3] = A;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function buildIco(pngBuffers, sizes) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // ICO
  header.writeUInt16LE(count, 4);

  const entries = [];
  let offset = 6 + count * 16;
  for (let i = 0; i < count; i++) {
    const s = sizes[i];
    const buf = pngBuffers[i];
    const entry = Buffer.alloc(16);
    entry[0] = s >= 256 ? 0 : s;
    entry[1] = s >= 256 ? 0 : s;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += buf.length;
  }
  return Buffer.concat([header, ...entries, ...pngBuffers]);
}

const buildDir = path.resolve(__dirname, '../build');
const assetsDir = path.resolve(__dirname, '../renderer/assets');
fs.mkdirSync(buildDir, { recursive: true });
fs.mkdirSync(assetsDir, { recursive: true });

const sizes = [256, 64, 48, 32, 16];
const pngs = sizes.map((s) => createIconPng(s));
const ico = buildIco(pngs, sizes);
fs.writeFileSync(path.join(buildDir, 'icon.ico'), ico);
fs.writeFileSync(path.join(buildDir, 'icon.png'), pngs[0]);

// Mobil PWA (Android Chrome & iOS Safari) simgeleri
const pwa192 = createIconPng(192);
const pwa512 = createIconPng(512);
const apple180 = createIconPng(180);
fs.writeFileSync(path.join(assetsDir, 'icon-192.png'), pwa192);
fs.writeFileSync(path.join(assetsDir, 'icon-512.png'), pwa512);
fs.writeFileSync(path.join(assetsDir, 'icon-maskable-512.png'), pwa512);
fs.writeFileSync(path.join(assetsDir, 'apple-touch-icon.png'), apple180);

console.log(`Simge olusturuldu: build/icon.ico (${ico.length} bayt), PWA PNG'leri (180/192/512) -> renderer/assets/`);
