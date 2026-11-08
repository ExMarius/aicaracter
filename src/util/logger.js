/**
 * Logger minimal, colorat, cu transcript separat pentru montaj.
 * Toate replicile personajului se scriu și în logs/transcript-*.txt,
 * ca să ai textul gata pentru subtitrări în Premiere / CapCut.
 */
import fs from 'node:fs';
import path from 'node:path';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, off: 99 };

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  gray: '\x1b[90m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function stamp() {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

export function createLogger({ level = 'info', logDir = 'logs', name = '' } = {}) {
  const min = LEVELS[level] ?? LEVELS.info;
  let transcriptPath = null;

  if (logDir) {
    try {
      const dir = path.resolve(logDir);
      fs.mkdirSync(dir, { recursive: true });
      const day = new Date().toISOString().slice(0, 10);
      transcriptPath = path.join(dir, `transcript-${day}.txt`);
    } catch {
      transcriptPath = null;
    }
  }

  const prefix = name ? `${C.gray}[${name}]${C.reset} ` : '';

  const write = (color, tag, args) => {
    const text = args
      .map((a) => (typeof a === 'string' ? a : safeStringify(a)))
      .join(' ');
    // eslint-disable-next-line no-console
    console.log(`${C.gray}${stamp()}${C.reset} ${color}${tag}${C.reset} ${prefix}${text}`);
  };

  const logger = {
    debug: (...a) => min <= LEVELS.debug && write(C.gray, '··', a),
    info: (...a) => min <= LEVELS.info && write(C.blue, '»', a),
    ok: (...a) => min <= LEVELS.info && write(C.green, '✓', a),
    warn: (...a) => min <= LEVELS.warn && write(C.yellow, '!', a),
    error: (...a) => min <= LEVELS.error && write(C.red, '✗', a),
    gicu: (...a) => min <= LEVELS.info && write(C.magenta, 'GICU', a),
    player: (...a) => min <= LEVELS.info && write(C.cyan, 'JUCĂTOR', a),
    think: (...a) => min <= LEVELS.debug && write(C.dim + C.white, 'gând', a),
    banner: (text) => min <= LEVELS.info && console.log(`${C.magenta}${C.bold}${text}${C.reset}`),
    /** Scrie o replică în transcript (fără culori, cu timestamp). */
    transcript(kind, text) {
      if (!transcriptPath) return;
      const line = `[${new Date().toISOString()}] ${kind}: ${text}\n`;
      try {
        fs.appendFileSync(transcriptPath, line, 'utf8');
      } catch {
        /* ignorăm: transcriptul nu e critic */
      }
    },
    get transcriptPath() {
      return transcriptPath;
    },
  };

  return logger;
}

function safeStringify(value) {
  try {
    if (value instanceof Error) return `${value.name}: ${value.message}`;
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Taie textele lungi pentru loguri (nu pentru chat). */
export function truncate(text, max = 300) {
  if (typeof text !== 'string') return text;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
