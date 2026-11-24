const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const assetsDir = path.join(root, 'renderer', 'assets');
fs.mkdirSync(assetsDir, { recursive: true });

const copies = [
  {
    src: path.join(root, 'node_modules', 'lucide', 'dist', 'umd', 'lucide.min.js'),
    dest: path.join(assetsDir, 'lucide.min.js')
  },
  {
    src: path.join(root, 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js'),
    dest: path.join(assetsDir, 'xlsx.full.min.js')
  }
];

for (const item of copies) {
  if (!fs.existsSync(item.src)) {
    throw new Error(`Eksik varlik dosyasi: ${item.src}`);
  }
  fs.copyFileSync(item.src, item.dest);
  console.log(`Kopyalandi: ${path.relative(root, item.dest)}`);
}
