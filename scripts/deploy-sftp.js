#!/usr/bin/env node
/**
 * Urcă proiectul pe un server din panou (Pterodactyl / HidenCloud / orice SFTP)
 * care rulează un egg de Node.js.
 *
 *   node scripts/deploy-sftp.js --dry            # doar arată ce ar urca
 *   node scripts/deploy-sftp.js                  # urcă efectiv
 *   node scripts/deploy-sftp.js --with-env       # urcă și .env (atenție: conține chei)
 *
 * Setări în .env:
 *   SFTP_HOST=jacob.hidencloud.com
 *   SFTP_PORT=2022
 *   SFTP_USER=mariusuke-184939.d496911d
 *   SFTP_PASS=...
 *   REMOTE_DIR=.                (opțional; implicit rădăcina containerului)
 *
 * NU urca proiectul pe serverul de Minecraft (Paper) — acolo nu rulează Node.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDotEnv } from '../src/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadDotEnv(path.join(ROOT, '.env'));

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const withEnv = args.includes('--with-env');

const host = process.env.SFTP_HOST;
const port = Number(process.env.SFTP_PORT || 2022);
const username = process.env.SFTP_USER;
const password = process.env.SFTP_PASS;
const remoteDir = (process.env.REMOTE_DIR || '.').replace(/\/+$/, '') || '.';

const SKIP_DIRS = new Set(['node_modules', '.git', 'logs', 'data', 'audio-out', 'voice-out', 'auth-cache', '.github']);
const SKIP_FILES = new Set(['.env', '.DS_Store', 'Thumbs.db']);
const SKIP_EXT = ['.log', '.mp3', '.wav'];

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!host || !username) {
  fail(
    'Îmi lipsesc datele SFTP. În .env pune:\n' +
      '  SFTP_HOST=jacob.hidencloud.com\n' +
      '  SFTP_PORT=2022\n' +
      '  SFTP_USER=mariusuke-184939.d496911d\n' +
      '  SFTP_PASS=parola_ta\n' +
      '(sau rulează cu: SFTP_PASS=... node scripts/deploy-sftp.js)',
  );
}
if (!password && !dry) fail('Lipsește SFTP_PASS. Nu pot intra pe server fără parolă.');

function walk(dir, base = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...walk(path.join(dir, entry.name), rel));
      continue;
    }
    if (!entry.isFile()) continue;
    if (SKIP_FILES.has(entry.name) && !(withEnv && entry.name === '.env')) continue;
    if (SKIP_EXT.some((ext) => entry.name.endsWith(ext))) continue;
    if (entry.name.endsWith('.logs')) continue;
    out.push(rel);
  }
  return out;
}

const files = walk(ROOT);
const totalBytes = files.reduce((sum, rel) => sum + fs.statSync(path.join(ROOT, rel)).size, 0);

console.log(`\n📦 Deploy către ${username}@${host}:${port}  →  ${remoteDir}`);
console.log(`   ${files.length} fișiere, ${(totalBytes / 1024).toFixed(0)} KB`);
if (withEnv) console.log('   ⚠  include .env (chei API + parole)');
if (dry) {
  for (const rel of files) console.log(`   · ${rel}`);
  console.log('\n(mod --dry: nu am urcat nimic)\n');
  process.exit(0);
}

let Client;
try {
  ({ Client } = await import('ssh2'));
} catch {
  fail('Lipsește pachetul ssh2. Rulează:  npm install ssh2');
}

const conn = new Client();

conn
  .on('ready', () => {
    conn.sftp(async (err, sftp) => {
      if (err) fail(`SFTP indisponibil: ${err.message}`);

      const mkdirp = (dir) =>
        new Promise((resolve) => {
          if (!dir || dir === '.' || dir === '/') return resolve();
          sftp.mkdir(dir, { mode: 0o755 }, () => resolve()); // ignorăm "există deja"
        });

      const put = (local, remote) =>
        new Promise((resolve, reject) =>
          sftp.fastPut(local, remote, { concurrency: 4 }, (e) => (e ? reject(e) : resolve())),
        );

      let done = 0;
      try {
        for (const rel of files) {
          const remotePath = [remoteDir, rel].filter((p) => p && p !== '.').join('/');
          const remoteParent = path.posix.dirname(remotePath);
          await mkdirp(remoteParent);
          await put(path.join(ROOT, rel), remotePath);
          done += 1;
          process.stdout.write(`\r   urcat ${done}/${files.length}  ${rel.slice(0, 45).padEnd(46)}`);
        }
        console.log(`\n\n✓ ${done} fișiere urcate.\n`);
        console.log('Următorii pași, în panoul de găzduire:');
        console.log('  1. Consolă →  npm install');
        console.log('  2. File Manager → .env  (pune MC_HOST, MC_PORT, MC_OWNER, LLM_API_KEY)');
        console.log('  3. Startup command:  npm start');
        console.log('  4. Restart server\n');
        console.log('Notă: pe găzduire vocea nu se aude — pune TTS_ENABLED=false în .env-ul de acolo.\n');
      } catch (e) {
        console.error(`\n✗ Upload eșuat la ${done}/${files.length}: ${e.message}\n`);
        process.exitCode = 1;
      } finally {
        conn.end();
      }
    });
  })
  .on('error', (e) => fail(`Conexiune eșuată: ${e.message}`))
  .on('close', () => process.exit(process.exitCode || 0))
  .connect({ host, port, username, password, readyTimeout: 20_000 });
