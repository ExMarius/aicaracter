#!/usr/bin/env node
/**
 * GICU — personaj AI pentru Minecraft 1.21.4
 *
 * Pornire normală:   npm start
 * Fără Minecraft:    npm run repl        (vorbești cu el în terminal)
 * Fără LLM:          node src/index.js --offline
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import { buildConfig, loadDotEnv, loadPersona, ROOT } from './config.js';
import { createLogger } from './util/logger.js';
import { splitChat, cleanForChat } from './util/text.js';
import { Memory } from './ai/memory.js';
import { LLM } from './ai/llm.js';
import { Brain } from './ai/brain.js';
import { Skills } from './minecraft/skills.js';
import { createActions } from './minecraft/actions.js';
import { createBot, setupMovements, loginIfNeeded, sleep } from './minecraft/bot.js';
import { wireEvents, reportStartup } from './minecraft/events.js';
import { Voice } from './voice/tts.js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);

if (flag('help') || flag('h')) {
  printHelp();
  process.exit(0);
}

const LOG_DIR = path.join(ROOT, 'logs');
const DATA_DIR = path.join(ROOT, 'data');

loadDotEnv();
const config = buildConfig({
  offline: flag('offline'),
  behavior: {},
});
if (config.offline) config.ai.disabled = true;

const log = createLogger({ level: config.logLevel, logDir: LOG_DIR });
const persona = loadPersona(config.personaFile, log);
const memory = new Memory(path.join(DATA_DIR, 'memorie.json'), log);
const llm = new LLM(config.ai, log);
const voice = new Voice(config, log);

banner();

if (flag('repl')) {
  await runRepl();
} else {
  await runMinecraft();
}

// ─────────────────────────────────────────────────────────────
// Modul Minecraft
// ─────────────────────────────────────────────────────────────
async function runMinecraft() {
  await voice.init();

  let bot = null;
  let cleanupEvents = null;
  let shuttingDown = false;

  const skills = new Skills(null, log);
  const hooks = {
    getOwner: () => config.minecraft.owners[0] || 'ExMarius',
    async say(text) {
      const chunks = splitChat(cleanForChat(text), 240);
      for (let i = 0; i < chunks.length; i++) {
        if (!bot?.player) return;
        try {
          bot.chat(chunks[i]);
        } catch (err) {
          log.warn(`Nu pot scrie în chat: ${err.message}`);
          return;
        }
        log.gicu(chunks[i]);
        log.transcript('CHAT', chunks[i]);
        if (i < chunks.length - 1) await sleep(900);
      }
    },
    async speak(text) {
      voice.speak(text);
    },
    state: () => skills.stateText(),
    stopAll() {
      skills.stop?.();
      voice.stop();
    },
    setVoice(on) {
      voice.setEnabled(on);
    },
  };

  const actions = createActions({ skills, hooks, memory, log, config });
  const brain = new Brain({ config, persona, llm, memory, actions, hooks, log });

  if (!llm.configured) {
    log.warn('Nu am cheie API pentru LLM — pornesc cu creierul de rezervă (reguli).');
    log.warn('Pentru inteligență completă: pune LLM_API_KEY în .env (vezi .env.example).');
  }

  connect();

  function connect() {
    if (shuttingDown) return;
    bot = createBot(config, log);
    skills.bot = bot;

    cleanupEvents?.();
    cleanupEvents = wireEvents({ bot, brain, config, log, voice });

    bot.once('spawn', async () => {
      setupMovements(bot, log);
      await loginIfNeeded(bot, config, log);
      await sleep(1200);
      reportStartup({ bot, config, log, llm, voice });
      log.ok('Sunt în joc. Scrie-mi în chat ce vrei să fac.');
    });

    bot.once('end', (reason) => {
      if (shuttingDown) return;
      log.warn(`Conexiunea s-a închis (${reason}).`);
      cleanupEvents?.();
      cleanupEvents = null;
      if (!config.minecraft.reconnect) return;
      log.info('Reîncerc în 6 secunde...');
      setTimeout(() => {
        if (!shuttingDown) connect();
      }, 6000);
    });

  }

  // Poți vorbi cu el și din terminal, nu doar din joc (o singură dată,
  // ca să nu se dubleze input-ul după reconectări)
  if (process.stdin.isTTY) {
    attachConsoleChat(brain, hooks, () => bot);
  }

  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info('Închid... noapte bună!');
    cleanupEvents?.();
    voice.stop();
    try {
      brain.interrupt('shutdown');
      bot?.quit?.('La revedere');
    } catch {
      /* ignorat */
    }
    await sleep(500);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// ─────────────────────────────────────────────────────────────
