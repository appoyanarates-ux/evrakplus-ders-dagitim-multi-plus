import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { buildSolverInput, SolverStatus } from '../../packages/core-schema/src/index.js';
import { validateSchedule } from '../../packages/validator/src/index.js';
import { resolvePythonBinary } from '../../engines/ortools/adapter.js';
import { generateRealisticSchool } from '../profiles/school-generator.js';

async function waitForHealth(baseUrl, timeoutMs = 10000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const r = await fetch(`${baseUrl}/health`);
      if (r.ok) return await r.json();
    } catch { /* wait */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('Solver Server ayağa kalkmadı');
}

test('Linux Solver Server (FastAPI): gerçek HTTP uç noktaları (/health, /engines, /jobs, /progress, /result, /cancel) + doğrulama', async () => {
  // Dockerfile ve docker-compose.yml varlığı
  assert.equal(fs.existsSync(path.resolve('apps/solver-server/Dockerfile')), true);
  assert.equal(fs.existsSync(path.resolve('apps/solver-server/docker-compose.yml')), true);

  const pyBin = resolvePythonBinary();
  const port = 18089;
  const baseUrl = `http://127.0.0.1:${port}`;
  const testToken = 'test-secret-token-2026';

  const proc = spawn(pyBin, ['-m', 'uvicorn', 'apps.solver-server.main:app', '--host', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env, EVRAKPLUS_SOLVER_TOKEN: testToken },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });

  try {
    const health = await waitForHealth(baseUrl);
    assert.equal(health.ok, true);
    assert.equal(health.version, '1.0.0');

    // Token olmadan /engines reddedilmeli (401)
    const unauth = await fetch(`${baseUrl}/engines`);
    assert.equal(unauth.status, 401);

    // Token ile /engines 6 motoru listelemeli
    const headers = { Authorization: `Bearer ${testToken}`, 'Content-Type': 'application/json' };
    const engResp = await fetch(`${baseUrl}/engines`, { headers });
    assert.equal(engResp.status, 200);
    const engData = await engResp.json();
    assert.equal(engData.engines.ortools.healthy, true);
    assert.equal(engData.engines.highs.healthy, true);
    assert.equal(engData.engines.timefold.healthy, true);
    assert.equal(engData.engines.choco.healthy, true);
    assert.equal(engData.engines.scip.healthy, true);
    assert.equal(engData.engines.minizinc.healthy, true);

    // Gerçek asenkron optimizasyon işi gönder (OR-Tools CP-SAT)
    const proj = generateRealisticSchool('very_small', { withClosedDays: false });
    const solverInput = buildSolverInput(proj, { timeLimitSeconds: 10 });

    const submitResp = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ engine: 'ortools', solverInput, timeLimitSeconds: 10 })
    });
    assert.equal(submitResp.status, 202);
    const { id: jobId } = await submitResp.json();
    assert.ok(jobId);

    // /jobs/{id} ve /jobs/{id}/progress sorgula ve tamamlanmasını bekle
    let status = 'QUEUED';
    const deadline = Date.now() + 20000;
    while (['QUEUED', 'RUNNING'].includes(status) && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 300));
      const pResp = await fetch(`${baseUrl}/jobs/${jobId}/progress`, { headers });
      assert.equal(pResp.status, 200);
      const pData = await pResp.json();
      status = pData.status;
    }

    assert.ok([SolverStatus.OPTIMAL, SolverStatus.FEASIBLE].includes(status), `Beklenen OPTIMAL/FEASIBLE, gelen: ${status}`);

    // /jobs/{id}/result sonucunu bağımsız doğrulayıcıdan geçir!
    const resResp = await fetch(`${baseUrl}/jobs/${jobId}/result`, { headers });
    assert.equal(resResp.status, 200);
    const resData = await resResp.json();
    const val = validateSchedule(solverInput, resData.result.placements, resData.status);
    assert.equal(val.isValid, true, `Sunucu sonucu doğrulayıcıdan geçemedi: ${JSON.stringify(val.hardViolations)}`);

    // /jobs/{id}/cancel testi
    const cancelResp = await fetch(`${baseUrl}/jobs/${jobId}/cancel`, { method: 'POST', headers });
    assert.equal(cancelResp.status, 200);
    const cData = await cancelResp.json();
    assert.equal(cData.status, 'CANCELLED');
  } finally {
    proc.kill('SIGTERM');
  }
});
