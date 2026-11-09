/**
 * Creierul propriu-zis: primește mesaje de la jucător, decide ce face,
 * apelează unelte reale în joc și răspunde cu personalitate.
 *
 * Fluxul unei comenzi:
 *   jucător → (comandă internă?) → prompt sistem + istoric + stare
 *          → model → tool_calls → execuție în Minecraft → rezultat → model
 *          → replică (chat + voce)
 */
import { buildSystemPrompt, buildQuipPrompt, pickLine } from './persona.js';
import { toolSpecs, TOOL_NAMES } from './tools.js';
import { offlineReply, normalizeRo } from './offline.js';

const TOOL_TIMEOUT_MS = 180_000;
const QUIP_COOLDOWN_MS = 6000;

/** Scoate JSON-ul dintr-un răspuns (inclusiv din ```json ... ```). */
export function parseEnvelope(content) {
  if (!content || typeof content !== 'string') return null;
  let text = content.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1));
    if (!obj || typeof obj !== 'object') return null;
    const spune = typeof obj.spune === 'string' ? obj.spune : typeof obj.text === 'string' ? obj.text : '';
    const raw = Array.isArray(obj.actiuni) ? obj.actiuni : Array.isArray(obj.actions) ? obj.actions : [];
    const actiuni = raw
      .map((a) => ({
        unealta: a?.unealta || a?.tool || a?.name || '',
        argumente: a?.argumente || a?.args || a?.arguments || {},
      }))
      .filter((a) => a.unealta);
    return { spune, actiuni };
  } catch {
    return null;
  }
}

export class Brain {
  /**
   * @param {object} deps
   * @param {object} deps.config
   * @param {object} deps.persona
   * @param {import('./llm.js').LLM} deps.llm
   * @param {import('./memory.js').Memory} deps.memory
   * @param {Record<string, Function>} deps.actions
   * @param {object} deps.hooks  { say(text), speak(text), state(), stopAll(), getOwner(), setVoice(bool) }
   */
  constructor({ config, persona, llm, memory, actions, hooks, log }) {
    this.config = config;
    this.persona = persona;
    this.llm = llm;
    this.memory = memory;
    this.actions = actions;
    this.hooks = hooks;
    this.log = log;

    this.history = [];
    this.busy = false;
    this.currentAbort = null;
    this.lastQuipAt = 0;
    this.voiceOn = true;
    this.owner = hooks.getOwner?.() || 'ExMarius';
  }

  get name() {
    return this.persona?.nume || 'Gicu';
  }

  /** Oprește ce face acum (folosit și de comanda !stop). */
  interrupt(reason = 'comandă nouă') {
    if (this.currentAbort) {
      this.currentAbort.abort(new Error(reason));
      this.currentAbort = null;
    }
    try {
      this.hooks.stopAll?.();
    } catch (err) {
      this.log?.debug(`stopAll: ${err.message}`);
    }
    if (this.busy) this.log?.debug(`Întrerupt: ${reason}`);
    this.busy = false;
  }

  /** Mesaj venit de la un jucător (chat sau whisper). */
  async handleMessage(username, message, { source = 'chat' } = {}) {
    const text = String(message || '').trim();
    if (!text) return;
    if (!this.isAllowed(username)) return;

    this.log?.player(`${username} (${source}): ${text}`);
    this.memory.notePlayer(username, { nume: username });

    if (text.startsWith('!')) {
      const handled = await this.handleCommand(username, text);
      if (handled) return;
    }

    await this.agent({ username, text });
  }

  isAllowed(username) {
    const name = String(username || '').toLowerCase();
    if (this.config.minecraft.allowAllPlayers) return true;
    return this.config.minecraft.owners.includes(name);
  }

