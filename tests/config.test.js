import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv, buildConfig, deepMerge } from '../src/config.js';

test('parseEnv citește KEY=VALUE, ignoră comentarii și ghilimele', () => {
  const env = parseEnv(`
# comentariu
MC_HOST=play.server.ro
MC_PORT=25565
LLM_MODEL="gpt-4o-mini"
TTS_VOICE='ro-RO-EmilNeural'
GOAL=
  `);
  assert.equal(env.MC_HOST, 'play.server.ro');
  assert.equal(env.LLM_MODEL, 'gpt-4o-mini');
  assert.equal(env.TTS_VOICE, 'ro-RO-EmilNeural');
  assert.equal(env.GOAL, '');
  assert.equal(env['# comentariu'], undefined);
});

test('buildConfig are valori implicite sănătoase', () => {
  const cfg = buildConfig();
  assert.equal(cfg.minecraft.version, '1.21.4');
  assert.equal(cfg.minecraft.port, 25565);
  assert.ok(Array.isArray(cfg.minecraft.owners));
  assert.equal(cfg.ai.mode, 'tools');
  assert.ok(cfg.voice.voice.startsWith('ro-RO'));
});

test('buildConfig aplică suprascrieri ad-hoc', () => {
  const cfg = buildConfig({ minecraft: { host: 'test.local', owners: ['ana'] }, ai: { temperature: 0.1 } });
  assert.equal(cfg.minecraft.host, 'test.local');
  assert.deepEqual(cfg.minecraft.owners, ['ana']);
  assert.equal(cfg.ai.temperature, 0.1);
  // restul rămâne intact
  assert.equal(cfg.minecraft.port, 25565);
});

test('deepMerge nu distruge obiectele imbricate', () => {
  const merged = deepMerge({ a: { x: 1, y: 2 }, b: 3 }, { a: { y: 9 }, c: 4 });
  assert.deepEqual(merged, { a: { x: 1, y: 9 }, b: 3, c: 4 });
});

test('MC_VERSION=auto lasă versiunea să fie detectată de mineflayer', () => {
  const old = process.env.MC_VERSION;
  process.env.MC_VERSION = 'auto';
  try {
    const cfg = buildConfig();
    assert.equal(cfg.minecraft.version, null);
    assert.equal(cfg.minecraft.versionRaw, 'auto');
  } finally {
    if (old === undefined) delete process.env.MC_VERSION;
    else process.env.MC_VERSION = old;
  }
});

test('opțiunile pentru panouri (Pterodactyl) sunt citite corect', () => {
  const old = { ...process.env };
  process.env.MC_VERSION = '1.21.4';
  process.env.MC_AUTH_COMMAND = '/cp login {parola}';
  process.env.MC_PASSWORD = 'secreta';
  try {
    const cfg = buildConfig();
    assert.equal(cfg.minecraft.version, '1.21.4');
    assert.equal(cfg.minecraft.authCommand, '/cp login {parola}');
    assert.equal(cfg.minecraft.password, 'secreta');
  } finally {
    for (const k of ['MC_VERSION', 'MC_AUTH_COMMAND', 'MC_PASSWORD']) {
      if (old[k] === undefined) delete process.env[k];
      else process.env[k] = old[k];
    }
  }
});
