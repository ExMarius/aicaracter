import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, TOOL_NAMES, toolSpecs, getTool } from '../src/ai/tools.js';
import { createActions } from '../src/minecraft/actions.js';

const stubSkills = new Proxy(
  { stateText: () => 'stare', stop: () => {}, wait: async () => {} },
  { get: (t, p) => (p in t ? t[p] : async () => ({ ok: true, mesaj: 'ok' })) },
);

const actions = createActions({ skills: stubSkills, hooks: { say: async () => {}, speak: async () => {} }, log: null });

test('numele uneltelor sunt unice și valide pentru API', () => {
  assert.equal(new Set(TOOL_NAMES).size, TOOL_NAMES.length);
  for (const name of TOOL_NAMES) {
    assert.match(name, /^[a-zA-Z0-9_]{1,64}$/, `nume invalid: ${name}`);
  }
});

test('fiecare unealtă are schemă JSON validă', () => {
  for (const tool of TOOLS) {
    assert.ok(tool.description && tool.description.length > 10, `descriere slabă: ${tool.name}`);
    assert.equal(tool.parameters.type, 'object', `${tool.name} nu are parametri de tip object`);
    assert.ok(tool.parameters.properties, `${tool.name} nu are properties`);
    for (const req of tool.parameters.required || []) {
      assert.ok(tool.parameters.properties[req], `${tool.name}: required "${req}" lipsește din properties`);
    }
  }
});

test('fiecare unealtă are o implementare reală', () => {
  for (const name of TOOL_NAMES) {
    assert.equal(typeof actions[name], 'function', `lipsește implementarea pentru ${name}`);
  }
});

test('toolSpecs produce formatul OpenAI', () => {
  const specs = toolSpecs();
  assert.equal(specs.length, TOOLS.length);
  assert.equal(specs[0].type, 'function');
  assert.ok(specs[0].function.name);
  assert.ok(specs[0].function.parameters);
});

test('getTool găsește după nume', () => {
  assert.equal(getTool('spune').name, 'spune');
  assert.equal(getTool('inexistent'), null);
});

test('acțiunile validează argumentele lipsă fără să arunce', async () => {
  const ctx = { said: false, aborted: () => false };
  const r1 = await actions.mergi_la({}, ctx);
  assert.equal(r1.ok, false);
  assert.match(r1.mesaj, /jucator|x, y/i);

  const r2 = await actions.sapa({}, ctx);
  assert.equal(r2.ok, false);

  const r3 = await actions.pune_bloc({ bloc: 'stone' }, ctx);
  assert.equal(r3.ok, false);
  assert.match(r3.mesaj, /lipsesc/i);
});

test('unealta spune marchează ctx.said și trimite textul', async () => {
  const said = [];
  const acts = createActions({
    skills: stubSkills,
    hooks: { say: async (t) => said.push(t), speak: async () => {} },
  });
  const ctx = { said: false };
  const r = await acts.spune({ text: 'Salut, bă!' }, ctx);
  assert.equal(r.ok, true);
  assert.equal(ctx.said, true);
  assert.deepEqual(said, ['Salut, bă!']);
});

test('unealta retine scrie în memorie', async () => {
  const facts = [];
  const acts = createActions({
    skills: stubSkills,
    hooks: {},
    memory: { addFact: (f) => (facts.push(f), true) },
  });
  const r = await acts.retine({ fapt: 'casa e la 10 64 20' });
  assert.equal(r.ok, true);
  assert.deepEqual(facts, ['casa e la 10 64 20']);
});
