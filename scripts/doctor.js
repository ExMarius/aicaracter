#!/usr/bin/env node
/**
 * "Doctorul": verifică tot ce trebuie ca Gicu să meargă, înainte de filmare.
 *   npm run doctor
 */
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import { buildConfig, loadDotEnv, loadPersona, ROOT } from '../src/config.js';
import { createLogger } from '../src/util/logger.js';
import { LLM } from '../src/ai/llm.js';
import { Voice, detectPlayer } from '../src/voice/tts.js';

const log = createLogger({ level: 'info', logDir: null });
const results = [];
const ok = (name, detail = '') => results.push({ ok: true, name, detail });
const bad = (name, detail = '') => results.push({ ok: false, name, detail });
const info = (name, detail = '') => results.push({ ok: null, name, detail });

console.log('\n🩺  Verificare GICU\n');

// 1. Node
const major = Number(process.version.replace('v', '').split('.')[0]);
if (major >= 20) ok('Node.js', process.version);
else bad('Node.js', `${process.version} — îți trebuie 20 sau mai nou: https://nodejs.org`);

// 2. .env
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  loadDotEnv(envPath);
  ok('.env', 'găsit');
} else {
  bad('.env', 'lipsește — copiază .env.example în .env (fără el merge doar în modul offline)');
}

const config = buildConfig();

// 3. Personalitate
try {
  const persona = loadPersona(config.personaFile, log);
  ok('Personalitate', `${persona.nume} — ${persona.stil?.length || 0} reguli de stil`);
} catch (err) {
  bad('Personalitate', err.message);
}

// 4. LLM
const llm = new LLM(config.ai, log);
if (!llm.configured) {
  bad('Creier (LLM)', 'fără cheie API — pune LLM_API_KEY în .env (sau rulează --offline)');
} else {
  const start = Date.now();
  try {
    const res = await llm.chat(
      [
        { role: 'system', content: 'Răspunde doar cu: OK' },
        { role: 'user', content: 'test' },
      ],
      { maxTokens: 10, temperature: 0 },
    );
    ok('Creier (LLM)', `${config.ai.model} răspunde în ${Date.now() - start}ms → "${(res.content || '').slice(0, 40)}"`);
  } catch (err) {
    bad('Creier (LLM)', `${config.ai.model}: ${err.message}`);
  }
}

// 5. Voce
if (!config.voice.enabled) {
  info('Voce', 'oprită din config (TTS_ENABLED=false)');
} else {
  const player = config.voice.playerCmd || detectPlayer();
  if (player) ok('Player audio', player);
  else bad('Player audio', 'nu am găsit mpv/ffplay/paplay; pe Windows ar trebui să meargă PowerShell');

  const voice = new Voice({ ...config, voice: { ...config.voice, save: false } }, log);
  const ttsOk = await voice.init();
  if (ttsOk) {
    try {
      await voice.playOne('Salut! Sunt Gicu și vocea mea funcționează.');
      ok('Voce TTS', `${config.voice.voice} — ai auzit proba? Dacă nu, vezi TTS_PLAYER_CMD în README.`);
    } catch (err) {
      bad('Voce TTS', err.message);
    }
  } else {
    bad('Voce TTS', 'nu pot contacta serviciul de voce (internet?)');
  }
  voice.stop();
}

// 6. Server Minecraft (doar conexiune TCP)
await new Promise((resolve) => {
  const socket = new net.Socket();
  const done = (success, detail) => {
    socket.destroy();
    success ? ok('Server Minecraft', detail) : bad('Server Minecraft', detail);
    resolve();
  };
  socket.setTimeout(4000);
  socket.once('connect', () => done(true, `${config.minecraft.host}:${config.minecraft.port} răspunde`));
  socket.once('timeout', () => done(false, `${config.minecraft.host}:${config.minecraft.port} nu răspunde (serverul e pornit?)`));
  socket.once('error', (err) => done(false, `${config.minecraft.host}:${config.minecraft.port} — ${err.code || err.message}`));
  socket.connect(config.minecraft.port, config.minecraft.host);
});

// 7. Sumar
console.log('');
for (const r of results) {
  const icon = r.ok === true ? '✓' : r.ok === false ? '✗' : 'ℹ';
  const color = r.ok === true ? '\x1b[32m' : r.ok === false ? '\x1b[31m' : '\x1b[90m';
  console.log(`  ${color}${icon}\x1b[0m ${r.name.padEnd(18)} ${r.detail}`);
}

const problems = results.filter((r) => r.ok === false).length;
console.log('');
if (problems === 0) {
  console.log('✅  Totul pare în regulă. Pornește cu: npm start');
} else {
  console.log(`⚠️   ${problems} problemă/probleme. Rezolvă-le pe rând, apoi rulează din nou "npm run doctor".`);
  console.log('   Nu e obligatoriu să fie totul perfect: fără LLM merge cu reguli, fără voce merge doar în chat.');
}
console.log('');
