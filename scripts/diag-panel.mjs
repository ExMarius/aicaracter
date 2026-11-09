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

const results = [];
for (const [path, label] of endpoints) {
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
console.log(`\ncheie primită: ${shape(key)}`);
console.log(any200 ? '\nREZULTAT: o variantă a funcționat (vezi 200 mai sus)' : '\nREZULTAT: nicio variantă nu a funcționat');

// adnotare compactă, ca să poată fi citită din API
const compact = results.map((r) => r.slice(0, 110)).join(' || ').slice(0, 2500);
console.log(`::warning title=Diagnostic cheie API::${compact.replace(/%/g, '%25')}`);
process.exit(any200 ? 0 : 1);
