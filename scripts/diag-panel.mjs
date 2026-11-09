#!/usr/bin/env node
/**
 * Diagnostic pentru cheia API a panoului.
 * Încearcă mai multe forme de autentificare și spune care primește răspuns 200.
 *
 *   PANEL_URL=... SERVER_ID=... PANEL_API_KEY=... node scripts/diag-panel.mjs
 *
 * Nu urcă nimic, nu repornește nimic — doar întreabă panoul „cine sunt?".
 */
const panelUrl = (process.env.PANEL_URL || '').replace(/\/+$/, '');
const serverId = process.env.SERVER_ID || '';
const key = process.env.PANEL_API_KEY || '';

if (!panelUrl || !key) {
  console.error('Lipsesc PANEL_URL / PANEL_API_KEY');
  process.exit(1);
}

import { createHash } from 'node:crypto';

/** Amprentă scurtă a cheii primite: îmi spune dacă secretul s-a schimbat între rulări. */
const fingerprint = (k) => {
  const h = createHash('sha256').update(k).digest('hex').slice(0, 12);
  const head = k.slice(0, 4).replace(/[^a-zA-Z0-9_]/g, '?');
  return `amprenta=${h} lungime=${k.length} incepe_cu="${head}..."`;
};

/** Ce panou e la adresa asta? */
async function identifyPanel() {
  try {
    const res = await fetch(panelUrl, { headers: { 'User-Agent': 'aicaracter-diag/1.0' }, signal: AbortSignal.timeout(20_000) });
    const html = (await res.text()).slice(0, 4000);
    const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [, '?'])[1].trim();
    const marks = ['pterodactyl', 'Pterodactyl', 'login', 'cloudflare'].filter((m) => html.includes(m));
    return `panou=${panelUrl} HTTP=${res.status} titlu="${title.slice(0, 60)}" indicii=[${marks.join(',')}]`;
  } catch (err) {
    return `panou=${panelUrl} nu pot citi pagina: ${err.message}`;
  }
}

const shape = (k) => {
  if (!k) return '(gol)';
  const prefix = k.includes(':') ? k.slice(0, k.indexOf(':') + 1) : '(fără prefix)';
  return `${prefix} + ${k.length} caractere`;
};

const variants = [
  ['Bearer <cheie>', () => ({ Authorization: `Bearer ${key}` })],
  ['<cheie> direct (fără Bearer)', () => ({ Authorization: key })],
  ['Bearer <cheie fără prefix>', () => ({ Authorization: `Bearer ${key.replace(/^SHA256:/i, '')}` })],
  ['X-Api-Key: <cheie>', () => ({ 'X-Api-Key': key })],
];

const endpoints = [
  ['/api/application/servers', 'API aplicație (admin)'],
  ['/api/client', 'rădăcina API client'],
  [`/api/client/servers/${serverId}`, 'serverul tău'],
];

const looksLikeHash = /^SHA256:/i.test(key);
const results = looksLikeHash
  ? ['ATENȚIE: secretul începe cu „SHA256:" — este amprenta cheii, nu cheia. Nu are rost să încerc auth.']
  : [];
for (const [path, label] of (looksLikeHash ? [] : endpoints)) {
  for (const [vname, mk] of variants) {
    let line;
    try {
      const res = await fetch(panelUrl + path, {
        headers: { Accept: 'application/json', 'User-Agent': 'aicaracter-diag/1.0', ...mk() },
        signal: AbortSignal.timeout(20_000),
      });
      const text = (await res.text()).replace(/\s+/g, ' ').slice(0, 140);
      line = `${res.status} — ${label} • ${vname} → ${text}`;
    } catch (err) {
      line = `EROARE REȚEA — ${label} • ${vname} → ${err.message}`;
    }
    results.push(line);
    console.log(line);
  }
}

const any200 = results.some((r) => r.startsWith('200'));
const idPanel = await identifyPanel();
console.log(idPanel);
const fp = fingerprint(key);
console.log(fp);
console.log(`\ncheie primită: ${shape(key)}`);
console.log(any200 ? '\nREZULTAT: o variantă a funcționat (vezi 200 mai sus)' : '\nREZULTAT: nicio variantă nu a funcționat');

// adnotare compactă, ca să poată fi citită din API
const compact = [...results.map((r) => r.slice(0, 90)), idPanel, fp].join(' || ').slice(0, 2500);
console.log(`::warning title=Diagnostic cheie API::${compact.replace(/%/g, '%25')}`);
process.exit(any200 ? 0 : 1);
