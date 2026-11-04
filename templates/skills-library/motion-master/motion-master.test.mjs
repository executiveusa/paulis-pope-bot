import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execute, originOf } from './motion-master.mjs';

const ORIGIN = 'http://127.0.0.1:8787';
const KEY = 'test-owner-private-secret-0123456789';
function fixture(handler) {
  const requests = [];
  const fetchImpl = async (url, opts) => {
    const path = new URL(url).pathname;
    const body = opts.body && opts.headers['content-type'] === 'application/json'
      ? JSON.parse(opts.body) : undefined;
    requests.push({ path, method: opts.method, body, redirect: opts.redirect });
    assert.equal(opts.headers.Authorization, 'Bearer ' + KEY);
    assert.equal(opts.redirect, 'manual');
    const reply = handler(path, opts.method, body);
    return reply instanceof Response ? reply : new Response(JSON.stringify(reply), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  };
  return { requests, options: { env: { MOTION_MASTER_API_URL: ORIGIN, MOTION_MASTER_API_KEY: KEY }, fetchImpl, sleepImpl: async () => {} } };
}
const shot = { id: 'lt-neon-border', title: 'ACME title', duration: 3.5, values: { name: 'ACME' } };
const opened = { project: { id: 'p_test', title: 'ACME launch', currentRevision: 1 }, revision: {
  number: 1, title: 'ACME launch', brief: 'Show ACME', shots: [shot],
} };

test('reject non-private transport, URL credentials and paths', () => {
  assert.equal(originOf('https://motion.example'), 'https://motion.example');
  assert.equal(originOf(ORIGIN), ORIGIN);
  for (const url of ['http://motion.example', 'https://user:secret@motion.example', 'https://motion.example/path',
    'https://motion.example/?x=1', 'file:///tmp/x']) {
    assert.throws(() => originOf(url));
  }
});
test('missing or short owner key fails closed without network calls', async () => {
  let used = false;
  await assert.rejects(execute(['list'], { env: { MOTION_MASTER_API_URL: ORIGIN, MOTION_MASTER_API_KEY: 'short' },
    fetchImpl: async () => { used = true; } }), /MOTION_MASTER_API_KEY/);
  assert.equal(used, false);
});
test('creates from verified block metadata, not a guessed string variable', async () => {
  const f = fixture((path, method, body) => {
    if (path.endsWith('/blocks/lt-neon-border')) return { variables: [{ id: 'headline', type: 'string' }] };
    if (path.endsWith('/projects') && method === 'POST') return { project: { id: 'p_test', currentRevision: 1 }, revision: { number: 1 } };
    throw Error('Unexpected request ' + path);
  });
  const created = await execute(['create', 'ACME launch', '15-second brand introduction', 'ACME', '15'], f.options);
  assert.equal(created.project.id, 'p_test');
  assert.deepEqual(f.requests[1].body.shots, [{
    id: 'lt-neon-border', title: 'Lower-third', duration: 15, values: { headline: 'ACME' },
  }]);
});
test('a text edit preserves the previous revision and includes optimistic version', async () => {
  const f = fixture((path, method, body) => {
    if (method === 'GET') return opened;
    if (method === 'POST') return { project: { currentRevision: 2 }, revision: { number: 2 }, saved: body };
  });
  const result = await execute(['edit', 'p_test', 'ACME', 'NOVA'], f.options);
  assert.equal(result.previousRevision, 1);
  assert.equal(result.revision.number, 2);
  const saved = f.requests[1].body;
  assert.equal(saved.expectedRevision, 1);
  assert.equal(saved.title, 'NOVA launch');
  assert.equal(saved.brief, 'Show NOVA');
  assert.equal(saved.shots[0].values.name, 'NOVA');
  assert.equal(opened.revision.shots[0].values.name, 'ACME', 'source revision must be unchanged');
});
test('no matching text and bad ids cannot create a revision', async () => {
  const f = fixture(() => opened);
  await assert.rejects(execute(['edit', 'p_test', 'MISSING', 'NOVA'], f.options), /not present/);
  assert.equal(f.requests.filter(x => x.method === 'POST').length, 0);
  await assert.rejects(execute(['render', '../etc/passwd'], f.options), /Invalid/);
});
test('render queues only the current saved revision', async () => {
  const f = fixture((path, method, body) => method === 'GET' ? opened : { id: 'j_test', status: 'queued', revision: body.revision });
  const result = await execute(['render', 'p_test'], f.options);
  assert.equal(result.status, 'queued');
  assert.deepEqual(f.requests[1].body, { revision: 1 });
});
test('queued render is never falsely described as ready', async () => {
  let calls = 0;
  const f = fixture(() => { calls++; return { id: 'j_test', status: calls === 3 ? 'ready' : 'rendering' }; });
  const result = await execute(['wait', 'p_test', 'j_test', '3'], f.options);
  assert.equal(result.status, 'ready');
  assert.equal(calls, 3);
  const g = fixture(() => ({ status: 'rendering' }));
  const pending = await execute(['wait', 'p_test', 'j_test', '2'], g.options);
  assert.equal(pending.status, 'pending');
});
test('redirect and missing artifacts are errors', async () => {
  const f = fixture(() => new Response('', { status: 302, headers: { location: 'https://other.example' } }));
  await assert.rejects(execute(['list'], f.options), /Redirect refused/);
});
test('downloads a binary MP4 without overwriting another file', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'popebot-motion-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const output = join(dir, 'acme.mp4');
  const bytes = Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]);
  const f = fixture((path) => {
    assert.match(path, /\/artifact$/);
    return new Response(bytes, { status: 200, headers: { 'content-type': 'video/mp4' } });
  });
  const result = await execute(['download', 'p_test', 'j_test', output], f.options);
  assert.equal(result.bytes, bytes.length);
  assert.deepEqual(readFileSync(output), bytes);
  await assert.rejects(execute(['download', 'p_test', 'j_test', output], f.options));
  assert.deepEqual(readFileSync(output), bytes, 'existing artifact must remain unchanged');
});
test('help has no side effects', async () => {
  const result = await execute(['help'], { env: {} });
  assert.ok(result.commands.includes('edit ID OLD_TEXT NEW_TEXT'));
});
