'use strict';

const fs = require('fs');
const { signManifestEd25519 } = require('../electron/updater_service.cjs');

const [inputFile, outputSigFile] = process.argv.slice(2);
if (!inputFile || !outputSigFile) {
  console.error('Kullanım: node scripts/sign_manifest.cjs <latest.yml> <latest.yml.sig>');
  process.exit(1);
}

const privateKeyPem = process.env.EPDD_ED25519_PRIVATE_KEY;
if (!privateKeyPem) {
  console.error('HATA: EPDD_ED25519_PRIVATE_KEY ortam değişkeni tanımlı değil.');
  process.exit(1);
}

const manifestBytes = fs.readFileSync(inputFile);
const sigBase64 = signManifestEd25519(manifestBytes, privateKeyPem);
fs.writeFileSync(outputSigFile, sigBase64 + '\n', 'utf8');
console.log(`Manifest Ed25519 ile imzalandı: ${outputSigFile}`);
