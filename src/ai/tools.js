/**
 * Schema uneltelor pe care modelul le poate apela.
 * Fiecare nume de aici trebuie să aibă o implementare în src/minecraft/actions.js
 * (testele verifică asta).
 *
 * Descrierile sunt în română, pentru că modelul primește persona în română.
 */

const num = (description, extra = {}) => ({ type: 'number', description, ...extra });
const str = (description, extra = {}) => ({ type: 'string', description, ...extra });
const bool = (description) => ({ type: 'boolean', description });

export const TOOLS = [
  {
    name: 'spune',
    description:
      'Spune ceva în chatul jocului (se aude și în video). Folosește-o pentru orice replică adresată jucătorului sau comentariu la acțiune.',
    parameters: {
      type: 'object',
      properties: { text: str('Replica ta, în română, maxim 200 de caractere.') },
      required: ['text'],
    },
  },
  {
    name: 'mergi_la',
    description: 'Mergi la niște coordonate sau la un jucător. Pentru jucător nu trebuie coordonate.',
    parameters: {
      type: 'object',
      properties: {
        jucator: str('Numele jucătorului la care mergi (opțional).'),
        x: num('Coordonata X (opțional dacă dai jucator).'),
        y: num('Coordonata Y (opțional).'),
        z: num('Coordonata Z (opțional).'),
        aproape: bool('Dacă true, se oprește la 2 blocuri distanță (implicit true).'),
      },
      required: [],
    },
  },
  {
    name: 'urmeaza',
    description: 'Urmează un jucător până la o nouă comandă.',
    parameters: {
      type: 'object',
      properties: {
        jucator: str('Numele jucătorului.'),
        distanta: num('Cât de aproape să stea, în blocuri (implicit 3).'),
      },
      required: ['jucator'],
    },
  },
  {
    name: 'opreste',
    description: 'Oprește orice acțiune în curs (mers, săpat, construit, urmărit).',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'sapa',
    description:
      'Sapă și colectează un tip de bloc aflat în apropiere. Folosește ID-uri Minecraft: stone, dirt, oak_log, iron_ore, coal_ore, sand, gravel etc.',
    parameters: {
      type: 'object',
      properties: {
        bloc: str('ID-ul blocului, ex: "oak_log", "stone", "iron_ore".'),
        cantitate: num('Câte bucăți (1-64, implicit 1).', { minimum: 1, maximum: 64 }),
      },
      required: ['bloc'],
    },
  },
  {
    name: 'taie_copac',
    description: 'Taie copaci din apropiere și adună lemnul.',
    parameters: {
      type: 'object',
      properties: {
        cantitate: num('Câți bușteni să adune (implicit 1, maxim 64).', { minimum: 1, maximum: 64 }),
        copac: str('Tipul de copac: oak, birch, spruce, jungle, acacia, dark_oak (opțional).'),
      },
      required: [],
    },
  },
  {
    name: 'pune_bloc',
    description: 'Pune un bloc din inventar la coordonate exacte, lângă un bloc existent.',
    parameters: {
      type: 'object',
      properties: {
        bloc: str('ID-ul blocului din inventar, ex: "cobblestone".'),
        x: num('X'), y: num('Y'), z: num('Z'),
      },
      required: ['bloc', 'x', 'y', 'z'],
    },
  },
  {
    name: 'construieste',
    description:
      'Construiește o structură simplă lângă tine, din blocurile pe care le ai în inventar. Tipuri: casa, turn, zid, pod, platforma, scari.',
    parameters: {
      type: 'object',
      properties: {
        tip: str('casa | turn | zid | pod | platforma | scari'),
        bloc: str('Blocul de construcție, ex: "cobblestone", "oak_planks".'),
        marime: num('Dimensiunea în blocuri (3-12, implicit 5).', { minimum: 3, maximum: 12 }),
      },
      required: ['tip', 'bloc'],
    },
  },
  {
    name: 'craft',
    description: 'Craftează un item din ce ai în inventar (ex: crafting_table, wooden_pickaxe, stick, stone_sword).',
    parameters: {
      type: 'object',
      properties: {
        item: str('ID-ul itemului de craftat.'),
        cantitate: num('De câte ori să ruleze rețeta (implicit 1).', { minimum: 1, maximum: 16 }),
      },
      required: ['item'],
    },
  },
  {
    name: 'echipeaza',
    description: 'Echipează cea mai bună unealtă sau armură pe care o ai.',
    parameters: {
      type: 'object',
      properties: { ce: str('unealta | armura | sabie | tarnacop | topor') },
      required: ['ce'],
    },
  },
  {
    name: 'mananca',
    description: 'Mănâncă ceva din inventar ca să îți revii.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'ataca',
    description: 'Atacă cel mai apropiat monstru (sau un tip anume de monstru).',
    parameters: {
      type: 'object',
      properties: {
        tinta: str('Tipul de mob, ex: "zombie", "skeleton", "creeper" (opțional = orice monstru).'),
        raza: num('Raza de căutare în blocuri (implicit 12).'),
      },
      required: [],
    },
  },
  {
    name: 'dormi',
    description: 'Caută un pat în apropiere și dormi ca să treacă noaptea.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'cufar',
    description: 'Deschide cel mai apropiat cufăr și depune sau ia iteme.',
    parameters: {
      type: 'object',
      properties: {
        actiune: str('depune | ia'),
        item: str('ID-ul itemului (opțional la "depune" = tot inventarul).'),
        cantitate: num('Câte bucăți (implicit tot).'),
      },
      required: ['actiune'],
    },
  },
  {
    name: 'arunca',
    description: 'Aruncă un item din inventar (util pentru a da lucruri jucătorului).',
    parameters: {
      type: 'object',
      properties: { item: str('ID-ul itemului.'), cantitate: num('Câte bucăți (implicit 1).') },
      required: ['item'],
    },
  },
  {
    name: 'foloseste',
    description: 'Folosește un item (mâncare, scut, apă etc.) sau activează cel mai apropiat obiect: crafting table, cuptor, levier, ușă, buton.',
    parameters: {
      type: 'object',
      properties: { obiect: str('ID-ul itemului sau al blocului (opțional = ce e mai aproape).') },
      required: [],
    },
  },
  {
    name: 'priveste',
    description: 'Întoarce-te și uită-te la un jucător sau la un mob.',
    parameters: {
      type: 'object',
      properties: { tinta: str('Numele jucătorului sau tipul mobului.') },
      required: ['tinta'],
    },
  },
  {
    name: 'danseaza',
    description: 'Face o mică scenă: sare, se învârte, dă din mâini. Perfect pentru momente comice.',
    parameters: {
      type: 'object',
      properties: { secunde: num('Cât durează (2-10, implicit 4).') },
      required: [],
    },
  },
  {
    name: 'status',
    description: 'Îți spune poziția, viața, foamea, inventarul, ce e în jur și cât e ceasul în joc.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'cauta',
    description: 'Caută în apropiere un bloc, un mob sau un jucător și îți spune unde e.',
    parameters: {
      type: 'object',
      properties: {
        ce: str('ID de bloc (ex: "diamond_ore") sau tip de mob/jucător.'),
        raza: num('Raza de căutare (implicit 32).'),
      },
      required: ['ce'],
    },
  },
  {
    name: 'asteapta',
    description: 'Așteaptă câteva secunde (pentru timing comic sau ca să lași jucătorul să vorbească).',
    parameters: {
      type: 'object',
      properties: { secunde: num('1-15, implicit 3.') },
      required: ['secunde'],
    },
  },
  {
    name: 'retine',
    description:
      'Salvează o informație importantă în memorie pe termen lung (nume de locuri, planuri, gaguri, ce vrea jucătorul să faceți în serie).',
    parameters: {
      type: 'object',
      properties: { fapt: str('Informația de reținut, formulată scurt.') },
      required: ['fapt'],
    },
  },
];

/** Formatul cerut de API-urile compatibile OpenAI. */
export function toolSpecs(tools = TOOLS) {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export const TOOL_NAMES = TOOLS.map((t) => t.name);

export function getTool(name) {
  return TOOLS.find((t) => t.name === name) || null;
}
