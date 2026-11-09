/**
 * Traduce motivele pentru care un bot e dat afară în sfaturi concrete.
 * Folosit de scripts/test-server.js (testul live) și util la depanare.
 */

/** Motive cunoscute → ce trebuie făcut. */
const RULES = [
  {
    test: /not whitelisted|whitelist/i,
    advice: (ctx) => [
      'Serverul are whitelist.',
      `În Consola panoului scrie:  whitelist add ${ctx.username}`,
    ],
  },
  {
    test: /not authenticated|invalid session|failed to verify|unverified username|online mode/i,
    advice: (ctx) => [
      'Serverul e pe online-mode=true (premium) și botul nu are cont premium.',
      'Varianta A: în .env pune MC_AUTH=microsoft și MC_USERNAME=contul_premium (botul are nevoie de contul lui).',
      'Varianta B (server privat): în panou → File Manager → server.properties → online-mode=false, apoi restart.',
    ],
  },
  {
    test: /outdated|incompatible|unsupported protocol|incorrect protocol/i,
    advice: () => [
      'Versiunea nu se potrivește.',
      'Pune în .env:  MC_VERSION=auto  (sau versiunea exactă a serverului).',
    ],
  },
  {
    test: /server is full|full/i,
    advice: () => ['Serverul e plin. Botul ocupă un slot — eliberează unul sau mărește numărul de sloturi.'],
  },
  {
    test: /\/login|\/register|authme|not registered|please login|please register/i,
    advice: () => [
      'Serverul cere autentificare (AuthMe).',
      'Pune în .env:  MC_PASSWORD=parola_botului',
      'Dacă serverul cere altă comandă:  MC_AUTH_COMMAND=/login {parola}',
    ],
  },
  {
    test: /banned|you are banned/i,
    advice: () => ['Botul e banat pe server. În Consola panoului:  pardon ' + '{user}'],
  },
  {
    test: /anti.?bot|bot detected|suspicious|too many connections/i,
    advice: () => [
      'Un plugin anti-bot a refuzat conexiunea.',
      'Oprește temporar modulul anti-bot sau adaugă IP-ul de unde rulează botul în lista lui de excepții.',
    ],
  },
  {
    test: /timeout|timed out|read econnreset|socketclosed/i,
    advice: () => [
      'Conexiunea s-a închis fără explicații — de obicei firewall, proxy (Velocity/Bungee) sau serverul s-a oprit.',
      'Verifică dacă intri normal cu clientul de Minecraft pe aceeași adresă și port.',
    ],
  },
];

/**
 * @param {string|object} reason motivul primit de la server (text sau componentă chat)
 * @param {{username?: string}} ctx
 * @returns {string[]} sfaturi în română (poate fi gol dacă nu recunoaștem motivul)
 */
export function diagnoseKickReason(reason, ctx = {}) {
  const text = motdToText(reason) || '';
  const username = ctx.username || 'Gicu';
  const advice = [];
  for (const rule of RULES) {
    if (rule.test.test(text)) {
      for (const line of rule.advice({ username })) advice.push(line.replace('{user}', username));
    }
  }
  return advice;
}

/** Componentele chat din Minecraft pot fi obiecte; le transformăm în text simplu. */
export function motdToText(value) {
  if (value == null) return '';
  if (typeof value === 'string') {
    // uneori e JSON stringificat
    if (value.trim().startsWith('{')) {
      try {
        return motdToText(JSON.parse(value));
      } catch {
        return value;
      }
    }
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(motdToText).join('');
  if (typeof value === 'object') {
    const parts = [];
    if (value.text) parts.push(motdToText(value.text));
    if (value.translate) parts.push(motdToText(value.translate));
    if (Array.isArray(value.extra)) parts.push(value.extra.map(motdToText).join(''));
    if (value.with) parts.push(value.with.map(motdToText).join(''));
    return parts.join('') || JSON.stringify(value);
  }
  return String(value);
}