// Modul REPL (fără Minecraft, pentru teste rapide de personalitate)
// ─────────────────────────────────────────────────────────────
async function runRepl() {
  log.info('Mod REPL: vorbești cu personajul în terminal. Fără Minecraft, fără acțiuni reale.');
  if (!llm.configured) log.warn('Fără LLM: folosesc regulile de rezervă.');

  const stubSkills = new Proxy(
    {
      stateText: () => 'Sunt în terminal, nu în Minecraft. Nu am poziție, nu am inventar, dar am chef de vorbă.',
      stop: () => {},
      wait: async () => {},
    },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        return async () => ({ ok: false, mesaj: 'Nu sunt conectat la Minecraft (mod REPL).' });
      },
    },
  );

  const hooks = {
    getOwner: () => config.minecraft.owners[0] || 'ExMarius',
    async say(text) {
      log.gicu(text);
      log.transcript('REPL', text);
    },
    async speak(text) {
      voice.speak(text);
    },
    state: () => stubSkills.stateText(),
    stopAll: () => voice.stop(),
    setVoice: (on) => voice.setEnabled(on),
  };

  const actions = createActions({ skills: stubSkills, hooks, memory, log, config });
  const brain = new Brain({ config, persona, llm, memory, actions, hooks, log });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'tu > ' });
  console.log('Scrie un mesaj și Enter. "exit" ca să ieși.\n');
  rl.prompt();

  for await (const line of rl) {
    const text = line.trim();
    if (!text) {
      rl.prompt();
      continue;
    }
    if (['exit', 'quit', 'iesi', 'ieși'].includes(text.toLowerCase())) break;
    await brain.handleMessage(config.minecraft.owners[0] || 'ExMarius', text, { source: 'repl' });
    rl.prompt();
  }
  voice.stop();
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────
function attachConsoleChat(brain, hooks, getBot) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on('line', async (line) => {
    const text = line.trim();
    if (!text) return;
    const owner = config.minecraft.owners[0] || 'ExMarius';
    if (text.startsWith('/')) {
      // comenzile locale se execută direct, ca în joc
      await brain.handleMessage(owner, `!${text.slice(1)}`, { source: 'consolă' });
      return;
    }
    log.player(`(consolă) ${text}`);
    await brain.handleMessage(owner, text, { source: 'consolă' });
  });
  rl.on('close', () => {
    if (!getBot()?.player) process.exit(0);
  });
}

function banner() {
  const line = '─'.repeat(52);
  log.banner(`
${line}
   ██████╗ ██╗ ██████╗██╗   ██╗
  ██╔════╝ ██║██╔════╝██║   ██║
  ██║  ███╗██║██║     ██║   ██║
  ██║   ██║██║██║     ██║   ██║
  ╚██████╔╝██║╚██████╗╚██████╔╝
   ╚═════╝ ╚═╝ ╚═════╝ ╚═════╝
  Personaj AI pentru Minecraft 1.21.4
${line}`);
}

function printHelp() {
  console.log(`
GICU — personaj AI pentru Minecraft 1.21.4

Utilizare:
  npm start                 pornește botul și se conectează la server
  npm run repl              vorbești cu el în terminal (fără Minecraft)
  node src/index.js --offline    fără LLM (reguli simple)
  node src/index.js --help       acest mesaj

Configurare: copiază .env.example în .env și completează.

În joc (doar proprietarul):
  orice mesaj în chat           → îi dai o comandă
  !stop  !status  !voce on/off  → comenzi rapide
  !retine <fapt>  !recap  !idee  !reset  !ajutor
`);
}
