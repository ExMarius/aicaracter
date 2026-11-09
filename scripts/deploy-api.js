#!/usr/bin/env node
/**
 * Deploy pe server prin API-ul Client al panoului Pterodactyl.
 * NU are nevoie de SFTP — doar de cheia API.
 *
 *   node scripts/deploy-api.js \
 *     --file dist/Gicu.jar:plugins/Gicu.jar \
 *     --file dist/simple-voice-chat.jar:plugins/simple-voice-chat.jar \
 *     --restart --verify
 *
 * Opțiuni:
 *   --file local:remote   (repetabil) fișier de urcat
 *   --restart             repornește serverul după upload
 *   --no-restart          doar urcă
 *   --verify              după restart, citește logs/latest.log și raportează
 *   --dry                 arată ce ar face
 *   --command "say hi"    trimite o comandă în consola serverului (fără upload)
 *
 * Mediu: PANEL_URL, SERVER_ID, PANEL_API_KEY
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadDotEnv } from '../src/config.js';

loadDotEnv();

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const verify = args.includes('--verify');
const restart = args.includes('--restart') && !args.includes('--no-restart');

const files = [];
let command = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--file' && args[i + 1]) {
    const [local, remote] = args[i + 1].split(':');
    files.push({ local, remote });
    i++;
  } else if (args[i] === '--command' && args[i + 1]) {
    command = args[i + 1];
    i++;
  }
}

const cfg = {
  panelUrl: (process.env.PANEL_URL || '').replace(/\/+$/, ''),
  serverId: process.env.SERVER_ID || '',
  apiKey: process.env.PANEL_API_KEY || '',
};

const log = (...a) => console.log('·', ...a);
const ok = (...a) => console.log('✓', ...a);

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

if (!cfg.panelUrl || !cfg.serverId || !cfg.apiKey) {
  fail(
    'Lipsesc PANEL_URL / SERVER_ID / PANEL_API_KEY.\n' +
      '  Local: pune-le în .env\n' +
      '  GitHub: Settings → Secrets → PANEL_API_KEY (+ variabile PANEL_URL, SERVER_ID)',
  );
}

const base = `${cfg.panelUrl}/api/client`;
const authHeaders = {
  Authorization: `Bearer ${cfg.apiKey}`,
  Accept: 'application/json',
  'User-Agent': 'aicaracter-deploy/1.0',
};

async function api(method, endpoint, { json, raw, timeoutMs = 60_000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error('timeout')), timeoutMs);
  const headers = { ...authHeaders };
  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (raw !== undefined) {
    headers['Content-Type'] = 'application/octet-stream';
    body = raw;
  }
  try {
    const res = await fetch(`${base}/servers/${cfg.serverId}${endpoint}`, {
      method,
      headers,
      body,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (res.status === 401)
      fail(
        'Cheia API e respinsă (401).\n' +
          '  Cauza cea mai frecventă: ai copiat valoarea din lista de credențiale,\n' +
          '  care arată ca „SHA256:..." și e doar amprenta cheii, nu cheia.\n' +
          '  Cheia reală apare O SINGURĂ DATĂ, imediat după „Create Credential"\n' +
          '  (începe de obicei cu „ptlc_"). Șterge credențiala și creează alta, apoi copiază imediat.',
      );
    if (res.status === 403) fail('Cheia nu are voie la acest server (403). Verifică SERVER_ID.');
    if (res.status === 404) fail(`Endpoint inexistent (404): ${endpoint}. Verifică SERVER_ID.`);
    if (res.status === 429) fail('Prea multe cereri către panel (429). Așteaptă un minut.');
    if (!res.ok) {
      const msg = data?.errors?.[0]?.detail || text.slice(0, 200);
      throw new Error(`HTTP ${res.status}: ${msg}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

const state = async () => {
  const d = await api('GET', '/resources');
  return d?.attributes?.current_state || null;
};

// ── Comandă rapidă în consolă ───────────────────────────────
if (command) {
  log(`trimit în consolă: ${command}`);
  if (!dry) await api('POST', '/command', { json: { command } });
  ok('comandă trimisă');
  process.exit(0);
}

// ── Validare fișiere ────────────────────────────────────────
if (files.length === 0) fail('Niciun fișier. Folosește --file local:remote');
for (const f of files) {
  if (!fs.existsSync(f.local)) fail(`Lipsește fișierul local: ${f.local}`);
}

console.log(`\n🚀 Deploy prin API către serverul ${cfg.serverId}\n`);
for (const f of files) {
  const size = fs.statSync(f.local).size;
  log(`${f.local} → ${f.remote} (${(size / 1024).toFixed(0)} KB)`);
}

if (dry) {
  console.log('\n(mod --dry: nu s-a făcut nimic)\n');
  process.exit(0);
}

/** Upload „raw" — merge perfect pentru fișiere mici. */
async function uploadRaw(remote, buf) {
  await api('POST', `/files/write?file=${encodeURIComponent(remote)}`, { raw: buf, timeoutMs: 120_000 });
}

