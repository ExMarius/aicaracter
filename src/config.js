/**
 * Încarcă .env + construiește obiectul de configurare folosit de tot programul.
 * Nu folosim dependințe externe (dotenv) ca să rămână simplu de rulat.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Parser .env simplu: KEY=VALUE, suportă # comentarii și ghilimele. */
export function parseEnv(content) {
  const out = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** Încarcă .env în process.env fără să suprascrie variabilele deja setate. */
export function loadDotEnv(file = path.join(ROOT, '.env')) {
  if (!fs.existsSync(file)) return {};
  const parsed = parseEnv(fs.readFileSync(file, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value;
    }
  }
  return parsed;
}

const str = (key, fallback) => {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
};
const num = (key, fallback) => {
  const v = Number(process.env[key]);
  return Number.isFinite(v) ? v : fallback;
};
const bool = (key, fallback) => {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'da', 'on'].includes(v.toLowerCase());
};
const list = (key, fallback = []) => {
  const v = str(key, '');
  if (!v) return fallback;
  return v.split(',').map((s) => s.trim()).filter(Boolean);
};

export function buildConfig(overrides = {}) {
  const owners = list('MC_OWNERS', list('MC_OWNER', ['ExMarius']));
  // MC_VERSION=auto → lăsăm mineflayer să negocieze versiunea din ping.
  // Util pe paneluri (Pterodactyl) unde nu știi exact ce versiune rulează.
  const rawVersion = str('MC_VERSION', '1.21.4').trim();
  const version = rawVersion.toLowerCase() === 'auto' ? null : rawVersion;
  const cfg = {
    minecraft: {
      host: str('MC_HOST', 'localhost'),
      port: num('MC_PORT', 25565),
      version,
      versionRaw: rawVersion,
      username: str('MC_USERNAME', 'Gicu'),
      auth: str('MC_AUTH', 'offline').toLowerCase() === 'microsoft' ? 'microsoft' : 'offline',
      owners: owners.map((o) => o.toLowerCase()),
      allowAllPlayers: bool('MC_ALLOW_ALL_PLAYERS', false),
      password: str('MC_PASSWORD', ''),
      // Comandă de autentificare personalizată, ex: "/register {parola} {parola}"
      authCommand: str('MC_AUTH_COMMAND', ''),
      reconnect: bool('MC_RECONNECT', true),
    },
    ai: {
      baseUrl: str('LLM_BASE_URL', 'https://api.openai.com/v1').replace(/\/+$/, ''),
      apiKey: str('LLM_API_KEY', ''),
      model: str('LLM_MODEL', 'gpt-4o-mini'),
      temperature: num('LLM_TEMPERATURE', 0.9),
      maxTokens: num('LLM_MAX_TOKENS', 600),
      mode: str('LLM_MODE', 'tools'),
      timeoutMs: num('LLM_TIMEOUT_MS', 45000),
      maxSteps: Math.max(1, num('BRAIN_MAX_STEPS', 8)),
      historyTurns: 12,
    },
    voice: {
      enabled: bool('TTS_ENABLED', true),
      voice: str('TTS_VOICE', 'ro-RO-EmilNeural'),
      rate: str('TTS_RATE', '+8%'),
      pitch: str('TTS_PITCH', '+2Hz'),
      volume: str('TTS_VOLUME', '+0%'),
      save: bool('TTS_SAVE', false),
      maxChars: num('TTS_MAX_CHARS', 400),
      playerCmd: str('TTS_PLAYER_CMD', ''),
    },
    behavior: {
      reactions: bool('REACTIONS_ENABLED', true),
      idleChatSeconds: num('IDLE_CHAT_SECONDS', 180),
      language: 'ro',
    },
    personaFile: str('PERSONA_FILE', 'persona/gicu.json'),
    logLevel: str('LOG_LEVEL', 'info'),
    logDir: str('LOG_DIR', 'logs'),
    offline: bool('OFFLINE', false),
  };

  return deepMerge(cfg, overrides);
}

export function deepMerge(base, extra) {
  if (!extra || typeof extra !== 'object') return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [key, value] of Object.entries(extra)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof out[key] === 'object') {
      out[key] = deepMerge(out[key], value);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

/** Personalitatea e într-un fișier JSON, ca să o poți edita fără să atingi codul. */
export function loadPersona(file, log) {
  const full = path.isAbsolute(file) ? file : path.join(ROOT, file);
  const fallbackFile = path.join(ROOT, 'persona', 'gicu.json');
  const target = fs.existsSync(full) ? full : fallbackFile;
  try {
    const persona = JSON.parse(fs.readFileSync(target, 'utf8'));
    log?.debug?.(`Personalitate încărcată: ${path.relative(ROOT, target)}`);
    return persona;
  } catch (err) {
    throw new Error(`Nu pot citi personalitatea din ${target}: ${err.message}`);
  }
}
