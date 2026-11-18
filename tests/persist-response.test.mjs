import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { persistBeforeResponse } from '../server/persist-response.mjs';

const serve = app => new Promise(resolve => {
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

test('a write response waits until the Neon save finishes', async () => {
  let release;
  const saved = new Promise(resolve => { release = resolve; });
  const app = express();
  app.use(persistBeforeResponse(() => saved));
  app.post('/write', (_req, res) => res.json({ ok: true }));
  const server = await serve(app);
  try {
    const request = fetch(`http://127.0.0.1:${server.address().port}/write`, { method: 'POST' });
    const early = await Promise.race([request.then(() => 'responded'), new Promise(resolve => setTimeout(() => resolve('waiting'), 30))]);
    assert.equal(early, 'waiting');
    release();
    const response = await request;
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  } finally { server.close(); }
});

test('a failed Neon save does not return success or an auth cookie', async () => {
  const app = express();
  app.use(persistBeforeResponse(() => Promise.reject(new Error('database offline'))));
  app.post('/write', (_req, res) => res.cookie('session', 'secret').json({ ok: true }));
  const server = await serve(app);
  const priorError = console.error;
  console.error = () => {};
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/write`, { method: 'POST' });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.match((await response.json()).error, /Could not save to Neon/);
  } finally { console.error = priorError; server.close(); }
});