/** Upload multipart prin link semnat — metoda oficială pentru fișiere mari. */
async function uploadMultipart(remote, buf) {
  const dir = path.posix.dirname(remote);
  const name = path.posix.basename(remote);
  const info = await api('GET', `/files/upload?directory=${encodeURIComponent(dir)}`);
  const url = info?.attributes?.url;
  if (!url) throw new Error('panelul nu a returnat URL de upload');
  const form = new FormData();
  form.append('files', new Blob([buf]), name);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'User-Agent': 'aicaracter-deploy/1.0' },
    body: form,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 150)}`);
}

// ── Upload ──────────────────────────────────────────────────
for (const f of files) {
  const remote = f.remote.startsWith('/') ? f.remote : `/${f.remote}`;
  const buf = fs.readFileSync(f.local);
  const big = buf.length > 512 * 1024;
  try {
    if (big) {
      log(`${f.local} e mare (${(buf.length / 1024 / 1024).toFixed(1)} MB) — folosesc upload multipart`);
      await uploadMultipart(remote, buf);
    } else {
      await uploadRaw(remote, buf);
    }
    ok(`urcat: ${remote}`);
  } catch (err) {
    try {
      log(`încerc metoda alternativă pentru ${remote}...`);
      await (big ? uploadRaw(remote, buf) : uploadMultipart(remote, buf));
      ok(`urcat: ${remote}`);
    } catch (err2) {
      fail(`Upload eșuat pentru ${remote}:\n  ${err.message}\n  ${err2.message}`);
    }
  }
}

// ── Restart ─────────────────────────────────────────────────
if (!restart) {
  ok('Upload gata (fără restart).');
  process.exit(0);
}

try {
  const before = await state();
  log(`starea înainte: ${before}`);
  await api('POST', '/power', { json: { signal: 'restart' } });
  log('semnal de restart trimis, aștept să pornească...');

  const deadline = Date.now() + 150_000;
  let current = before;
  let wasDown = false;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    current = (await state()) || current;
    process.stdout.write(`\r   stare: ${current}...            `);
    if (current !== 'running') wasDown = true;
    if (wasDown && current === 'running') break;
    if (!wasDown && Date.now() > deadline - 120_000) break; // nu s-a oprit deloc
  }
  console.log('');
  ok(`server: ${current}`);
} catch (err) {
  fail(`Restart eșuat: ${err.message}`);
}

// ── Verificare în log ───────────────────────────────────────
if (verify) {
  try {
    log('aștept 25s ca serverul să scrie logul...');
    await new Promise((r) => setTimeout(r, 25_000));
    const dl = await api('GET', `/files/download?file=${encodeURIComponent('/logs/latest.log')}`);
    const url = dl?.attributes?.url;
    if (!url) throw new Error('nu am primit link de descărcare');
    const res = await fetch(url, { headers: { 'User-Agent': 'aicaracter-deploy/1.0' } });
    const text = await res.text();
    const lines = text.split('\n');
    console.log('\n──── ultimele 25 de linii din logs/latest.log ────');
    console.log(lines.slice(-25).join('\n'));
    console.log('──────────────────────────────────────────────────\n');

    const hasGicu = /\[Gicu\]/i.test(text);
    const hasVoice = /voicechat|voice chat/i.test(text);
    hasGicu ? ok('pluginul Gicu apare în log') : console.log('⚠  nu găsesc [Gicu] în log (poate nu s-a încărcat)');
    hasVoice ? ok('Simple Voice Chat apare în log') : console.log('⚠  nu găsesc voice chat în log');
  } catch (err) {
    console.log(`⚠  nu am putut citi logul: ${err.message}`);
  }
}
