#!/usr/bin/env node
/**
 * Urcă fișiere pe serverul din panou (Pterodactyl) și, opțional,
 * îl repornește prin API-ul Client.
 *
 *   node scripts/deploy-panel.js \
 *     --file dist/Gicu-0.1.0.jar:plugins/Gicu-0.1.0.jar \
 *     --file dist/simple-voice-chat.jar:plugins/simple-voice-chat.jar
 *
 *   --no-restart     doar urcă, fără restart
 *   --dry            arată ce ar face
 *
 * Variabile de mediu (local: în .env; pe GitHub: din Secrets):
 *   SFTP_HOST, SFTP_PORT, SFTP_USER, SFTP_PASS
 *   PANEL_URL      ex: https://freepanel.hidencloud.com
 *   SERVER_ID      ex: d496911d
 *   PANEL_API_KEY  cheia din panou → Account → API Credentials
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadDotEnv } from '../src/config.js';

loadDotEnv();

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const noRestart = args.includes('--no-restart');

const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--file' && args[i + 1]) {
    const [local, remote] = args[i + 1].split(':');
    if (!local || !remote) fail(`Format greșit la --file: ${args[i + 1]} (trebuie local:remote)`);
    files.push({ local, remote });
    i++;
  }
}

const env = process.env;
const cfg = {
  host: env.SFTP_HOST,
  port: Number(env.SFTP_PORT || 2022),
  user: env.SFTP_USER,
  pass: env.SFTP_PASS,
  panelUrl: (env.PANEL_URL || '').replace(/\/+$/, ''),
  serverId: env.SERVER_ID,
  apiKey: env.PANEL_API_KEY,
};

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}
const log = (...a) => console.log('·', ...a);
const ok = (...a) => console.log('✓', ...a);

if (files.length === 0) fail('Niciun fișier de urcat. Folosește --file local:remote');
for (const f of files) {
  if (!fs.existsSync(f.local)) fail(`Fișierul local nu există: ${f.local}`);
}
if (!dry && (!cfg.host || !cfg.user)) {
  fail('Lipsesc datele SFTP (SFTP_HOST, SFTP_USER, SFTP_PASS). Vezi docs/AUTO-DEPLOY.md');
}

console.log('\n📤 Deploy pe server\n');
for (const f of files) log(`${f.local}  →  ${f.remote}  (${(fs.statSync(f.local).size / 1024).toFixed(0)} KB)`);
if (dry) {
  console.log('\n(mod --dry: nu s-a urcat nimic)\n');
  process.exit(0);
}

// ── 1. Upload SFTP ──────────────────────────────────────────
let Client;
try {
  ({ Client } = await import('ssh2'));
} catch {
  fail('Lipsește pachetul ssh2. Rulează: npm install ssh2');
}

await new Promise((resolve, reject) => {
  const conn = new Client();
  conn
    .on('ready', () => {
      conn.sftp(async (err, sftp) => {
        if (err) return reject(new Error(`SFTP indisponibil: ${err.message}`));
        const mkdirp = (dir) =>
          new Promise((res) => {
            if (!dir || dir === '.' || dir === '/') return res();
            sftp.mkdir(dir, { mode: 0o755 }, () => res());
          });
        try {
          for (const f of files) {
            const remoteDir = path.posix.dirname(f.remote);
            await mkdirp(remoteDir);
            await new Promise((res, rej) =>
              sftp.fastPut(f.local, f.remote, { concurrency: 4 }, (e) => (e ? rej(e) : res())),
            );
            ok(`urcat: ${f.remote}`);
          }
          conn.end();
          resolve();
        } catch (e) {
          conn.end();
          reject(e);
        }
      });
    })
    .on('error', (e) => reject(new Error(`Conexiune SFTP eșuată: ${e.message}`)))
    .connect({
      host: cfg.host,
      port: cfg.port,
      username: cfg.user,
      password: cfg.pass,
      readyTimeout: 20_000,
    });
});

// ── 2. Restart prin API-ul panoului ─────────────────────────
if (noRestart) {
  ok('Upload gata. Restart sărit (--no-restart).');
  process.exit(0);
}
if (!cfg.panelUrl || !cfg.serverId || !cfg.apiKey) {
  console.log('\n⚠  Fără PANEL_URL / SERVER_ID / PANEL_API_KEY — nu pot da restart automat.');
  console.log('   Fă restart din panou, sau adaugă cheia: vezi docs/AUTO-DEPLOY.md\n');
  process.exit(0);
}

const api = (p) => `${cfg.panelUrl}/api/client/servers/${cfg.serverId}${p}`;
const headers = {
  Authorization: `Bearer ${cfg.apiKey}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'aicaracter-deploy/1.0',
};

async function power(signal) {
  const res = await fetch(api('/power'), {
    method: 'POST',
    headers,
    body: JSON.stringify({ signal }),
  });
  if (res.status === 401) fail('Cheia API e respinsă (401). Verifică PANEL_API_KEY și SERVER_ID.');
  if (res.status === 404) fail('Serverul nu există sau cheia nu are acces (404). Verifică SERVER_ID.');
  if (res.status === 429) fail('Prea multe cereri către panel (429). Așteaptă un minut.');
  if (!res.ok) fail(`Panelul a răspuns ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.status;
}

async function status() {
  const res = await fetch(api('/resources'), { headers });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.attributes?.current_state || null;
}

try {
  const before = await status();
  log(`starea serverului: ${before || 'necunoscută'}`);
  log('trimit semnalul de restart...');
  await power('restart');

  const deadline = Date.now() + 120_000;
  let state = before;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));
    state = (await status()) || state;
    process.stdout.write(`\r   stare: ${state}...   `);
    if (state === 'running') break;
  }
  console.log('');
  if (state === 'running') ok('Server repornit și online.');
  else console.log(`⚠  Serverul e în starea "${state}" — verifică în panou.`);
} catch (err) {
  fail(`Restart eșuat: ${err.message}`);
}
