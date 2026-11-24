import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const WEB_DIR = path.resolve('apps/web-php-cpanel');

test('cPanel PHP web uygulaması dosya yapısı, .htaccess izolasyonu ve güvenlik kontrolleri', () => {
  const required = [
    'index.php',
    '.htaccess',
    'manifest.json',
    'sw.js',
    'config/config.sample.php',
    'config/bootstrap.php',
    'api/index.php',
    'database/schema.sql',
    'installer/index.php',
    'assets/css/styles.css',
    'assets/js/app.js'
  ];
  for (const rel of required) {
    assert.equal(fs.existsSync(path.join(WEB_DIR, rel)), true, `Eksik cPanel dosyası: ${rel}`);
  }

  // .htaccess WordPress'ten izole RewriteBase ve hassas dizin koruması
  const htaccess = fs.readFileSync(path.join(WEB_DIR, '.htaccess'), 'utf8');
  assert.ok(htaccess.includes('RewriteBase /ders-dagitim-multi-plus/'));
  assert.ok(htaccess.includes('config|database'));
  assert.ok(htaccess.includes('Content-Security-Policy'));

  // PHP API güvenlik kontrolleri (PDO prepared statements, CSRF, rate limit, sahte PHP çözücü olmamalı)
  const apiSrc = fs.readFileSync(path.join(WEB_DIR, 'api/index.php'), 'utf8');
  assert.ok(apiSrc.includes('ep_verify_csrf'));
  assert.ok(apiSrc.includes('ep_rate_limit'));
  assert.ok(apiSrc.includes('export/authorize'));
  assert.ok(apiSrc.includes('/entitlements'), 'Çıktı yetkisi sunucu tarafında WP API ile doğrulanmalı');
  assert.ok(apiSrc.includes('fallbackModes'), 'Sunucu bağlantısı kesildiğinde alternatif modlar raporlanmalı');

  const bootSrc = fs.readFileSync(path.join(WEB_DIR, 'config/bootstrap.php'), 'utf8');
  assert.ok(bootSrc.includes('ATTR_EMULATE_PREPARES => false'));
  assert.ok(bootSrc.includes('evrakplus_multiplus_config.php'), 'Hassas yapılandırma public_html dışından okunabilmeli');

  // Kurulum sihirbazı kilit mekanizması
  const instSrc = fs.readFileSync(path.join(WEB_DIR, 'installer/index.php'), 'utf8');
  assert.ok(instSrc.includes('INSTALL.LOCK'));

  // MySQL şeması temel tabloları
  const sql = fs.readFileSync(path.join(WEB_DIR, 'database/schema.sql'), 'utf8');
  for (const tbl of ['ep_projects', 'ep_sync_tombstones', 'ep_solver_jobs', 'ep_devices', 'ep_audit_logs']) {
    assert.ok(sql.includes(`CREATE TABLE IF NOT EXISTS ${tbl}`), `Eksik SQL tablosu: ${tbl}`);
  }

  // Manifest JSON geçerliliği
  const manifest = JSON.parse(fs.readFileSync(path.join(WEB_DIR, 'manifest.json'), 'utf8'));
  assert.equal(manifest.display, 'standalone');
});