  async handleCommand(username, text) {
    const [cmd, ...rest] = text.slice(1).split(/\s+/);
    const arg = rest.join(' ').trim();
    const command = normalizeRo(cmd);

    switch (command) {
      case 'stop':
      case 'opreste':
        this.interrupt('!stop');
        await this.sayAndSpeak('Gata, m-am oprit. Stau ca un stan de piatra. Frumos stan.');
        return true;

      case 'status': {
        const state = await this.hooks.state?.();
        await this.sayAndSpeak(state || 'Nu stiu unde sunt. Asta e ingrijorator.');
        return true;
      }

      case 'voce':
        this.voiceOn = arg ? !/^(off|oprit|0|nu)$/i.test(arg) : !this.voiceOn;
        this.hooks.setVoice?.(this.voiceOn);
        await this.hooks.say?.(`Vocea e ${this.voiceOn ? 'pornită' : 'oprită'}.`);
        return true;

      case 'muta':
        this.voiceOn = false;
        this.hooks.setVoice?.(false);
        await this.hooks.say?.('Mă mut. Vorbesc doar cu mâinile de acum.');
        return true;

      case 'retine': {
        if (!arg) {
          await this.hooks.say?.('Rețin ce? Zi-mi și eu.');
          return true;
        }
        this.memory.addFact(arg);
        await this.hooks.say?.(`Notat: ${arg}`);
        return true;
      }

      case 'recap':
        await this.recap();
        return true;

      case 'idee':
        await this.idea();
        return true;

      case 'reset':
        this.history = [];
        await this.hooks.say?.('Memoria scurtă ștearsă. Cine ești tu? Lasă, glumesc.');
        return true;

      case 'ajutor':
      case 'help':
        await this.hooks.say?.(
          'Comenzi: !stop, !status, !voce on/off, !muta, !retine <fapt>, !recap, !idee, !reset, !ajutor. Sau vorbește normal cu mine.',
        );
        return true;

      default:
        return false;
    }
  }

  /** Bucla de agent: model ↔ unelte, până când personajul are ce spune. */
  async agent({ username, text }) {
    if (this.busy) this.interrupt('mesaj nou');
    const abort = new AbortController();
    this.currentAbort = abort;
    this.busy = true;

    const ctx = {
      signal: abort.signal,
      aborted: () => abort.signal.aborted,
      username,
      said: false,
      progress: (msg) => this.log?.debug(msg),
    };

    try {
      if (!this.llm.configured) {
        await this.offlineTurn(username, text, ctx);
        return;
      }

      const state = (await this.hooks.state?.()) || '';
      const system = buildSystemPrompt({
        persona: this.persona,
        state,
        memory: this.memory.summary(),
        tools: TOOL_NAMES,
        mode: this.llm.usingTools ? 'tools' : 'json',
        owner: username,
      });

      const messages = [
        { role: 'system', content: system },
        ...this.history.slice(-this.config.ai.historyTurns * 2),
        { role: 'user', content: `${username} îți spune: ${text}` },
      ];

      const seenCalls = new Map();
      let finalText = '';

      for (let step = 0; step < this.config.ai.maxSteps; step++) {
        if (ctx.aborted()) throw new Error('anulat');

        const res = await this.llm.chat(messages, {
          tools: this.llm.usingTools ? toolSpecs() : null,
          signal: ctx.signal,
          responseSchema: true,
        });

        if (res.usage) this.log?.think(`tokeni: ${res.usage.prompt_tokens || '?'}→${res.usage.completion_tokens || '?'}`);

        // ── Mod function-calling ─────────────────────────────
        if (res.toolCalls.length) {
          messages.push({
            role: 'assistant',
            content: res.content || '',
            tool_calls: res.toolCalls.map((c) => ({
              id: c.id,
              type: 'function',
              function: { name: c.name, arguments: JSON.stringify(c.args || {}) },
            })),
          });

          for (const call of res.toolCalls) {
            if (ctx.aborted()) throw new Error('anulat');
            const key = `${call.name}:${JSON.stringify(call.args)}`;
            const repeats = (seenCalls.get(key) || 0) + 1;
            seenCalls.set(key, repeats);
            if (repeats > 2) {
              messages.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify({ ok: false, mesaj: 'Ai repetat aceeași acțiune. Schimbă abordarea sau spune-i jucătorului ce s-a întâmplat.' }),
              });
              continue;
            }
            this.log?.think(`${call.name} ${JSON.stringify(call.args)}`);
            const result = await this.runTool(call.name, call.args, ctx);
            messages.push({ role: 'tool', tool_call_id: call.id, content: result });
          }
          continue;
        }

        // ── Mod JSON (modele fără function calling) ──────────
        if (!this.llm.usingTools) {
          const env = parseEnvelope(res.content);
          if (env) {
            if (env.spune) {
              await this.sayAndSpeak(env.spune);
              ctx.said = true;
            }
            if (env.actiuni.length) {
              const results = [];
              for (const a of env.actiuni) {
                if (ctx.aborted()) throw new Error('anulat');
                this.log?.think(`${a.unealta} ${JSON.stringify(a.argumente)}`);
                results.push({ unealta: a.unealta, rezultat: await this.runTool(a.unealta, a.argumente, ctx) });
              }
              messages.push({ role: 'assistant', content: res.content });
              messages.push({
                role: 'user',
                content: `Rezultatele acțiunilor: ${JSON.stringify(results)}\nDacă mai ai ceva de făcut, răspunde iar în formatul JSON. Dacă ai terminat, pune "actiuni": [] și spune o concluzie scurtă.`,
              });
              continue;
            }
            finalText = '';
            break;
          }
        }

        // ── Răspuns text simplu = gândul final al personajului ──
        finalText = cleanReply(res.content);
        break;
      }

