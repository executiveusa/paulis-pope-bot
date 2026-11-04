/**
 * Cross-repository contract: invoke PopeBot's adapter against a REAL disposable
 * Motion Master HTTP server, not a mocked fetch. Never contact a hosted API.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execute } from './motion-master.mjs';

test('PopeBot controls a real Motion Master project over private authenticated HTTP', { timeout: 45000 }, async t => {
  const repo = process.env.MOTION_MASTER_TEST_REPO;
  if (!repo) return t.skip('External Motion Master checkout is required for this test.');
  const working = resolve(repo);
  const temp = mkdtempSync(join(tmpdir(), 'pope-mm-real-'));
  // Explicitly disposable: no production volumes, HTTP credentials or network.
  const env = {
    ...process.env,
    MOTION_MASTER_REPO_ROOT: working,
    MOTION_MASTER_MCP_HOST: '127.0.0.1',
    MOTION_MASTER_MCP_PORT: '18943',
    MOTION_MASTER_RENDER_WORKER: '0',
    MOTION_MASTER_API_KEY: 'fixture-only-secret-0123456789abcdef',
    MOTION_MASTER_ALLOWED_ORIGINS: 'http://127.0.0.1:18943',
  };
  const child = spawn(process.execPath, ['mcp/dist/index.js'], { cwd: working, env, stdio: 'ignore' });
  t.after(() => { child.kill(); rmSync(temp, { recursive: true, force: true }); });
  const config = {
    env: { MOTION_MASTER_API_URL: 'http://127.0.0.1:18943', MOTION_MASTER_API_KEY: env.MOTION_MASTER_API_KEY },
  };
  let ready = false;
  for (let n = 0; n < 120; n++) {
    try {
      const response = await fetch('http://127.0.0.1:18943/health');
      if (response.ok) { ready = true; break; }
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 100));
  }
  assert.equal(ready, true, 'disposable Motion Master host did not start');

  const protectedResponse = await fetch('http://127.0.0.1:18943/api/v1/projects');
  assert.equal(protectedResponse.status, 401, 'private API must reject anonymous clients');

  const health = await execute(['health'], config);
  assert.equal(health.onSale, false);
  const original = 'PopeBot fixture ACME release';
  const created = await execute(['create', original, 'A 15-second brand introduction for ACME', 'ACME', '15'], config);
  assert.match(created.project.id, /^p_/);
  assert.equal(created.revision.number, 1);
  const id = created.project.id;
  const earlier = await execute(['open', id], config);
  assert.equal(earlier.revision.shots[0].duration, 15);
  const edited = await execute(['edit', id, 'ACME', 'NOVA'], config);
  assert.equal(edited.revision.number, 2);
  const latest = await execute(['open', id], config);
  assert.equal(latest.project.currentRevision, 2);
  assert.ok(latest.revision.brief.includes('NOVA'));
  assert.ok(latest.revision.shots[0].values);
  assert.ok(Object.values(latest.revision.shots[0].values).includes('NOVA'));
  assert.equal(earlier.revision.shots[0].title, 'Lower-third', 'immutable original should remain');
  const rendered = await execute(['render', id], config);
  assert.equal(rendered.status, 'queued', 'no worker enabled; must not claim ready');
  assert.equal(rendered.revision, 2);
  const observed = await execute(['job', id, rendered.id], config);
  assert.equal(observed.status, 'queued');
  await assert.rejects(execute(['download', id, rendered.id, join(temp, 'not-ready.mp4')], config), /HTTP 409/);
});
