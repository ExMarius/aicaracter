/**
 * Puntea dintre uneltele modelului (nume + argumente JSON) și abilitățile reale.
 * Fiecare acțiune întoarce { ok, mesaj, eveniment? } și nu aruncă excepții
 * pentru situații previzibile.
 */

const asNum = (v, fallback = null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const need = (args, keys) =>
  keys.filter((k) => args[k] === undefined || args[k] === null || args[k] === '');

/**
 * @param {object} deps
 * @param {object} deps.skills  instanță Skills (sau stub în teste)
 * @param {object} deps.hooks   { say, speak }
 * @param {object} deps.memory  Memory
 * @param {object} deps.log
 * @param {object} deps.config
 */
export function createActions({ skills, hooks = {}, memory = null, log = null, config = null }) {
  const actions = {
    async spune(args, ctx) {
      const text = String(args.text || '').trim();
      if (!text) return { ok: false, mesaj: 'Textul e gol.' };
      ctx.said = true;
      await hooks.say?.(text);
      await hooks.speak?.(text);
      return { ok: true, mesaj: 'Am spus.' };
    },

    async mergi_la(args, ctx) {
      if (args.jucator) {
        const r = await skills.goToPlayer(args.jucator, { ctx, range: args.aproape === false ? 1 : 2 });
        return r;
      }
      const missing = need(args, ['x', 'y', 'z']);
      if (missing.length) return { ok: false, mesaj: 'Îmi trebuie fie "jucator", fie x, y și z.' };
      return skills.goToPosition(asNum(args.x), asNum(args.y), asNum(args.z), { ctx, range: 2 });
    },

    async urmeaza(args) {
      const r = skills.followPlayer(args.jucator, asNum(args.distanta, 3));
      return r;
    },

    async opreste() {
      skills.stop();
      hooks.stopAll?.();
      return { ok: true, mesaj: 'M-am oprit. Stau.' };
    },

    async sapa(args, ctx) {
      const bloc = String(args.bloc || '').trim();
      if (!bloc) return { ok: false, mesaj: 'Ce bloc să sap?' };
      return skills.mineBlock(bloc, asNum(args.cantitate, 1), ctx);
    },

    async taie_copac(args, ctx) {
      return skills.chopTree(asNum(args.cantitate, 4), args.copac ? String(args.copac) : null, ctx);
    },

    async pune_bloc(args, ctx) {
      const missing = need(args, ['bloc', 'x', 'y', 'z']);
      if (missing.length) return { ok: false, mesaj: `Îmi lipsesc: ${missing.join(', ')}` };
      return skills.placeBlock(String(args.bloc), asNum(args.x), asNum(args.y), asNum(args.z), ctx);
    },

    async construieste(args, ctx) {
      const tip = String(args.tip || 'casa');
      const bloc = String(args.bloc || 'cobblestone');
      return skills.build(tip, bloc, asNum(args.marime, 0), ctx);
    },

    async craft(args, ctx) {
      const item = String(args.item || '').trim();
      if (!item) return { ok: false, mesaj: 'Ce să craftez?' };
      return skills.craftItem(item, asNum(args.cantitate, 1), ctx);
    },

    async echipeaza(args) {
      return skills.equipBest(String(args.ce || 'unealta'));
    },

    async mananca(args, ctx) {
      return skills.eatFood(ctx);
    },

    async ataca(args, ctx) {
      return skills.attackNearest(args.tinta ? String(args.tinta) : null, asNum(args.raza, 12), ctx);
    },

    async dormi(args, ctx) {
      return skills.sleepInBed(ctx);
    },

    async cufar(args, ctx) {
      const actiune = String(args.actiune || '').toLowerCase();
      if (!['depune', 'ia'].includes(actiune)) return { ok: false, mesaj: 'Acțiunea poate fi "depune" sau "ia".' };
      return skills.chest(actiune, args.item ? String(args.item) : null, asNum(args.cantitate, null), ctx);
    },

    async arunca(args) {
      const item = String(args.item || '').trim();
      if (!item) return { ok: false, mesaj: 'Ce să arunc?' };
      return skills.tossItem(item, asNum(args.cantitate, 1));
    },

    async foloseste(args, ctx) {
      return skills.useItem(args.obiect ? String(args.obiect) : null, ctx);
    },

    async priveste(args) {
      const tinta = String(args.tinta || '').trim();
      if (!tinta) return { ok: false, mesaj: 'La cine să mă uit?' };
      return skills.lookAt(tinta);
    },

    async danseaza(args, ctx) {
      return skills.dance(asNum(args.secunde, 4), ctx);
    },

    async status() {
      return { ok: true, mesaj: skills.stateText() };
    },

    async cauta(args) {
      const ce = String(args.ce || '').trim();
      if (!ce) return { ok: false, mesaj: 'Ce să caut?' };
      return skills.findThing(ce, asNum(args.raza, 32));
    },

    async asteapta(args, ctx) {
      const sec = Math.min(15, Math.max(1, asNum(args.secunde, 3)));
      await skills.wait(sec * 1000, ctx);
      return { ok: true, mesaj: `Am așteptat ${sec} secunde. Gândit. Nu mi-a folosit la nimic.` };
    },

    async retine(args) {
      const fapt = String(args.fapt || '').trim();
      if (!fapt) return { ok: false, mesaj: 'Ce să rețin?' };
      if (!memory) return { ok: false, mesaj: 'Memoria nu e disponibilă.' };
      const added = memory.addFact(fapt);
      return {
        ok: true,
        mesaj: added ? `Am notat: ${fapt}` : `Știam deja: ${fapt}`,
      };
    },
  };

  return actions;
}

/** Pentru teste: verifică dacă toate uneltele au implementare. */
export function actionNames(actions) {
  return Object.keys(actions);
}