      if (ctx.aborted()) return;

      if (finalText) {
        await this.sayAndSpeak(finalText);
        ctx.said = true;
      }

      if (!ctx.said) {
        this.log?.warn('Modelul a terminat fără să spună nimic. Adaug o replică de umplutură.');
        await this.sayAndSpeak(pickLine(this.persona, 'plictiseala') || 'Gata, am terminat. Cred.');
      }

      this.pushHistory(username, text, finalText || '(a acționat)');
      this.memory.addEvent(`${username}: ${text} → ${finalText ? finalText.slice(0, 80) : 'acțiune'}`);
    } catch (err) {
      if (ctx.aborted() || /anulat/i.test(err.message)) {
        this.log?.debug('Acțiune întreruptă.');
        return;
      }
      this.log?.error(`Creierul a dat eroare: ${err.message}`);
      this.pushHistory(username, text, '(eroare)');
      // Dacă modelul nu merge, măcar regulile de rezervă să răspundă frumos
      try {
        await this.offlineTurn(username, text, ctx);
      } catch {
        await this.hooks.say?.('Bă, mi-a picat creierul. Stai o secundă și întreabă-mă din nou.');
      }
    } finally {
      if (this.currentAbort === abort) {
        this.busy = false;
        this.currentAbort = null;
      }
    }
  }

  /** Execută o unealtă și întoarce un rezultat JSON compact pentru model. */
  async runTool(name, args, ctx) {
    const impl = this.actions[name];
    if (typeof impl !== 'function') {
      return JSON.stringify({ ok: false, mesaj: `Unealta "${name}" nu există.` });
    }
    try {
      const result = await withTimeout(impl(args || {}, ctx), TOOL_TIMEOUT_MS, name);
      if (typeof result === 'string') return JSON.stringify({ ok: true, mesaj: result });
      const out = { ok: result?.ok !== false, mesaj: result?.mesaj || 'Gata.' };
      if (result?.eveniment) {
        this.memory.addEvent(result.eveniment);
        delete result.eveniment;
      }
      return JSON.stringify(out);
    } catch (err) {
      if (ctx.aborted() || /anulat/i.test(err.message)) return JSON.stringify({ ok: false, mesaj: 'Acțiune întreruptă de jucător.' });
      this.log?.warn(`Unealta ${name} a eșuat: ${err.message}`);
      return JSON.stringify({ ok: false, mesaj: `A eșuat: ${err.message}` });
    }
  }

  /** Turn fără LLM: reguli simple, dar tot execută acțiuni reale. */
  async offlineTurn(username, text, ctx) {
    const { spune, actiuni } = offlineReply(text, this.persona, { owner: username });
    if (spune) {
      await this.sayAndSpeak(spune);
      ctx.said = true;
    }
    for (const a of actiuni) {
      if (ctx.aborted()) return;
      await this.runTool(a.unealta, a.argumente, ctx);
    }
    this.pushHistory(username, text, spune || '');
  }

  /** Replică scurtă, spontană, la un eveniment din joc. */
  async quip(kind, extra = '') {
    const now = Date.now();
    if (now - this.lastQuipAt < QUIP_COOLDOWN_MS) return;
    this.lastQuipAt = now;

    const fallback = pickLine(this.persona, kind) || pickLine(this.persona, 'plictiseala');
    if (!this.llm.configured || this.busy) {
      if (fallback) await this.sayAndSpeak(fallback);
      return;
    }

    try {
      const state = (await this.hooks.state?.()) || '';
      const res = await this.llm.chat(
        buildQuipPrompt({ persona: this.persona, owner: this.owner, kind, extra, state }),
        { maxTokens: 90, temperature: 1.05 },
      );
      const text = cleanReply(res.content);
      await this.sayAndSpeak(text || fallback);
    } catch (err) {
      this.log?.debug(`quip eșuat (${err.message}), folosesc replica din persona`);
      if (fallback) await this.sayAndSpeak(fallback);
    }
  }

  /** !recap — rezumat de serie, util la începutul episodului. */
  async recap() {
    const state = (await this.hooks.state?.()) || '';
    const mem = this.memory.summary({ events: 10 }) || 'Nimic notabil.';
    if (!this.llm.configured) {
      await this.sayAndSpeak(`Recapitulare: ${mem}`);
      return;
    }
    try {
      const res = await this.llm.chat(
        [
          { role: 'system', content: `Ești ${this.name}, haotic și amuzant. Fă o recapitulare de serial TV în maxim 45 de cuvinte, în română, la persoana I.` },
          { role: 'user', content: `Ce s-a întâmplat până acum:\n${mem}\nStarea de acum: ${state}` },
        ],
        { maxTokens: 160, temperature: 0.95 },
      );
      await this.sayAndSpeak(cleanReply(res.content));
    } catch {
      await this.sayAndSpeak(`Recapitulare: ${mem}`);
    }
  }

  /** !idee — o idee de video pentru episodul următor. */
  async idea() {
    const idei = this.persona?.idei_video?.provocari || [];
    if (!this.llm.configured && idei.length) {
      await this.sayAndSpeak(`Am una bună: ${idei[Math.floor(Math.random() * idei.length)]}.`);
      return;
    }
    try {
      const state = (await this.hooks.state?.()) || '';
      const res = await this.llm.chat(
        [
          {
            role: 'system',
            content: `Ești ${this.name}, un personaj haotic de Minecraft care ajută un youtuber român. Propune o idee de video concretă, filmabilă în 20-30 de minute, în maxim 50 de cuvinte, în română. Fără introducere, doar ideea.`,
          },
          { role: 'user', content: `Contextul de acum: ${state}. Memoria: ${this.memory.summary()}` },
        ],
        { maxTokens: 180, temperature: 1.0 },
      );
      await this.sayAndSpeak(cleanReply(res.content));
    } catch {
      await this.hooks.say?.('N-am nicio idee acum. Asta e ideea: facem un video despre faptul că n-am idei.');
    }
  }

  /** Trimite replica în chat ȘI o rostește, dacă vocea e pornită. */
  async sayAndSpeak(text) {
    const clean = cleanReply(text);
    if (!clean) return;
    try {
      await this.hooks.say?.(clean);
    } catch (err) {
      this.log?.warn(`Nu pot scrie în chat: ${err.message}`);
    }
    if (this.voiceOn) {
      try {
        await this.hooks.speak?.(clean);
      } catch (err) {
        this.log?.warn(`Vocea a eșuat: ${err.message}`);
      }
    }
  }

  pushHistory(username, userText, assistantText) {
    this.history.push({ role: 'user', content: `${username}: ${userText}` });
    this.history.push({ role: 'assistant', content: assistantText });
    const max = this.config.ai.historyTurns * 2;
    while (this.history.length > max) this.history.shift();
  }
}

/** Curăță textul modelului: fără prefixe de tip "Gicu:", fără markdown. */
export function cleanReply(text) {
  if (!text) return '';
  let out = String(text).trim();
  out = out.replace(/^```[\s\S]*?```$/g, '').trim();
  out = out.replace(/^\*?([A-ZĂÂÎȘȚ][\wĂÂÎȘȚăâîșț ]{1,20})\*?\s*:\s*/, (m, who) =>
    /^(gicu|eu)$/i.test(who) ? '' : m,
  );
  out = out.replace(/^["'„”]+|["'„”]+$/g, '');
  out = out.replace(/[*_`#>]/g, '');
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`«${label}» a durat prea mult (${Math.round(ms / 1000)}s)`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
