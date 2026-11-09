/**
 * Client minimal pentru orice API compatibil OpenAI (OpenAI, Groq, OpenRouter,
 * DeepSeek, Together, LM Studio, Ollama...).
 * Fără SDK: doar fetch. Așa merge cu orice furnizor și pe orice versiune de Node.
 */

export class LLMError extends Error {
  constructor(message, { status = 0, retryable = false, toolsUnsupported = false } = {}) {
    super(message);
    this.name = 'LLMError';
    this.status = status;
    this.retryable = retryable;
    this.toolsUnsupported = toolsUnsupported;
  }
}

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new LLMError('Anulat', { status: 0 }));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener?.(
      'abort',
      () => {
        clearTimeout(t);
        reject(new LLMError('Anulat', { status: 0 }));
      },
      { once: true },
    );
  });

export class LLM {
  /**
   * @param {object} cfg  cfg.ai din config
   * @param {object} log  logger
   */
  constructor(cfg, log) {
    this.cfg = cfg;
    this.log = log;
    this.mode = cfg.mode === 'json' ? 'json' : 'tools';
  }

  /** Fără cheie API nu putem vorbi cu modelul (excepție: servere locale). */
  get configured() {
    if (this.cfg.disabled) return false;
    const local = /localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\./.test(this.cfg.baseUrl);
    return Boolean(this.cfg.apiKey) || local;
  }

  get usingTools() {
    return this.mode === 'tools';
  }

  /**
   * Trimite o conversație către model.
   * @returns {Promise<{content: string, toolCalls: Array<{id: string, name: string, args: object}>, usage: object|null}>}
   */
  async chat(messages, { tools = null, signal = null, maxTokens = null, temperature = null, responseSchema = null } = {}) {
    if (!this.configured) throw new LLMError('Nicio cheie API configurată (LLM_API_KEY).', { retryable: false });

    const useTools = Boolean(tools?.length) && this.mode === 'tools';
    const body = {
      model: this.cfg.model,
      messages,
      temperature: temperature ?? this.cfg.temperature,
      max_tokens: maxTokens ?? this.cfg.maxTokens,
      stream: false,
    };
    if (useTools) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }
    if (responseSchema && this.mode === 'json') {
      body.response_format = { type: 'json_object' };
    }

    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const data = await this.request(body, signal);
        return this.parseResponse(data);
      } catch (err) {
        lastError = err;
        if (err instanceof LLMError && err.toolsUnsupported && this.mode === 'tools') {
          this.log?.warn('Modelul nu suportă function calling — trec pe modul JSON.');
          this.mode = 'json';
          // reîncercăm imediat fără tools, în modul JSON
          delete body.tools;
          delete body.tool_choice;
          continue;
        }
        if (err instanceof LLMError && err.status === 0 && /anulat/i.test(err.message)) throw err;
        if (!(err instanceof LLMError) || !err.retryable || attempt === 2) throw err;
        const wait = 700 * 2 ** attempt;
        this.log?.warn(`LLM a răspuns cu eroare (${err.message}). Reîncerc în ${wait}ms...`);
        await sleep(wait, signal);
      }
    }
    throw lastError;
  }

  async request(body, signal) {
    const url = `${this.cfg.baseUrl}/chat/completions`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('timeout')), this.cfg.timeoutMs);
    const onAbort = () => controller.abort(signal.reason);
    if (signal) {
      if (signal.aborted) controller.abort(signal.reason);
      else signal.addEventListener('abort', onAbort, { once: true });
    }

    const headers = { 'Content-Type': 'application/json' };
    if (this.cfg.apiKey) headers.Authorization = `Bearer ${this.cfg.apiKey}`;
    // OpenRouter cere aceste headere ca să te identifice (opțional, dar politicos)
    if (/openrouter\.ai/.test(this.cfg.baseUrl)) {
      headers['HTTP-Referer'] = 'https://github.com/ExMarius/aicaracter';
      headers['X-Title'] = 'Gicu - AICaracter';
    }

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', onAbort);
      if (signal?.aborted) throw new LLMError('Anulat', { status: 0 });
      if (controller.signal.aborted) throw new LLMError('Modelul a răspuns prea încet (timeout).', { retryable: true });
      throw new LLMError(`Nu pot contacta modelul la ${this.cfg.baseUrl}: ${err.message}`, { retryable: true });
    }
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', onAbort);

    const text = await res.text();
    if (!res.ok) {
      const toolsUnsupported =
        res.status === 400 &&
        /tool|function|unsupported|not support|does not support/i.test(text);
      throw new LLMError(
        `Eroare ${res.status} de la ${this.cfg.model}: ${shorten(text)}`,
        { status: res.status, retryable: res.status === 429 || res.status >= 500, toolsUnsupported },
      );
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new LLMError(`Răspuns invalid (nu e JSON): ${shorten(text)}`, { retryable: true });
    }
  }

  parseResponse(data) {
    const choice = data?.choices?.[0];
    if (!choice) {
      const msg = data?.error?.message || 'Răspuns fără choices';
      throw new LLMError(`Modelul a returnat ceva neașteptat: ${msg}`, { retryable: true });
    }
    const message = choice.message || {};
    const toolCalls = (message.tool_calls || []).map((call, i) => {
      let args = {};
      const raw = call?.function?.arguments;
      if (typeof raw === 'string' && raw.trim()) {
        try {
          args = JSON.parse(raw);
        } catch {
          args = { _raw: raw };
        }
      } else if (raw && typeof raw === 'object') {
        args = raw;
      }
      return {
        id: call.id || `call_${i}_${Date.now()}`,
        name: call?.function?.name || '',
        args,
      };
    });

    return {
      content: typeof message.content === 'string' ? message.content : '',
      toolCalls,
      usage: data.usage || null,
    };
  }
}

function shorten(text, max = 220) {
  if (typeof text !== 'string') return String(text);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
