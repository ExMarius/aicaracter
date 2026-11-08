/**
 * Legătura dintre lumea Minecraft și creier: chat, morți, răni, creeperi,
 * diamante, lăsarea nopții, plictiseală. De aici vin replicile spontane
 * care fac un video să nu aibă momente moarte.
 */

const CREEPER_RADIUS = 7;

export function wireEvents({ bot, brain, config, log, voice }) {
  const timers = [];
  const last = { creeper: 0, ranit: 0, noapte: 0, plictiseala: 0, diamant: 0, moarte: 0 };
  const now = () => Date.now();
  const cooldownOk = (key, ms) => {
    if (now() - (last[key] || 0) < ms) return false;
    last[key] = now();
    return true;
  };

  const ownerNames = config.minecraft.owners;

  // ── Chat ────────────────────────────────────────────────────
  bot.on('chat', (username, message) => {
    if (!username || username === bot.username) return;
    brain.handleMessage(username, message, { source: 'chat' }).catch((err) => log.warn(`chat: ${err.message}`));
  });

  bot.on('whisper', (username, message) => {
    if (!username || username === bot.username) return;
    brain.handleMessage(username, message, { source: 'whisper' }).catch((err) => log.warn(`whisper: ${err.message}`));
  });

  // ── Intrări / ieșiri ────────────────────────────────────────
  bot.on('playerJoined', (player) => {
    if (!config.behavior.reactions) return;
    if (ownerNames.includes(String(player.username || '').toLowerCase())) {
      setTimeout(() => brain.quip('salut').catch(() => {}), 2500);
    }
  });

  // ── Viață și moarte ─────────────────────────────────────────
  bot.on('death', () => {
    brain.memory.addEvent('A murit');
    if (!config.behavior.reactions || !cooldownOk('moarte', 15_000)) return;
    brain.quip('moarte').catch(() => {});
  });

  bot.on('entityHurt', (entity) => {
    if (entity !== bot.entity) return;
    if (!config.behavior.reactions || !cooldownOk('ranit', 20_000)) return;
    if ((bot.health ?? 20) > 10) return;
    brain.quip('ranit', `viață ${Math.round(bot.health)}/20`).catch(() => {});
  });

  bot.on('kicked', (reason) => {
    log.warn(`Am fost dat afară de pe server: ${safe(reason)}`);
  });

  bot.on('error', (err) => log.error(`Eroare de conexiune: ${err.message}`));

  // ── Observator: verifică periodic ce se întâmplă în jur ────
  const watch = setInterval(() => {
    if (!bot.entity) return;
    try {
      checkDanger();
      checkNight();
      checkDiamond();
    } catch (err) {
      log.debug(`watcher: ${err.message}`);
    }
  }, 2000);
  timers.push(watch);

  function checkDanger() {
    if (!config.behavior.reactions) return;
    const me = bot.entity.position;
    const creeper = Object.values(bot.entities).find(
      (e) => e && e.name === 'creeper' && e.position && e.position.distanceTo(me) < CREEPER_RADIUS,
    );
    if (creeper && cooldownOk('creeper', 25_000)) {
      brain.quip('creeper').catch(() => {});
    }
  }

  let wasNight = false;
  function checkNight() {
    if (!config.behavior.reactions) return;
    const t = bot.time?.timeOfDay ?? 0;
    const isNight = t > 13000 && t < 23000;
    if (isNight && !wasNight && cooldownOk('noapte', 5 * 60_000)) {
      brain.quip('noapte').catch(() => {});
    }
    wasNight = isNight;
  }

  let knownDiamond = 0;
  function checkDiamond() {
    if (!config.behavior.reactions) return;
    const count = bot.inventory
      .items()
      .filter((i) => i.name === 'diamond' || i.name === 'diamond_ore' || i.name === 'deepslate_diamond_ore')
      .reduce((s, i) => s + i.count, 0);
    if (count > knownDiamond && cooldownOk('diamant', 10_000)) {
      brain.quip('diamant', `am ${count} diamante`).catch(() => {});
    }
    knownDiamond = count;
  }

  // ── Plictiseală: o vorbă la fiecare N secunde, dacă nu se întâmplă nimic ──
  if (config.behavior.idleChatSeconds > 0) {
    const idle = setInterval(() => {
      if (brain.busy) return;
      if (Date.now() - lastQuiet() < config.behavior.idleChatSeconds * 1000) return;
      if (!cooldownOk('plictiseala', config.behavior.idleChatSeconds * 1000)) return;
      brain.quip('plictiseala').catch(() => {});
    }, 15_000);
    timers.push(idle);
  }

  let lastActivity = Date.now();
  const markActivity = () => {
    lastActivity = Date.now();
  };
  const lastQuiet = () => lastActivity;
  bot.on('chat', markActivity);
  bot.on('entityHurt', markActivity);
  bot.on('playerJoined', markActivity);
  bot.on('blockUpdate', () => {});
  bot.on('move', () => {});

  return function cleanup() {
    for (const t of timers) clearInterval(t);
    voice?.stop?.();
  };
}

function safe(value) {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Câteva verificări la pornire, ca utilizatorul să știe imediat dacă ceva
 * nu e în regulă (fără să aștepte primul creeper).
 */
export function reportStartup({ bot, config, log, llm, voice }) {
  const msgs = [];
  msgs.push(`Conectat ca ${bot.username} pe ${config.minecraft.host}:${config.minecraft.port}`);
  msgs.push(
    llm?.configured
      ? `Creier: ${config.ai.model} (${config.ai.baseUrl})`
      : 'Creier: OFFLINE (reguli simple). Pune LLM_API_KEY în .env pentru inteligența completă.',
  );
  msgs.push(voice?.ready ? `Voce: ${config.voice.voice}` : 'Voce: oprită');
  for (const m of msgs) log.info(m);
}

export function isOwner(username, config) {
  return config.minecraft.owners.includes(String(username || '').toLowerCase());
}
