#!/usr/bin/env node
/**
 * TEST LIVE al serverului tău de Minecraft.
 *   npm run test-server
 *   npm run test-server -- --ping-only
 *
 * 1. Întreabă serverul ce versiune are, câți jucători sunt, ce MOTD are.
 * 2. Încearcă o conectare reală cu botul (fără să facă nimic în joc).
 * 3. Dacă e dat afară, îți spune exact ce trebuie schimbat în .env.
 */
import mc from 'minecraft-protocol';
import mineflayer from 'mineflayer';
import { buildConfig, loadDotEnv } from '../src/config.js';
import { createLogger } from '../src/util/logger.js';
import { diagnoseKickReason, motdToText } from '../src/util/diagnose.js';

loadDotEnv();
const config = buildConfig();
const log = createLogger({ level: 'info', logDir: null });

const args = process.argv.slice(2);
const pingOnly = args.includes('--ping-only');
const { host, port, version, username, auth } = config.minecraft;

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[90m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};
const ok = (m) => console.log(`  ${C.green}✓${C.reset} ${m}`);
const no = (m) => console.log(`  ${C.red}✗${C.reset} ${m}`);
const note = (m) => console.log(`  ${C.dim}${m}${C.reset}`);

console.log(`\n${C.cyan}${C.bold}🔌 Test live: ${host}:${port}${C.reset}\n`);

// ── 1. Status ping (nu intră în joc, doar întreabă) ──────────
let pingOk = false;
try {
  const info = await new Promise((resolve, reject) => {
    mc.ping({ host, port, version: version || undefined, closeTimeout: 8000 }, (err, res) =>
      err ? reject(err) : resolve(res),
    );
  });
  pingOk = true;
  ok('Serverul răspunde la ping.');
  const ver = info?.version?.name || '?';
  const protocol = info?.version?.protocol || '?';
  console.log(`  ${C.dim}versiune:${C.reset} ${C.bold}${ver}${C.reset} ${C.dim}(protocol ${protocol})${C.reset}`);
  if (version && ver && !String(ver).includes(String(version))) {
    console.log(`  ${C.yellow}!${C.reset} în .env ai ${version}, serverul e ${ver} → pune MC_VERSION=auto`);
  }
  const players = info?.players;
  if (players) ok(`Jucători: ${players.online ?? '?'} / ${players.max ?? '?'}`);
  const motd = motdToText(info?.description).trim();
  if (motd) note(`MOTD: ${motd.slice(0, 120)}`);
  if (info?.enforcesSecureChat) note('serverul are secure chat (chat semnat) — nu afectează botul');
} catch (err) {
  if (/ENOTFOUND/i.test(err.message)) no(`Nu găsesc hostul "${host}". Verifică adresa din panou.`);
  else if (/ECONNREFUSED/i.test(err.message)) no(`Portul ${port} e închis. Serverul e pornit? Portul e cel din panou?`);
  else if (/ETIMEDOUT|timeout/i.test(err.message)) no(`Serverul nu răspunde (timeout). Firewall sau server oprit.`);
  else no(`Ping eșuat: ${err.message}`);
  console.log(`\n${C.yellow}Mă opresc aici: fără ping nu are sens să încerc conectarea.${C.reset}`);
  console.log(`${C.dim}Verifică în panou: Server pornit? Adresa exactă (host + port)?${C.reset}\n`);
  process.exit(pingOk ? 0 : 1);
}

if (pingOnly) {
  console.log(`\n${C.green}Gata (mod ping-only).${C.reset}\n`);
  process.exit(0);
}

// ── 2. Conectare reală, ca jucător ───────────────────────────
console.log(`\n${C.cyan}${C.bold}🎮 Încerc conectarea ca jucător "${username}" (${auth})...${C.reset}\n`);

const started = Date.now();
let settled = false;
const finish = (success, message, extraAdvice = []) => {
  if (settled) return;
  settled = true;
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log('');
  if (success) {
    ok(`CONECTAT în ${secs}s. Botul poate intra pe server.`);
    if (message) note(message);
    console.log(`\n${C.green}${C.bold}Gata! Poți rula "npm start" (sau start.bat).${C.reset}\n`);
  } else {
    no(`Nu a intrat. ${message}`);
    if (extraAdvice.length) {
      console.log(`\n${C.yellow}Ce faci:${C.reset}`);
      for (const line of extraAdvice) console.log(`  ${C.yellow}→${C.reset} ${line}`);
    }
    console.log('');
  }
  try {
    bot?.quit?.('test terminat');
  } catch {
    /* ignorat */
  }
  setTimeout(() => process.exit(success ? 0 : 1), 300);
};

let bot;
try {
  bot = mineflayer.createBot({
    host,
    port,
    username,
    auth,
    ...(version ? { version } : {}),
    hideErrors: true,
    checkTimeoutInterval: 30_000,
  });
} catch (err) {
  finish(false, `Nu pot porni clientul: ${err.message}`);
}

const timer = setTimeout(() => finish(false, 'Timeout: nu am ajuns în joc în 30s.', [
  'Serverul poate fi în spatele unui proxy sau a unui firewall.',
  'Verifică dacă intri normal cu clientul de Minecraft pe aceeași adresă.',
]), 30_000);

bot.once('spawn', () => {
  const pos = bot.entity?.position;
  finish(
    true,
    pos ? `Poziție: ${Math.round(pos.x)} ${Math.round(pos.y)} ${Math.round(pos.z)} | viață ${Math.round(bot.health)}/20 | ${bot.game?.dimension || 'overworld'}` : '',
  );
});

bot.once('kicked', (reason) => {
  clearTimeout(timer);
  const text = motdToText(reason) || 'fără motiv';
  const advice = diagnoseKickReason(reason, { username }).map((l) => l.replace('{parola}', '<parola>'));
  finish(false, `Serverul m-a dat afară: "${text}"`, advice);
});

bot.once('error', (err) => {
  clearTimeout(timer);
  const advice = /Invalid credentials|Failed to obtain|microsoft/i.test(err.message)
    ? ['Autentificarea Microsoft a eșuat. Rulează din nou și urmează linkul + codul afișat.']
    : diagnoseKickReason(err.message, { username });
  finish(false, err.message, advice);
});

bot.once('end', (reason) => {
  clearTimeout(timer);
  if (!settled) finish(false, `Conexiunea s-a închis: ${reason || 'fără motiv'}`, diagnoseKickReason(reason, { username }));
});
