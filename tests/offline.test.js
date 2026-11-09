import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { offlineReply, normalizeRo } from '../src/ai/offline.js';

const persona = JSON.parse(fs.readFileSync(new URL('../persona/gicu.json', import.meta.url), 'utf8'));

const reply = (text) => offlineReply(text, persona, { owner: 'ExMarius' });

test('normalizează diacriticele românești', () => {
  assert.equal(normalizeRo('Îți mulțumesc, șefu!'), 'iti multumesc, sefu!');
  assert.equal(normalizeRo('Sapă un copac'), 'sapa un copac');
});

test('recunoaște salutul', () => {
  const r = reply('Salut, Gicu!');
  assert.ok(persona.replici.salut.includes(r.spune));
});

test('oprește la comandă', () => {
  const r = reply('oprește-te');
  assert.equal(r.actiuni[0].unealta, 'opreste');
});

test('taie copaci cu numărul cerut', () => {
  const r = reply('taie 12 lemne');
  assert.equal(r.actiuni[0].unealta, 'taie_copac');
  assert.equal(r.actiuni[0].argumente.cantitate, 12);
});

test('sapă blocul potrivit', () => {
  const r = reply('sapă 20 de fier');
  assert.equal(r.actiuni[0].unealta, 'sapa');
  assert.equal(r.actiuni[0].argumente.bloc, 'iron_ore');
  assert.equal(r.actiuni[0].argumente.cantitate, 20);
});

test('construiește casa', () => {
  const r = reply('fă-mi o casă');
  assert.equal(r.actiuni[0].unealta, 'construieste');
  assert.equal(r.actiuni[0].argumente.tip, 'casa');
});

test('urmează jucătorul la cerere', () => {
  const r = reply('vino după mine');
  assert.equal(r.actiuni[0].unealta, 'urmeaza');
  assert.equal(r.actiuni[0].argumente.jucator, 'ExMarius');
});

test('răspunde și la text necunoscut', () => {
  const r = reply('zbor cu porcii pe lună');
  assert.ok(typeof r.spune === 'string' && r.spune.length > 5);
  assert.ok(Array.isArray(r.actiuni));
});
