import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildSystemPrompt, pickLine, buildQuipPrompt } from '../src/ai/persona.js';

const persona = JSON.parse(fs.readFileSync(new URL('../persona/gicu.json', import.meta.url), 'utf8'));

test('persona are câmpurile esențiale', () => {
  for (const key of ['nume', 'bio', 'stil', 'reguli', 'replici', 'glume']) {
    assert.ok(persona[key], `lipsește ${key}`);
  }
  assert.ok(persona.stil.length >= 5);
  assert.ok(persona.reguli.length >= 4);
});

test('promptul de sistem conține identitatea, starea și uneltele', () => {
  const prompt = buildSystemPrompt({
    persona,
    state: 'Poziție: X=10 Y=64 Z=20',
    memory: 'Fapte: casa e la 10 64 20',
    tools: ['spune', 'sapa'],
    mode: 'tools',
    owner: 'ExMarius',
  });
  assert.match(prompt, /Gicu/);
  assert.match(prompt, /Poziție: X=10/);
  assert.match(prompt, /casa e la 10 64 20/);
  assert.match(prompt, /spune/);
  assert.match(prompt, /română/);
  assert.match(prompt, /nu spui niciodată că ești AI/i);
});

test('modul JSON adaugă formatul obligatoriu', () => {
  const prompt = buildSystemPrompt({ persona, mode: 'json' });
  assert.match(prompt, /"spune"/);
  assert.match(prompt, /"actiuni"/);
});

test('pickLine întoarce o replică existentă sau null', () => {
  const line = pickLine(persona, 'salut', () => 0);
  assert.equal(line, persona.replici.salut[0]);
  assert.equal(pickLine(persona, 'nu-exista'), null);
});

test('promptul pentru reacții e scurt și în română', () => {
  const msgs = buildQuipPrompt({ persona, owner: 'ExMarius', kind: 'creeper', extra: '', state: 'noapte' });
  assert.equal(msgs.length, 2);
  assert.match(msgs[0].content, /Gicu/);
  assert.match(msgs[1].content, /creeper/i);
});
