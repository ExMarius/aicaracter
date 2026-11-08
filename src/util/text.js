/**
 * Utilitare de text: împărțirea replicilor pentru chatul din Minecraft
 * (limita e 256 de caractere) și curățarea textului pentru ecran.
 */

export function splitChat(text, max = 240) {
  const clean = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return [];
  if (clean.length <= max) return [clean];

  const sentences = clean.match(/[^.!?…]+[.!?…]*/g) || [clean];
  const chunks = [];
  let current = '';

  const push = (chunk) => {
    const c = chunk.trim();
    if (c) chunks.push(c);
  };

  for (const sentence of sentences) {
    const s = sentence.trim();
    if (!s) continue;
    if (s.length > max) {
      // propoziție uriașă: tăiem pe cuvinte
      if (current) {
        push(current);
        current = '';
      }
      let rest = s;
      while (rest.length > max) {
        let cut = rest.lastIndexOf(' ', max);
        if (cut < max * 0.5) cut = max;
        push(rest.slice(0, cut));
        rest = rest.slice(cut).trim();
      }
      current = rest;
      continue;
    }
    if ((current + ' ' + s).trim().length > max) {
      push(current);
      current = s;
    } else {
      current = `${current} ${s}`.trim();
    }
  }
  push(current);
  return chunks;
}

/** Elimină lucruri care arată urât în chat (markdown, puncte multiple). */
export function cleanForChat(text) {
  return String(text || '')
    .replace(/[*_`#]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/!{3,}/g, '!!')
    .replace(/\.{4,}/g, '...')
    .trim();
}
