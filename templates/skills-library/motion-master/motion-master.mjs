#!/usr/bin/env node
/**
 * PopeBot -> Motion Master private API adapter.
 * No dependencies, model downloads, SDK impersonation, or database access.
 * Commands are allowlisted; requests never follow redirects or log secrets.
 *
 * API contract: executiveusa/motionmaster mcp/src/api.ts + projects.ts
 */
import { readFileSync, createWriteStream, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';

const API = '/api/v1';
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const JOB = /^j_[A-Za-z0-9_-]+$/;
const IS_LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);
const MAX_BODY = 64 * 1024 * 1024;
const MAX_BINARY = 512 * 1024 * 1024;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export function originOf(value) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash ||
      (url.pathname !== '/' && url.pathname !== '') ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && IS_LOCAL.has(url.hostname)))) {
    throw new Error('Use an exact HTTPS origin or local loopback HTTP origin, without credentials or paths.');
  }
  return url.origin;
}
function checkedId(value, job = false) {
  if (!(job ? JOB : ID).test(value ?? '')) throw new Error('Invalid Motion Master ID.');
  return value;
}
function nonempty(value, label, max = 20000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(label + ' must be nonempty and within limits.');
  return value;
}
function durationOf(value = '3.5') {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 3600) throw new Error('Duration must be 0–3600 seconds, exclusive of zero.');
  return n;
}

export function client({ env = process.env, fetchImpl = fetch } = {}) {
  const origin = originOf(env.MOTION_MASTER_API_URL ?? '');
  const bearer = env.MOTION_MASTER_API_KEY;
  if (typeof bearer !== 'string' || bearer.trim().length < 32 || bearer !== bearer.trim()) {
    throw new Error('Set a private MOTION_MASTER_API_KEY (at least 32 characters) via PopeBot secret storage.');
  }
  async function request(method, path, body, type = 'json') {
    if (!path.startsWith(API + '/') && path !== API) throw new Error('Non-API route forbidden');
    const headers = { Authorization: 'Bearer ' + bearer };
    if (body !== undefined && type !== 'binary-upload') headers['content-type'] = 'application/json';
    if (type === 'binary-upload') headers['content-type'] = 'application/gzip';
    let response;
    try {
      response = await fetchImpl(origin + path, {
        method, headers, redirect: 'manual', cache: 'no-store',
        signal: AbortSignal.timeout(type === 'stream' ? 90_000 : 20_000),
        ...(body !== undefined ? { body: type === 'binary-upload' ? body : JSON.stringify(body) } : {}),
      });
    } catch {
      throw new Error('Motion Master API unreachable; check private host, key, and network policy.');
    }
    if (response.status >= 300 && response.status < 400) throw new Error('Redirect refused: verify private API origin.');
    if (!response.ok) throw new Error('Motion Master API returned HTTP ' + response.status);
    if (type === 'stream') return response;
    if (Number(response.headers.get('content-length') || 0) > MAX_BODY) throw new Error('Response exceeds maximum size.');
    const data = await response.text();
    if (data.length > MAX_BODY) throw new Error('Response exceeds maximum size.');
    try { return JSON.parse(data); } catch { throw new Error('Invalid API response JSON.'); }
  }
  return { request };
}

