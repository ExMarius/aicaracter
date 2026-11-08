/**
 * Conectarea la Minecraft 1.21.4 și pluginurile de mișcare.
 * Botul se prezintă ca un jucător normal: clientul vanilla îl vede ca pe oricine altcineva.
 */
import mineflayer from 'mineflayer';
import pf from 'mineflayer-pathfinder';
import collectBlockModule from 'mineflayer-collectblock';
import armorModule from 'mineflayer-armor-manager';

const { Movements } = pf;

/** Pornește botul. Întoarce imediat instanța (nu așteaptă spawn). */
export function createBot(config, log) {
  const { host, port, username, version, auth } = config.minecraft;
  log?.info(`Conectare la ${host}:${port} ca "${username}" (${version}, auth: ${auth})...`);

  const bot = mineflayer.createBot({
    host,
    port,
    username,
    version,
    auth,
    viewDistance: 'normal',
    hideErrors: false,
    checkTimeoutInterval: 60_000,
  });

  loadPlugins(bot, log);
  return bot;
}

function loadPlugins(bot, log) {
  try {
    bot.loadPlugin(pf.pathfinder);
  } catch (err) {
    log?.error(`Nu pot încărca pathfinder: ${err.message}`);
  }
  try {
    const plugin = collectBlockModule?.plugin || collectBlockModule;
    if (typeof plugin === 'function') bot.loadPlugin(plugin);
  } catch (err) {
    log?.warn(`Nu pot încărca collectBlock: ${err.message}`);
  }
  try {
    const mod = armorModule?.default || armorModule;
    const plugin = typeof mod === 'function' ? mod : mod?.armorManager;
    if (typeof plugin === 'function') bot.loadPlugin(plugin);
  } catch (err) {
    log?.debug(`armor-manager indisponibil: ${err.message}`);
  }
}

/** Configurează mișcarea: poate să sape pe drum, să urce turnuri de un bloc, parkour. */
export function setupMovements(bot, log) {
  if (!bot.pathfinder) return null;
  const movements = new Movements(bot);
  movements.canDig = true;
  movements.allow1by1towers = true;
  movements.allowParkour = true;
  movements.allowSprinting = true;
  movements.canOpenDoors = true;
  movements.dontMineUnderFallingBlock = true;
  movements.maxDropDown = 3;

  try {
    const scaffolding = ['cobblestone', 'dirt', 'oak_planks', 'stone']
      .map((n) => bot.registry.blocksByName[n]?.id)
      .filter(Boolean);
    if (scaffolding.length) movements.scafoldingBlocks = scaffolding;
  } catch {
    /* ignorat */
  }

  bot.pathfinder.setMovements(movements);
  bot.pathfinder.thinkTimeout = 10_000;
  bot.pathfinder.tickTimeout = 40;
  bot.pathfinder.enablePathfinder = true;
  log?.debug('Mișcare configurată (dig, towers, parkour).');
  return movements;
}

/** Autentificare pe serverele cu AuthMe / parolă în chat. */
export async function loginIfNeeded(bot, config, log) {
  if (!config.minecraft.password) return;
  await sleep(1500);
  try {
    bot.chat(`/login ${config.minecraft.password}`);
    log?.ok('Trimis /login.');
  } catch (err) {
    log?.warn(`Nu am putut trimite /login: ${err.message}`);
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
