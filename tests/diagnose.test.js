import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseKickReason, motdToText } from '../src/util/diagnose.js';

test('motdToText transformă componentele chat în text', () => {
  assert.equal(motdToText('salut'), 'salut');
  assert.equal(motdToText({ text: 'Bine ai venit' }), 'Bine ai venit');
  assert.equal(
    motdToText({ text: 'A', extra: [{ text: 'B' }, { text: 'C' }] }),
    'ABC',
  );
  assert.equal(motdToText({ translate: 'multiplayer.disconnect.not_whitelisted' }), 'multiplayer.disconnect.not_whitelisted');
  assert.equal(motdToText('{"text":"din JSON"}'), 'din JSON');
  assert.equal(motdToText(null), '');
});

test('whitelist → sfat cu comanda exactă', () => {
  const advice = diagnoseKickReason('You are not whitelisted on this server!', { username: 'Gicu' });
  assert.ok(advice.some((l) => l.includes('whitelist add Gicu')));
});

test('online-mode → explică ambele variante', () => {
  const advice = diagnoseKickReason('Failed to verify username!', { username: 'Gicu' });
  assert.ok(advice.some((l) => /MC_AUTH=microsoft/.test(l)));
  assert.ok(advice.some((l) => /online-mode=false/.test(l)));
});

test('versiune greșită → MC_VERSION=auto', () => {
  const advice = diagnoseKickReason('Outdated client! Please use 1.21.4', { username: 'Gicu' });
  assert.ok(advice.some((l) => l.includes('MC_VERSION=auto')));
});

test('AuthMe → parola în .env', () => {
  const advice = diagnoseKickReason('Please login with /login <password>', { username: 'Gicu' });
  assert.ok(advice.some((l) => l.includes('MC_PASSWORD')));
  assert.ok(advice.some((l) => l.includes('MC_AUTH_COMMAND')));
});

test('anti-bot și motiv necunoscut', () => {
  assert.ok(diagnoseKickReason('Bot detected, connection closed').length > 0);
  assert.deepEqual(diagnoseKickReason('ceva complet necunoscut'), []);
  assert.deepEqual(diagnoseKickReason(null), []);
});
