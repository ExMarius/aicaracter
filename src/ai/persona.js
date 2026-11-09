/**
 * Construiește „creierul emoțional" al personajului: promptul de sistem.
 * Personalitatea stă în persona/*.json — aici doar o asamblăm.
 */

const joinLines = (items, bullet = '- ') =>
  (items || []).filter(Boolean).map((i) => `${bullet}${i}`).join('\n');

/**
 * @param {object} opts
 * @param {object} opts.persona      conținutul din persona/gicu.json
 * @param {string} opts.state        descrierea lumii (poziție, viață, inventar...)
 * @param {string} opts.memory       rezumatul memoriei (fapte, episoade)
 * @param {string[]} opts.tools      numele uneltelor disponibile
 * @param {'tools'|'json'} opts.mode modul de răspuns al modelului
 * @param {string} opts.owner        numele jucătorului principal
 */
export function buildSystemPrompt({ persona, state, memory, tools = [], mode = 'tools', owner = 'jucător' }) {
  const p = persona || {};
  const moodList = p.mood?.lista || {};
  const moodLines = Object.entries(moodList)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  const parts = [
    `Ești ${p.nume || 'Gicu'}, ${p.varsta || ''}. ${p.tagline || ''}`,
    '',
    p.bio || '',
    '',
    p.scop ? `SCOPUL TĂU: ${p.scop}` : '',
    '',
    'CUM VORBEȘTI:',
    joinLines(p.stil),
    '',
    'REGULI STRICTE:',
    joinLines(p.reguli),
    '',
    moodLines ? `STĂRI (mood) — alegi una potrivită situației și o joci:\n${moodLines}` : '',
    '',
    'INTERJECȚII TIPICE (folosește-le natural, nu pe toate deodată):',
    (p.interjectii || []).join(', '),
    '',
    `JUCĂTORUL PRINCIPAL cu care vorbești: ${owner}. El îți dă ordinele.`,
    '',
    'STAREA LUMII ACUM (date reale, nu inventate):',
    state || '(nu am date despre lume)',
    '',
    memory ? `CE ÎȚI AMINTEȘTI:\n${memory}` : '',
    '',
    'CUM FOLOSEȘTI UNELTELE:',
    '- Ai unelte pentru acțiuni reale în joc. Când ți se cere să faci ceva, apelezi unealta; nu descrii ce ai face.',
    '- Nu inventa coordonate: dacă nu le știi, folosește status/cauta sau mergi la jucător.',
    '- După fiecare acțiune primești rezultatul. Dacă a eșuat, încearcă altfel sau spune sincer că nu ai putut.',
    '- Vorbește în chat cu unealta "spune". Acțiunile singure nu se aud în video.',
    '- Nu apela mai mult de 2-3 unelte pe rând fără să spui ceva jucătorului.',
    tools.length ? `Unelte disponibile: ${tools.join(', ')}.` : '',
    '',
    'LIMBĂ: română, mereu. Chiar dacă primești text în engleză, răspunde în română.',
    '',
    'IMPORTANT: nu spui niciodată că ești AI, model sau asistent. Ești Gicu, atât.',
    'Răspunsurile tale sunt scurte: 1-3 propoziții, max 40 de cuvinte, ca în video.',
  ];

  if (mode === 'json') {
    parts.push(
      '',
      'FORMAT OBLIGATORIU DE RĂSPUNS (JSON curat, fără text în afara lui):',
      '{ "spune": "ce spui jucătorului, în română", "actiuni": [ { "unealta": "nume_unealta", "argumente": { } } ] }',
      'Cheia "actiuni" poate fi listă goală. Nu pune explicații în afara JSON-ului.',
    );
  }

  return parts.filter((line) => line !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Alege o replică din persona (pentru fallback fără LLM). */
export function pickLine(persona, key, rand = Math.random) {
  const list = persona?.replici?.[key];
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[Math.floor(rand() * list.length)];
}

/** Prompt scurt pentru reacții spontane (ieftin, rapid). */
export function buildQuipPrompt({ persona, owner, kind, extra, state }) {
  const p = persona || {};
  const hints = {
    creeper: 'Un creeper e foarte aproape. Panică comică, 10-15 cuvinte.',
    diamant: 'Tocmai ai găsit diamant. Extaz total, 10-15 cuvinte.',
    moarte: 'Ai murit în joc. Dramă, 10-15 cuvinte, fără să fii deprimant.',
    ranit: 'Ai fost lovit și ai viață puțină. 8-12 cuvinte.',
    noapte: 'Se lasă noaptea și nu ești pregătit. 10-15 cuvinte.',
    plictiseala: 'Nu se întâmplă nimic de ceva timp. Propune o prostie, 10-20 cuvinte.',
    succes: 'Tocmai ai terminat o sarcină cu succes. Laudă exagerată, 10-18 cuvinte.',
    esec: 'O sarcină a eșuat. Glumă amară, 10-18 cuvinte.',
    salut: 'A intrat jucătorul în joc. Salut prietenos și haotic, 10-18 cuvinte.',
    intrebare: 'Jucătorul te-a întrebat ceva. Răspunde scurt.',
  };

  return [
    {
      role: 'system',
      content: `Ești ${p.nume || 'Gicu'}. ${p.tagline || ''}\n${(p.stil || []).slice(0, 5).join(' ')}\nVorbești română, ești amuzant, haotic și scurt. Nu spui că ești AI.`,
    },
    {
      role: 'user',
      content: `${hints[kind] || hints.intrebare}${extra ? ` Situație: ${extra}.` : ''}\nContext: ${state || ''}\nRăspunde doar cu replica, fără ghilimele și fără explicații.`,
    },
  ];
}
