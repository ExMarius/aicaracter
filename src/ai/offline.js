/**
 * Creierul de rezervă: reguli simple, fără LLM și fără internet.
 * Folosit când nu ai cheie API, când pică netul sau când modelul e prea lent.
 * Recunoaște comenzile de bază în română, cu sau fără diacritice.
 */
import { pickLine } from './persona.js';

export function normalizeRo(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ăâ]/g, 'a')
    .replace(/î/g, 'i')
    .replace(/ș/g, 's')
    .replace(/ț/g, 't')
    .replace(/\s+/g, ' ')
    .trim();
}

const firstNumber = (text, fallback) => {
  const m = text.match(/(\d{1,3})/);
  if (!m) return fallback;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : fallback;
};

const BLOCKS = [
  [/\bdiamant|diamond\b/, 'diamond_ore'],
  [/\bfier|iron\b/, 'iron_ore'],
  [/\bcarbune|coal\b/, 'coal_ore'],
  [/\bpiatra|stone\b/, 'stone'],
  [/\bnimerit|nisip|sand\b/, 'sand'],
  [/\bzgura|gravel\b/, 'gravel'],
  [/\bpamant|dirt|earth\b/, 'dirt'],
  [/\bcarbune de lemn|log\b/, 'oak_log'],
];

const MOBS = [
  [/\bzombi|zombie\b/, 'zombie'],
  [/\bschelet|skeleton\b/, 'skeleton'],
  [/\bcreeper\b/, 'creeper'],
  [/\bpăianjen|paianjen|spider\b/, 'spider'],
  [/\benderman\b/, 'enderman'],
];

/**
 * @returns {{spune: string, actiuni: Array<{unealta: string, argumente: object}>, stare?: string}}
 */
