import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Brain, parseEnvelope, cleanReply } from '../src/ai/brain.js';
import { buildConfig } from '../src/config.js';

const persona = JSON.parse(fs.readFileSync(new URL('../persona/gicu.json', import.meta.url), 'utf8'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeBrain({ llm, actions = {}, state = 'Poziție: X=0 Y=64 Z=0' } = {}) {
  const config = buildConfig({ ai: { maxSteps: 3, historyTurns: 4 } });
  const said = [];
  const spoken = [];
  const memory = { added: [], addFact(f) { this.added.push(f); }, addEvent() {}, notePlayer() {}, summary: () => '' };
  const hooks = {
    getOwner: () => 'ExMarius',
    say: async (t) => said.push(t),
    speak: async (t) => spoken.push(t),
    state: async () => state,
    stopAll: () => {},
    setVoice: () => {},
  };
  const brain = new Brain({ config, persona, llm, memory, actions, hooks, log: null });
  return { brain, said, spoken, memory, config };
}

test('duce la capăt un tur cu function calling', async () => {
  let calls = 0;
  const llm = {
    configured: true,
    mode: 'tools',
    get usingTools() { return true; },
    async chat() {
      calls += 1;
      if (calls === 1) {
        return { content: '', toolCalls: [{ id: 'c1', name: 'spune', args: { text: 'Salut, bă!' } }], usage: null };
      }
      return { content: 'Gata, am spus.', toolCalls: [], usage: null };
    },
  };
  const executed = [];
  const { brain, said, spoken } = makeBrain({
    llm,
    actions: {
      spune: async (args) => {
        executed.push(args.text);
        return { ok: true, mesaj: 'spus' };
      },
    },
  });

  await brain.handleMessage('ExMarius', 'salut');
  assert.equal(calls, 2);
  assert.deepEqual(executed, ['Salut, bă!']);
  assert.ok(said.includes('Gata, am spus.'));
  assert.ok(spoken.includes('Gata, am spus.'));
});

test('execută unelte reale și trimite rezultatul înapoi modelului', async () => {
  const seen = [];
  let calls = 0;
  const llm = {
    configured: true,
    mode: 'tools',
    get usingTools() { return true; },
    async chat(messages) {
      calls += 1;
      seen.push(messages.at(-1));
      if (calls === 1) {
        return { content: '', toolCalls: [{ id: 'c1', name: 'sapa', args: { bloc: 'stone', cantitate: 2 } }], usage: null };
      }
      return { content: 'Am terminat de săpat.', toolCalls: [], usage: null };
    },
  };
  const { brain } = makeBrain({
    llm,
    actions: { sapa: async () => ({ ok: true, mesaj: 'Am adunat 2 stone.' }) },
  });

  await brain.handleMessage('ExMarius', 'sapă două pietre');
  const toolMessage = seen.find((m) => m.role === 'tool');
  assert.ok(toolMessage);
  assert.match(toolMessage.content, /Am adunat 2 stone/);
});

test('modul JSON execută acțiunile din răspuns', async () => {
  let calls = 0;
  const llm = {
    configured: true,
    mode: 'json',
    get usingTools() { return false; },
    async chat() {
      calls += 1;
      if (calls === 1) {
        return { content: '{"spune":"Sap acum!","actiuni":[{"unealta":"sapa","argumente":{"bloc":"dirt","cantitate":1}}]}', toolCalls: [], usage: null };
      }
      return { content: '{"spune":"Gata!","actiuni":[]}', toolCalls: [], usage: null };
    },
  };
  const executed = [];
  const { brain, said } = makeBrain({ llm, actions: { sapa: async (a) => (executed.push(a.bloc), { ok: true }) } });

  await brain.handleMessage('ExMarius', 'sapă pământ');
  assert.deepEqual(executed, ['dirt']);
  assert.ok(said.includes('Sap acum!'));
  assert.ok(said.includes('Gata!'));
});

test('fără LLM folosește creierul de rezervă și tot execută acțiuni', async () => {
  const llm = { configured: false, mode: 'tools', usingTools: true, async chat() { throw new Error('nu ar trebui apelat'); } };
  const executed = [];
  const { brain, said } = makeBrain({ llm, actions: { taie_copac: async (a) => (executed.push(a.cantitate), { ok: true }) } });

  await brain.handleMessage('ExMarius', 'taie 5 lemne');
  assert.deepEqual(executed, [5]);
  assert.ok(said.some((s) => /lemn/i.test(s)));
});

test('comenzile ! merg direct, fără model', async () => {
  const llm = { configured: true, mode: 'tools', usingTools: true, async chat() { throw new Error('nu'); } };
  const { brain, said, memory } = makeBrain({ llm });
  await brain.handleMessage('ExMarius', '!retine casa e la 10 64 20');
  assert.deepEqual(memory.added, ['casa e la 10 64 20']);
  assert.ok(said.some((s) => /10 64 20/.test(s)));

  await brain.handleMessage('ExMarius', '!stop');
  assert.ok(said.some((s) => /oprit/i.test(s)));
});

test('ignoră jucătorii care nu sunt proprietari', async () => {
  const llm = { configured: true, mode: 'tools', usingTools: true, async chat() { throw new Error('nu'); } };
  const { brain, said } = makeBrain({ llm });
  await brain.handleMessage('AltCineva', 'fă-mi o casă');
  assert.equal(said.length, 0);
});

test('interrupt oprește un tur în curs', async () => {
  const llm = {
    configured: true,
    mode: 'tools',
    usingTools: true,
    chat(messages, { signal } = {}) {
      return new Promise((_, reject) => {
        signal?.addEventListener('abort', () => reject(new Error('anulat')), { once: true });
      });
    },
  };
  const { brain, said } = makeBrain({ llm });
  const running = brain.handleMessage('ExMarius', 'construiește o casă');
  await sleep(20);
  brain.interrupt('test');
  await running;
  assert.equal(said.length, 0);
  assert.equal(brain.busy, false);
});

test('quip folosește replica din persona când nu există LLM', async () => {
  const llm = { configured: false, mode: 'tools', usingTools: true };
  const { brain, said } = makeBrain({ llm });
  await brain.quip('creeper');
  assert.equal(said.length, 1);
  assert.ok(persona.replici.creeper.includes(said[0]));
});

test('parseEnvelope extrage JSON din text și din code fence', () => {
  const a = parseEnvelope('sigur, uite: {"spune":"Bă!","actiuni":[{"unealta":"sapa","argumente":{"bloc":"stone"}}]}');
  assert.equal(a.spune, 'Bă!');
  assert.equal(a.actiuni[0].unealta, 'sapa');

  const b = parseEnvelope('```json\n{"spune":"Hop","actiuni":[]}\n```');
  assert.equal(b.spune, 'Hop');

  assert.equal(parseEnvelope('nu e json'), null);
});

test('cleanReply curăță prefixele și markdown-ul', () => {
  assert.equal(cleanReply('Gicu: Bă, salut!'), 'Bă, salut!');
  assert.equal(cleanReply('**Bă**, [salut]'), 'Bă, [salut]');
  assert.equal(cleanReply('"Ce faci?"'), 'Ce faci?');
});
