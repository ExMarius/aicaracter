/**
 * Memoria pe termen lung a personajului: fapte, episoade, gaguri interne.
 * Se salvează într-un JSON simplu ca să poți intra și edita de mână.
 */
import fs from 'node:fs';
import path from 'node:path';

const MAX_FAPTE = 40;
const MAX_EVENIMENTE = 40;
const MAX_GAGURI = 25;

export class Memory {
  constructor(filePath, log) {
    this.file = filePath;
    this.log = log;
    this.data = {
      fapte: [],
      evenimente: [],
      gaguri: [],
      jucatori: {},
      ultimaActualizare: null,
    };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.file)) {
        const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        this.data = { ...this.data, ...raw };
      }
    } catch (err) {
      this.log?.warn(`Memoria nu a putut fi citită (${err.message}). Pornesc cu una goală.`);
    }
    return this.data;
  }

  save() {
    try {
      this.data.ultimaActualizare = new Date().toISOString();
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      this.log?.warn(`Nu pot salva memoria: ${err.message}`);
    }
  }

  /** Adaugă un fapt durabil ("case built at 120 70 -30"). */
  addFact(text) {
    const clean = String(text || '').trim();
    if (!clean) return false;
    if (this.data.fapte.some((f) => f.toLowerCase() === clean.toLowerCase())) return false;
    this.data.fapte.push(clean);
    trim(this.data.fapte, MAX_FAPTE);
    this.save();
    return true;
  }

  /** Adaugă un eveniment cu timp (se vede în rezumat doar ultimele). */
  addEvent(text) {
    const clean = String(text || '').trim();
    if (!clean) return;
    this.data.evenimente.push(`${new Date().toISOString().slice(0, 16).replace('T', ' ')} — ${clean}`);
    trim(this.data.evenimente, MAX_EVENIMENTE);
    this.save();
  }

  addGag(text) {
    const clean = String(text || '').trim();
    if (!clean) return;
    this.data.gaguri.push(clean);
    trim(this.data.gaguri, MAX_GAGURI);
    this.save();
  }

  notePlayer(name, info) {
    if (!name) return;
    const key = String(name).toLowerCase();
    const current = this.data.jucatori[key] || {};
    this.data.jucatori[key] = { ...current, ...info, ultimaData: new Date().toISOString().slice(0, 10) };
    this.save();
  }

  /** Rezumatul care intră în prompt (scurt, ca să nu coste tokeni). */
  summary({ facts = 12, events = 6 } = {}) {
    const parts = [];
    if (this.data.fapte.length) {
      parts.push(`Fapte: ${this.data.fapte.slice(-facts).join(' | ')}`);
    }
    if (this.data.gaguri.length) {
      parts.push(`Gaguri interne: ${this.data.gaguri.slice(-6).join(' | ')}`);
    }
    if (this.data.evenimente.length) {
      parts.push(`Ultimele întâmplări: ${this.data.evenimente.slice(-events).join(' | ')}`);
    }
    return parts.join('\n');
  }

  stats() {
    return {
      fapte: this.data.fapte.length,
      evenimente: this.data.evenimente.length,
      gaguri: this.data.gaguri.length,
    };
  }
}

function trim(arr, max) {
  while (arr.length > max) arr.shift();
}