export function offlineReply(text, persona, ctx = {}) {
  const t = normalizeRo(text);
  const owner = ctx.owner || 'ExMarius';
  const actiuni = [];
  let spune = null;
  let stare = 'fericit';

  const say = (key, fallback) => pickLine(persona, key) || fallback;

  if (/\b(stop|opreste|opreste-te|stai|lasa|ajunge|inceteaza)\b/.test(t)) {
    actiuni.push({ unealta: 'opreste', argumente: {} });
    return { spune: 'Gata, m-am oprit. Stau ca un stană de piatră. Frumos stan.', actiuni, stare };
  }

  if (/\b(ajutor|comenzi|ce stii sa faci|help)\b/.test(t)) {
    return {
      spune:
        'Pot să merg, să te urmez, să sap, să tai copaci, să construiesc, să craftez, să mă bat cu monștri, să dansez și să vorbesc fără să mă opresc. Zi-mi simplu: „taie 10 lemne”, „fă-mi o casă”, „vino aici”.',
      actiuni,
      stare,
    };
  }

  if (/\b(salut|servus|buna|bună|hei|sal|yo|neata)\b/.test(t)) {
    stare = 'haotic';
    spune = say('salut', 'Salut! Bine ai venit!');
  } else if (/\b(gluma|glumă|amuzant|fa-ma sa rad|spune ceva)\b/.test(t)) {
    const jokes = persona?.glume || [];
    spune = jokes.length ? jokes[Math.floor(Math.random() * jokes.length)] : 'N-am nicio glumă. Asta e gluma.';
  } else if (/\b(idee|video|episod|serie|youtube)\b/.test(t)) {
    const idei = persona?.idei_video?.provocari || [];
    spune = idei.length
      ? `Am una bună: ${idei[Math.floor(Math.random() * idei.length)]}. Garantez că iese haos.`
      : 'Hai să facem ceva ce nimeni n-a mai făcut. Adică exact ce au mai făcut toți, dar mai prost.';
  } else if (/\b(mersi|multumesc|mulțumesc|bravo|bun treaba)\b/.test(t)) {
    spune = 'N-ai pentru ce! Eu fac asta din plăcere. Și pentru diamante. Mai ales pentru diamante.';
    stare = 'mandru';
  } else if (/\b(ce faci|ce mai faci|status|unde esti|unde ești|inventar|viata|viață|hp)\b/.test(t)) {
    actiuni.push({ unealta: 'status', argumente: {} });
    spune = 'Stai să mă uit în buzunare și în suflet.';
  } else if (/\b(vino|urmeaza|urmează|hai dupa mine|dupa mine|du-te)\b/.test(t)) {
    actiuni.push({ unealta: 'urmeaza', argumente: { jucator: owner, distanta: 3 } });
    spune = 'Vin, vin! Nu pleca, că mă pierd și după aia trei zile te caut.';
  } else if (/\b(danseaza|dansează|sari|distreaza|fa o schema)\b/.test(t)) {
    actiuni.push({ unealta: 'danseaza', argumente: { secunde: 4 } });
    spune = 'Bă, acum fac cea mai bună coregrafie din istoria blocului. Nu te speria.';
    stare = 'haotic';
  } else if (/\b(mananca|mancare|foame|hambar)\b/.test(t)) {
    actiuni.push({ unealta: 'mananca', argumente: {} });
    spune = 'Mi-e foame ca după o zi de săpat. Unde e carnea?';
  } else if (/\b(taie|copac|copaci|lemn|lemne|wood)\b/.test(t)) {
    const n = Math.min(64, Math.max(1, firstNumber(t, 4)));
    actiuni.push({ unealta: 'taie_copac', argumente: { cantitate: n } });
    spune = `Mă duc după ${n} bucăți de lemn. Dacă mă întorc cu ${n + 1}, e bonus.`;
  } else if (/\b(sapa|sapă|mineaza|extrage|mine)\b/.test(t) || BLOCKS.some(([re]) => re.test(t))) {
    const found = BLOCKS.find(([re]) => re.test(t));
    const bloc = found ? found[1] : 'stone';
    const n = Math.min(64, Math.max(1, firstNumber(t, 8)));
    actiuni.push({ unealta: 'sapa', argumente: { bloc, cantitate: n } });
    spune = `Sap după ${bloc}, ${n} bucăți. Târnăcopul e pregătit, eu mai puțin.`;
  } else if (/\b(casa|casă|construieste|construiește|cladeste|turn|zid|pod|platforma)\b/.test(t)) {
    let tip = 'casa';
    if (/\bturn\b/.test(t)) tip = 'turn';
    else if (/\bzid\b/.test(t)) tip = 'zid';
    else if (/\bpod\b/.test(t)) tip = 'pod';
    else if (/\bplatforma\b/.test(t)) tip = 'platforma';
    actiuni.push({ unealta: 'construieste', argumente: { tip, bloc: 'cobblestone', marime: 5 } });
    spune = 'Arhitectul a sosit! Am un plan. Planul e bun. Nu e bun, dar hai să vedem.';
    stare = 'genial';
  } else if (/\b(craft|crafteaza|craftează|fa-mi|fa o|confectioneaza)\b/.test(t)) {
    const items = [
      [/\btarnacop\b/, 'wooden_pickaxe'],
      [/\bsabie\b/, 'stone_sword'],
      [/\btoppor|topor\b/, 'wooden_axe'],
      [/\bmisoc|scut\b/, 'shield'],
      [/\bmasa|crafting\b/, 'crafting_table'],
      [/\bcufar\b/, 'chest'],
      [/\btorc|faclie\b/, 'torch'],
    ];
    const found = items.find(([re]) => re.test(t));
    actiuni.push({ unealta: 'craft', argumente: { item: found ? found[1] : 'stick', cantitate: 1 } });
    spune = 'Craftez! Dacă nu iese, dau vina pe gravitație.';
  } else if (/\b(ataca|omoara|omor|bate|lupta|monstru|mob)\b/.test(t)) {
    const mob = MOBS.find(([re]) => re.test(t));
    actiuni.push({ unealta: 'ataca', argumente: mob ? { tinta: mob[1] } : {} });
    spune = 'Am văzut ceva mișcându-se. Hai să aflăm dacă e prietenos.';
    stare = 'speriat';
  } else if (/\b(dormi|somn|noapte trecuta)\b/.test(t)) {
    actiuni.push({ unealta: 'dormi', argumente: {} });
    spune = 'Somn? Da. Am nevoie. Am visat aseară un creeper care mă întreba de sănătate.';
  } else if (/\b(retine|noteaza|tine minte)\b/.test(t)) {
    const fact = String(text).replace(/^\s*!?\s*(retine|noteaza|tine minte)\s*/i, '').trim();
    if (fact) actiuni.push({ unealta: 'retine', argumente: { fapt: fact } });
    spune = `Bine, scriu în caiet: „${fact}”. Nu uita că pierd caietele.`;
  } else {
    const generice = [
      'N-am înțeles exact, dar sună bine. Zi-mi mai simplu: vino, sapă, construiește, dansează.',
      'Bă, procesez... procesez... nu, nimic. Repetă, dar mai pe românește.',
      'Aha. Deci. Da. Perfect. Acum zi-mi ce trebuie să fac, concret, că sunt doar un om din blocuri.',
    ];
    spune = generice[Math.floor(Math.random() * generice.length)];
    stare = 'leneș';
  }

  if (!spune) spune = pickLine(persona, 'plictiseala') || 'Sunt aici.';
  return { spune, actiuni, stare };
}
