import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { LLM, LLMError } from '../src/ai/llm.js';

/** Pornește un server OpenAI-compatible fals și îl închide la final. */
async function withServer(handler, fn) {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let parsed = {};
      try {
        parsed = JSON.parse(body || '{}');
      } catch {
        /* ignorat */
      }
      const reply = handler(parsed, res, req);
      if (reply !== undefined && !res.writableEnded) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(reply));
      }
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}/v1`, server);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const cfg = (baseUrl, extra = {}) => ({
  baseUrl,
  apiKey: 'test-key',
  model: 'test-model',
  temperature: 0.5,
  maxTokens: 100,
  mode: 'tools',
  timeoutMs: 3000,
  ...extra,
});

test('citește răspunsul simplu', async () => {
  await withServer(
    () => ({ choices: [{ message: { role: 'assistant', content: 'Bă, salut!' } }] }),
    async (url) => {
      const llm = new LLM(cfg(url), null);
      const res = await llm.chat([{ role: 'user', content: 'salut' }]);
      assert.equal(res.content, 'Bă, salut!');
      assert.equal(res.toolCalls.length, 0);
    },
  );
});

test('parsează tool_calls cu argumente JSON', async () => {
  await withServer(
    () => ({
      choices: [
        {
          message: {
            content: '',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'sapa', arguments: '{"bloc":"stone","cantitate":3}' },
              },
            ],
          },
        },
      ],
    }),
    async (url) => {
      const llm = new LLM(cfg(url), null);
      const res = await llm.chat([{ role: 'user', content: 'sapă' }], { tools: [{ type: 'function', function: { name: 'sapa' } }] });
      assert.equal(res.toolCalls.length, 1);
      assert.equal(res.toolCalls[0].name, 'sapa');
      assert.deepEqual(res.toolCalls[0].args, { bloc: 'stone', cantitate: 3 });
    },
  );
});

test('reîncearcă după 429', async () => {
  let calls = 0;
  await withServer(
    (body, res) => {
      calls += 1;
      if (calls === 1) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'rate limited' } }));
        return undefined;
      }
      return { choices: [{ message: { content: 'ok după retry' } }] };
    },
    async (url) => {
      const llm = new LLM(cfg(url), null);
      const res = await llm.chat([{ role: 'user', content: 'test' }]);
      assert.equal(res.content, 'ok după retry');
      assert.ok(calls >= 2);
    },
  );
});

test('trece automat pe mod JSON dacă modelul nu suportă tools', async () => {
  let calls = 0;
  await withServer(
    (body, res) => {
      calls += 1;
      if (calls === 1) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'tools are not supported by this model' } }));
        return undefined;
      }
      assert.equal(body.tools, undefined, 'al doilea request nu mai trimite tools');
      return { choices: [{ message: { content: '{"spune":"Hop","actiuni":[]}' } }] };
    },
    async (url) => {
      const llm = new LLM(cfg(url), { warn: () => {} });
      const res = await llm.chat([{ role: 'user', content: 'test' }], {
        tools: [{ type: 'function', function: { name: 'spune' } }],
      });
      assert.equal(llm.mode, 'json');
      assert.match(res.content, /Hop/);
    },
  );
});

test('raportează eroare clară la 401', async () => {
  await withServer(
    (body, res) => {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'invalid api key' } }));
    },
    async (url) => {
      const llm = new LLM(cfg(url), null);
      await assert.rejects(
        () => llm.chat([{ role: 'user', content: 'test' }]),
        (err) => err instanceof LLMError && /401/.test(err.message) && /invalid api key/.test(err.message),
      );
    },
  );
});

test('nu e configurat fără cheie (și nu face request)', async () => {
  const llm = new LLM(cfg('https://api.openai.com/v1', { apiKey: '' }), null);
  assert.equal(llm.configured, false);
  await assert.rejects(() => llm.chat([{ role: 'user', content: 'x' }]), /cheie API/i);

  const local = new LLM(cfg('http://localhost:11434/v1', { apiKey: '' }), null);
  assert.equal(local.configured, true, 'servere locale funcționează fără cheie');
});

test('respectă anularea', async () => {
  await withServer(
    () => new Promise((resolve) => setTimeout(() => resolve({ choices: [{ message: { content: 'prea târziu' } }] }), 1500)),
    async (url) => {
      const llm = new LLM(cfg(url), null);
      const ctrl = new AbortController();
      const p = llm.chat([{ role: 'user', content: 'test' }], { signal: ctrl.signal });
      setTimeout(() => ctrl.abort(new Error('stop')), 50);
      await assert.rejects(() => p, /anulat/i);
    },
  );
});