async function saveArtifact(response, filename) {
  if (!filename || filename.startsWith('-')) throw new Error('Provide an output filename.');
  const target = resolve(filename);
  const size = Number(response.headers.get('content-length') || 0);
  if (size > MAX_BINARY) throw new Error('Artifact exceeds 512 MiB.');
  if (!response.body) throw new Error('Empty artifact stream.');
  let count = 0;
  const cap = new Transform({
    transform(chunk, _, cb) {
      count += chunk.length;
      cb(count > MAX_BINARY ? new Error('Artifact exceeds 512 MiB.') : null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(response.body), cap, createWriteStream(target, { flags: 'wx', mode: 0o600 }));
  } catch (error) {
    if (error?.code !== 'EEXIST') rmSync(target, { force: true });
    throw error;
  }
  return { file: target, bytes: count };
}

export async function execute(args, options = {}) {
  const [command, ...rest] = args;
  if (!command || command === 'help') return {
    commands: ['health', 'list', 'open ID', 'blocks ID', 'create TITLE BRIEF ON_SCREEN_TEXT [SECONDS]',
      'edit ID OLD_TEXT NEW_TEXT', 'render ID', 'job ID JOB_ID', 'wait ID JOB_ID [TRIES]',
      'download ID JOB_ID OUTPUT.mp4', 'export ID JOB_ID OUTPUT.json.gz',
      'import SOURCE.json.gz', 'cancel ID JOB_ID'],
    note: 'Rendering, saving revisions, and importing are explicit operations. No auto-merge, auto-publish or checkout.',
  };
  const api = client(options);
  const get = path => api.request('GET', API + path);
  const post = (path, body) => api.request('POST', API + path, body);
  switch (command) {
    case 'health':
      return get('/licence').then(data => ({
        reachable: true, onSale: data.status?.onSale ?? null,
        summary: 'Private authenticated API reached; worker/storage not proven.',
      }));
    case 'list':
      return get('/projects');
    case 'open':
      return get('/projects/' + checkedId(rest[0]));
    case 'blocks':
      return get('/blocks/' + checkedId(rest[0]));
    case 'create': {
      const [title, brief, onScreen, seconds] = rest;
      nonempty(title, 'Title', 300); nonempty(brief, 'Brief'); nonempty(onScreen, 'On-screen text', 120);
      const block = await get('/blocks/lt-neon-border');
      const text = block.variables?.find(x => x.type === 'string');
      if (!text || !ID.test(text.id)) throw new Error('Verified lower-third template is unavailable.');
      return post('/projects', { title, brief, shots: [{
        id: 'lt-neon-border', title: 'Lower-third', duration: durationOf(seconds),
        values: { [text.id]: onScreen },
      }] });
    }
    case 'edit': {
      const [id, oldText, newText] = rest;
      checkedId(id); nonempty(oldText, 'Existing text', 120); nonempty(newText, 'Replacement text', 120);
      const opened = await get('/projects/' + id);
      const { project, revision } = opened;
      if (project.currentRevision !== revision.number) throw new Error('Project revision mismatch; reload.');
      let replacements = 0;
      const change = s => {
        if (typeof s !== 'string' || !s.includes(oldText)) return s;
        replacements += s.split(oldText).length - 1;
        return s.split(oldText).join(newText);
      };
      const shots = revision.shots.map(s => ({
        ...s, title: change(s.title),
        ...(s.values ? { values: Object.fromEntries(Object.entries(s.values).map(([k, v]) => [k, change(v)])) } : {}),
      }));
      const title = change(revision.title), brief = change(revision.brief);
      if (!replacements) throw new Error('Old text not present. No changes saved.');
      const saved = await post('/projects/' + id + '/revisions', {
        expectedRevision: revision.number, title, brief, shots,
      });
      return { ...saved, replacements, previousRevision: revision.number };
    }
    case 'render': {
      const id = checkedId(rest[0]);
      const opened = await get('/projects/' + id);
      if (!opened.revision.shots?.length) throw new Error('Project contains no renderable shots.');
      return post('/projects/' + id + '/jobs', { revision: opened.revision.number });
    }
    case 'job': {
      const id = checkedId(rest[0]), job = checkedId(rest[1], true);
      return get('/projects/' + id + '/jobs/' + job);
    }
    case 'wait': {
      const id = checkedId(rest[0]), job = checkedId(rest[1], true);
      const tries = Number(rest[2] ?? '20');
      if (!Number.isInteger(tries) || tries < 1 || tries > 120) throw new Error('Tries must be 1–120.');
      for (let i = 0; i < tries; i++) {
        const result = await get('/projects/' + id + '/jobs/' + job);
        if (['ready', 'failed', 'cancelled'].includes(result.status)) return result;
        if (i < tries - 1) await (options.sleepImpl ?? sleep)(3000);
      }
      return { status: 'pending', note: 'Still processing: run job again later; no video claimed.' };
    }
    case 'cancel': {
      const id = checkedId(rest[0]), job = checkedId(rest[1], true);
      return post('/projects/' + id + '/jobs/' + job + '/cancel', {});
    }
    case 'download':
    case 'export': {
      const id = checkedId(rest[0]), job = checkedId(rest[1], true);
      const out = nonempty(rest[2], 'Output path', 1000);
      if (command === 'download' && !out.endsWith('.mp4')) throw new Error('Use an .mp4 output filename.');
      if (command === 'export' && !out.endsWith('.json.gz')) throw new Error('Use a .json.gz output filename.');
      const res = await api.request('GET', API + '/projects/' + id + '/jobs/' + job +
        (command === 'download' ? '/artifact' : '/source'), undefined, 'stream');
      return saveArtifact(res, out);
    }
    case 'import': {
      const filename = nonempty(rest[0], 'Source archive path', 1000);
      if (!filename.endsWith('.json.gz')) throw new Error('Only a .json.gz source archive is accepted.');
      const stat = statSync(filename);
      if (!stat.isFile() || stat.size > MAX_BODY) throw new Error('Source archive is not a valid bounded file.');
      const file = readFileSync(filename);
      return api.request('POST', API + '/projects/import', file, 'binary-upload');
    }
    default:
      throw new Error('Unknown command. Run help for the allowlist.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  execute(process.argv.slice(2))
    .then(x => { process.stdout.write(JSON.stringify(x, null, 2) + '\n'); })
    .catch(error => {
      // Never write request bodies, Authorization values or secrets to logs.
      const message = String(error?.message ?? '').slice(0, 350);
      process.stderr.write('Motion Master: ' + message.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]') + '\n');
      process.exitCode = 1;
    });
}
