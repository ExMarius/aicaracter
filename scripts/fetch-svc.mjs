#!/usr/bin/env node
/**
 * Descarcă ultima versiune de Simple Voice Chat (plugin Bukkit/Paper)
 * compatibilă cu versiunea de Minecraft țintă, de pe Modrinth.
 *
 *   node scripts/fetch-svc.mjs            → dist/simple-voice-chat.jar
 *   node scripts/fetch-svc.mjs out/       → out/simple-voice-chat.jar
 *   MC_VERSION_TARGET=1.21.4 node ...     (implicit 1.21.4)
 *
 * Ordinea încercărilor:
 *   1. build exact pentru versiunea de MC cerută
 *   2. ultimul build de plugin, oricare ar fi versiunea de MC (cu avertisment)
 * Rulează pe GitHub Actions (are internet complet).
 */
import fs from 'node:fs';
import path from 'node:path';

const PROJECT = 'simple-voice-chat';
const MC_VERSION = process.env.MC_VERSION_TARGET || '1.21.4';
const UA = 'aicaracter-deploy/1.0 (+https://github.com/ExMarius/aicaracter)';
const outDir = process.argv[2] || 'dist';
const outFile = path.join(outDir, 'simple-voice-chat.jar');
const LOADERS = ['bukkit', 'paper', 'spigot'];

fs.mkdirSync(outDir, { recursive: true });

const log = (...a) => console.log('·', ...a);

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} de la ${url}`);
  return res.json();
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`Descărcare eșuată (HTTP ${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  // un jar trebuie să înceapă cu 'PK'
  if (buf.length < 10_000 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    throw new Error(`Fișierul descărcat nu pare un jar (${buf.length} B)`);
  }
  fs.writeFileSync(dest, buf);
  return buf.length;
}

async function versionsFor(gameVersion) {
  const params = new URLSearchParams({
    loaders: JSON.stringify(LOADERS),
  });
  if (gameVersion) params.set('game_versions', JSON.stringify([gameVersion]));
  return getJson(`https://api.modrinth.com/v2/project/${PROJECT}/version?${params.toString()}`);
}

async function pickAndDownload(versions, { exact }) {
  if (!Array.isArray(versions) || versions.length === 0) throw new Error('nicio versiune găsită');
  versions.sort((a, b) => new Date(b.date_published) - new Date(a.date_published));
  const v = versions[0];
  const jar =
    (v.files || []).find((f) => f.primary && f.filename.endsWith('.jar')) ||
    (v.files || []).find((f) => f.filename.endsWith('.jar'));
  if (!jar) throw new Error('versiunea găsită nu are fișier .jar');
  const size = await download(jar.url, outFile);
  log(`Modrinth: ${v.version_number} — compatibil cu MC ${(v.game_versions || []).join(', ') || '?'}`);
  if (!exact) {
    console.log(`⚠  Nu exista build marcat pentru MC ${MC_VERSION}; am luat ultimul disponibil.`);
    console.log('   Dacă pluginul refuză să pornească, verifică manual pe modrinth.com/plugin/simple-voice-chat');
  }
  return { version: v.version_number, size, file: jar.filename };
}

try {
  let info;
  try {
    info = await pickAndDownload(await versionsFor(MC_VERSION), { exact: true });
  } catch (err) {
    log(`fără build pentru MC ${MC_VERSION} (${err.message}); încerc ultimul build de plugin`);
    info = await pickAndDownload(await versionsFor(null), { exact: false });
  }
  const kb = (info.size / 1024).toFixed(0);
  console.log(`✓ Simple Voice Chat ${info.version} → ${outFile} (${kb} KB)`);
  fs.writeFileSync(path.join(outDir, 'svc-version.txt'), `${info.version}\n`);
} catch (err) {
  console.error(`✗ Nu am putut descărca Simple Voice Chat: ${err.message}`);
  console.error('  Verifică: ai internet? proiectul există pe Modrinth?');
  process.exit(1);
}
