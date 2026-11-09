/**
 * Vocea personajului: text → mp3 cu voce românească (Microsoft Edge TTS, gratuit),
 * apoi redare pe calculatorul tău. OBS-ul înregistrează sunetul sistemului,
 * deci vocea ajunge automat în video — fără moduri în client.
 */
import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';

export class Voice {
  constructor(config, log) {
    this.cfg = config.voice;
    this.log = log;
    this.enabled = Boolean(this.cfg.enabled);
    this.tts = null;
    this.ready = false;
    this.chain = Promise.resolve();
    this.queue = [];
    this.currentProc = null;
    this.player = this.cfg.playerCmd || null;
    this.warnedNoPlayer = false;
    this.tmpRoot = path.join(os.tmpdir(), 'gicu-voice');
    this.outDir = path.resolve('audio-out');
    this.counter = 0;
  }

  async init() {
    if (!this.enabled) {
      this.log?.info('Vocea e oprită (TTS_ENABLED=false).');
      return false;
    }
    try {
      fs.mkdirSync(this.tmpRoot, { recursive: true });
      if (this.cfg.save) fs.mkdirSync(this.outDir, { recursive: true });
      this.tts = new MsEdgeTTS();
      await this.tts.setMetadata(this.cfg.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      this.ready = true;
      this.player = this.player || (await detectPlayer());
      this.log?.ok(
        `Voce pregătită: ${this.cfg.voice}${this.player ? ` (redare: ${this.player})` : ' — ATENȚIE: nu am găsit un player audio, deci vocea nu se va auzi'}`,
      );
      return true;
    } catch (err) {
      this.log?.warn(`Vocea nu a pornit: ${err.message}. Continui fără voce.`);
      this.enabled = false;
      return false;
    }
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
    if (!this.enabled) this.stop();
  }

  /** Adaugă o replică în coada de voce. Nu blochează agentul. */
  speak(text) {
    const clean = stripForSpeech(text, this.cfg.maxChars);
    if (!clean) return;
    this.log?.transcript('VOCE', clean);
    if (!this.enabled || !this.ready) return;

    this.queue.push(clean);
    if (this.queue.length > 4) this.queue.shift(); // nu rămâne în urmă la scene rapide
    this.chain = this.chain
      .then(() => this.drain())
      .catch((err) => this.log?.warn(`Eroare voce: ${err.message}`));
  }

  async drain() {
    while (this.queue.length) {
      const text = this.queue.shift();
      try {
        await this.playOne(text);
      } catch (err) {
        this.log?.debug(`Voce: ${err.message}`);
      }
    }
  }

  async playOne(text) {
    if (!this.tts) return;
    this.counter += 1;
    const dir = path.join(this.tmpRoot, `clip-${this.counter}`);
    fs.mkdirSync(dir, { recursive: true });

    const { audioFilePath } = await this.tts.toFile(dir, text, {
      rate: this.cfg.rate,
      pitch: this.cfg.pitch,
      volume: this.cfg.volume,
    });

    if (this.cfg.save) {
      const target = path.join(this.outDir, `${String(this.counter).padStart(4, '0')}.mp3`);
      try {
        fs.copyFileSync(audioFilePath, target);
      } catch {
        /* ignorat */
      }
    }

    await this.playFile(audioFilePath);
    // curățenie (păstrăm fișierul doar dacă e salvat)
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignorat */
    }
  }

  playFile(file) {
    if (!this.player) {
      if (!this.warnedNoPlayer) {
        this.warnedNoPlayer = true;
        this.log?.warn('Niciun player audio găsit. Instalează mpv/ffmpeg sau setează TTS_PLAYER_CMD. Scriu doar subtitrările.');
      }
      return Promise.resolve();
    }

    if (this.player === 'powershell') return this.playWindows(file);
    if (this.player === 'afplay') return runCommand('afplay', [file]);
    if (this.player === 'mpv') return runCommand('mpv', ['--no-video', '--really-quiet', file]);
    if (this.player === 'ffplay') return runCommand('ffplay', ['-nodisp', '-autoexit', '-loglevel', 'quiet', file]);
    if (this.player === 'paplay') return runCommand('paplay', [file]);
    if (this.player === 'cvlc') return runCommand('cvlc', ['--play-and-exit', '--quiet', file]);

    // comandă custom: {file} se înlocuiește cu calea
    const parts = this.player.includes('{file}')
      ? this.player.split(' ').map((p) => p.replaceAll('{file}', file))
      : [this.player, file];
    return runCommand(parts[0], parts.slice(1));
  }

  playWindows(file) {
    const safe = file.replace(/'/g, "''");
    const script = [
      'Add-Type -AssemblyName presentationCore',
      `$p = New-Object System.Windows.Media.MediaPlayer`,
      `$p.Open([uri]'${safe}')`,
      'for ($i = 0; $i -lt 100 -and -not $p.NaturalDuration.HasTimeSpan; $i++) { Start-Sleep -Milliseconds 40 }',
      '$p.Play()',
      'if ($p.NaturalDuration.HasTimeSpan) { Start-Sleep -Milliseconds ([int]$p.NaturalDuration.TimeSpan.TotalMilliseconds + 150) } else { Start-Sleep -Milliseconds 3000 }',
      '$p.Stop(); $p.Close()',
    ].join('; ');
    return runCommand('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], (proc) => {
      this.currentProc = proc;
    }).finally(() => {
      this.currentProc = null;
    });
  }

  /** Taie vocea imediat (când jucătorul te întrerupe). */
  stop() {
    this.queue = [];
    if (this.currentProc) {
      try {
        this.currentProc.kill('SIGKILL');
      } catch {
        /* ignorat */
      }
      this.currentProc = null;
    }
    this.chain = Promise.resolve();
  }
}

function runCommand(cmd, args, onSpawn) {
  return new Promise((resolve, reject) => {
    let proc;
    try {
      proc = spawn(cmd, args, { stdio: 'ignore' });
    } catch (err) {
      return reject(err);
    }
    onSpawn?.(proc);
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} a ieșit cu codul ${code}`));
    });
  });
}

/** Detectează un player audio disponibil pe sistem. */
export function detectPlayer() {
  if (IS_WIN) return 'powershell';
  const candidates = IS_MAC ? ['afplay'] : ['mpv', 'ffplay', 'paplay', 'cvlc'];
  for (const candidate of candidates) {
    if (commandExists(candidate)) return candidate;
  }
  return null;
}

function commandExists(cmd) {
  const paths = (process.env.PATH || '').split(path.delimiter);
  const exts = IS_WIN ? ['.exe', '.cmd', ''] : [''];
  for (const dir of paths) {
    for (const ext of exts) {
      try {
        if (fs.existsSync(path.join(dir, cmd + ext))) return true;
      } catch {
        /* ignorat */
      }
    }
  }
  return false;
}

/** Curăță textul pentru TTS: fără markdown, emoji, fără repetiții enervante. */
export function stripForSpeech(text, maxChars = 400) {
  if (!text) return '';
  let out = String(text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`>#]/g, '')
    .replace(/https?:\/\/\S+/g, ' link ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (out.length > maxChars) {
    const cut = out.slice(0, maxChars);
    const lastStop = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
    out = lastStop > 40 ? cut.slice(0, lastStop + 1) : `${cut}…`;
  }
  return out;
}
