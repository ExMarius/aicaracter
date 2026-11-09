import test from 'node:test';
import assert from 'node:assert/strict';
import { blueprint, defaultSize } from '../src/minecraft/skills.js';
import { splitChat, cleanForChat } from '../src/util/text.js';
import { stripForSpeech } from '../src/voice/tts.js';

test('casa are podea, pereți, acoperiș și o ușă', () => {
  const plan = blueprint('casa', 5);
  const at = (x, y, z) => plan.some((c) => c.x === x && c.y === y && c.z === z);
  assert.ok(at(0, 0, 0), 'podeaua');
  assert.ok(at(0, 1, 0), 'colț de perete');
  assert.ok(at(0, 4, 0), 'acoperiș');
  assert.ok(!at(2, 1, 0), 'golul ușii');
  assert.ok(!at(2, 2, 0), 'golul ușii sus');
});

test('planul e ordonat de jos în sus (altfel blocurile cad)', () => {
  const plan = blueprint('turn', 6);
  for (let i = 1; i < plan.length; i++) {
    assert.ok(plan[i].y >= plan[i - 1].y);
  }
});

test('fiecare tip de structură produce un plan ne-gol', () => {
  for (const tip of ['casa', 'turn', 'zid', 'pod', 'platforma', 'scari']) {
    const plan = blueprint(tip, 5);
    assert.ok(plan.length > 0, `${tip} e gol`);
  }
  assert.equal(defaultSize('turn'), 6);
  assert.ok(blueprint('inexistent', 5).length > 0, 'fallback pe casă');
});

test('scările urcă treptat', () => {
  const plan = blueprint('scari', 4);
  const maxY = Math.max(...plan.map((c) => c.y));
  assert.equal(maxY, 3);
});

test('splitChat respectă limita de caractere a chatului', () => {
  const text = 'Bă, '.repeat(120);
  const chunks = splitChat(text, 240);
  assert.ok(chunks.length > 1);
  for (const c of chunks) assert.ok(c.length <= 240, `prea lung: ${c.length}`);
});

test('splitChat păstrează textul scurt într-o singură bucată', () => {
  assert.deepEqual(splitChat('Salut, bă!', 240), ['Salut, bă!']);
  assert.deepEqual(splitChat('   ', 240), []);
});

test('cleanForChat scoate markdown-ul', () => {
  assert.equal(cleanForChat('**Bă** `hop`'), 'Bă hop');
});

test('stripForSpeech curăță emoji și taie la propoziție', () => {
  assert.equal(stripForSpeech('Băăă! 😂 Hai!'), 'Băăă!  Hai!'.replace(/\s+/g, ' ').trim());
  const long = `${'propoziție lungă. '.repeat(40)}`;
  const out = stripForSpeech(long, 100);
  assert.ok(out.length <= 101, `prea lung: ${out.length}`);
  assert.ok(out.endsWith('.') || out.endsWith('…'));
});
