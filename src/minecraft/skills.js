/**
 * „Mâinile" personajului: mișcare, săpat, construit, craftat, luptă.
 * Fiecare metodă întoarce { ok, mesaj, eveniment? } și nu aruncă erori
 * pentru situații normale (nu am unealtă, nu am materiale etc.).
 */
import pf from 'mineflayer-pathfinder';
import { Vec3 } from 'vec3';

const { goals } = pf;

const HOSTILE = [
  'zombie', 'husk', 'drowned', 'skeleton', 'stray', 'creeper', 'spider', 'cave_spider',
  'enderman', 'witch', 'slime', 'magma_cube', 'pillager', 'vindicator', 'ravager',
  'phantom', 'zoglin', 'hoglin', 'piglin_brute', 'blaze', 'ghast', 'silverfish', 'guardian',
];

const TOOL_RANK = ['netherite', 'diamond', 'iron', 'golden', 'stone', 'wooden'];

const INTERACTABLE = [
  'crafting_table', 'furnace', 'blast_furnace', 'smoker', 'chest', 'trapped_chest', 'barrel',
  'anvil', 'enchanting_table', 'brewing_stand', 'lever', 'stone_button', 'oak_door', 'oak_trapdoor',
  'campfire', 'soul_campfire', 'respawn_anchor', 'note_block', 'jukebox', 'bell', 'composter',
];

export class Skills {
  constructor(bot, log) {
    this.bot = bot;
    this.log = log;
    this.sleeping = false;
  }

  // ── Utilitare ────────────────────────────────────────────────
  checkAbort(ctx) {
    if (ctx?.aborted?.()) throw new Error('Anulat');
  }

  async wait(ms, ctx, step = 200) {
    let left = ms;
    while (left > 0) {
      this.checkAbort(ctx);
      await new Promise((r) => setTimeout(r, Math.min(step, left)));
      left -= step;
    }
  }

  pos() {
    return this.bot.entity.position.floored();
  }

  isNight() {
    const t = this.bot.time?.timeOfDay ?? 0;
    return t > 12500 && t < 23500;
  }

  itemByName(name) {
    return this.bot.inventory.items().find((i) => i.name === name) || null;
  }

  countItem(name) {
    return this.bot.inventory.items().filter((i) => i.name === name).reduce((s, i) => s + i.count, 0);
  }

  inventorySummary(limit = 14) {
    const items = this.bot.inventory.items();
    if (!items.length) return 'inventar gol';
    const grouped = new Map();
    for (const it of items) grouped.set(it.name, (grouped.get(it.name) || 0) + it.count);
    const list = [...grouped.entries()].sort((a, b) => b[1] - a[1]);
    const first = list.slice(0, limit).map(([n, c]) => `${n} x${c}`);
    if (list.length > limit) first.push(`și încă ${list.length - limit} tipuri`);
    return first.join(', ');
  }

  /** Descrierea stării lumii — intră în promptul modelului. */
  stateText() {
    const b = this.bot;
    if (!b?.entity) return 'Nu sunt conectat la joc.';
    const p = this.pos();
    const biome = this.safeBiome();
    const nearby = this.nearbySummary();
    const held = b.heldItem ? b.heldItem.name : 'nimic';
    return [
      `Poziție: X=${p.x} Y=${p.y} Z=${p.z}, dimensiune ${b.game?.dimension || 'overworld'}${biome ? `, biom ${biome}` : ''}`,
      `Viață: ${Math.round(b.health ?? 20)}/20 | Foame: ${Math.round(b.food ?? 20)}/20 | XP: ${b.experience?.level ?? 0}`,
      `Ora în joc: ${this.isNight() ? 'noapte' : 'zi'} (${(b.time?.timeOfDay ?? 0) | 0})`,
      `Item în mână: ${held}`,
      `Inventar: ${this.inventorySummary()}`,
      nearby ? `În jur: ${nearby}` : 'În jur: nimic notabil',
    ].join(' | ');
  }

  safeBiome() {
    try {
      const b = this.bot.blockAt(this.pos());
      return b?.biome?.name || null;
    } catch {
      return null;
    }
  }

  nearbySummary() {
    const b = this.bot;
    const players = Object.values(b.players || {})
      .filter((p) => p.entity && p.username !== b.username)
      .map((p) => `${p.username} la ${Math.round(p.entity.position.distanceTo(b.entity.position))}b`);
    const mobs = [];
    for (const e of Object.values(b.entities || {})) {
      if (!e || e === b.entity || !e.position) continue;
      const d = e.position.distanceTo(b.entity.position);
      if (d > 16) continue;
      if (e.type === 'player') continue;
      if (e.kind === 'Hostile mobs' || HOSTILE.includes(e.name)) mobs.push(`${e.name} la ${Math.round(d)}b`);
    }
    const uniqMobs = [...new Set(mobs)].slice(0, 6);
    return [...players, ...uniqMobs].join(', ');
  }

  // ── Mișcare ──────────────────────────────────────────────────
  async goto(goal, { timeout = 45_000, ctx } = {}) {
    this.checkAbort(ctx);
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        try {
          this.bot.pathfinder.stop();
        } catch {
          /* ignorat */
        }
        reject(new Error('Drumul a durat prea mult'));
      }, timeout);
    });
    try {
      await Promise.race([this.bot.pathfinder.goto(goal), timeoutPromise]);
      return { ok: true };
    } finally {
      clearTimeout(timer);
    }
  }

  async goToPosition(x, y, z, { range = 2, ctx } = {}) {
    const goal = new goals.GoalNear(Math.floor(x), Math.floor(y), Math.floor(z), range);
    const r = await this.goto(goal, { ctx, timeout: 60_000 });
    return { ...r, mesaj: `Am ajuns la ${Math.floor(x)} ${Math.floor(y)} ${Math.floor(z)}.` };
  }

  async goToPlayer(name, { range = 2, ctx } = {}) {
    const target = this.findPlayer(name);
    if (!target) return { ok: false, mesaj: `Nu văd niciun jucător cu numele ${name}.` };
    await this.goto(new goals.GoalNear(target.entity.position.x, target.entity.position.y, target.entity.position.z, range), { ctx });
    return { ok: true, mesaj: `Am ajuns lângă ${target.username}.` };
  }

  followPlayer(name, distance = 3) {
    const target = this.findPlayer(name);
    if (!target) return { ok: false, mesaj: `Nu văd jucătorul ${name}.` };
    const goal = new goals.GoalFollow(target.entity, Math.max(1, Math.min(10, distance)));
    this.bot.pathfinder.setGoal(goal, true);
    return { ok: true, mesaj: `Te urmăresc, ${target.username}. Nu te mișca prea repede.` };
  }

  findPlayer(name) {
    const wanted = String(name || '').toLowerCase();
    return (
      Object.values(this.bot.players || {}).find(
        (p) => p.username && p.username.toLowerCase() === wanted && p.entity,
      ) || null
    );
  }

  stop() {
    try {
      this.bot.pathfinder.stop();
    } catch {
      /* nu era nimic de oprit */
    }
    try {
      this.bot.clearControlStates();
    } catch {
      /* ignorat */
    }
    try {
      if (this.bot.pathfinder.isMining?.()) this.bot.pathfinder.stop();
    } catch {
      /* ignorat */
    }
    this.bot.stopDigging?.();
  }

  // ── Săpat / colectat ─────────────────────────────────────────
  async mineBlock(blockName, count = 1, ctx) {
    const mcData = this.bot.registry;
    const block = mcData.blocksByName[blockName];
    if (!block) return { ok: false, mesaj: `Nu cunosc blocul "${blockName}".` };
    const wanted = Math.max(1, Math.min(64, Number(count) || 1));
    const before = this.countItem(blockName);

    for (let i = 0; i < wanted; i++) {
      this.checkAbort(ctx);
      const target = this.bot.findBlock({
        matching: block.id,
        maxDistance: 48,
        count: 1,
      });
      if (!target) {
        const got = this.countItem(blockName) - before;
        return {
          ok: got > 0,
          mesaj: got > 0
            ? `Am adunat ${got} ${blockName}, apoi nu am mai găsit în apropiere.`
            : `Nu văd niciun ${blockName} în jur. Mută-te mai aproape de el.`,
        };
      }
      try {
        await this.bot.collectBlock.collect(target, { ignoreNoPath: true });
      } catch (err) {
        this.log?.debug(`collect ${blockName}: ${err.message}`);
      }
    }

    const got = this.countItem(blockName) - before;
    return {
      ok: got > 0,
      mesaj: got > 0 ? `Am adunat ${got} x ${blockName}.` : `N-am reușit să sparg ${blockName}. Poate îmi trebuie un târnăcop mai bun.`,
      eveniment: got > 0 ? `A săpat ${got} ${blockName}` : undefined,
    };
  }

  async chopTree(count = 4, treeType = null, ctx) {
    const logs = treeType
      ? [`${treeType}_log`]
      : ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log', 'cherry_log', 'mangrove_log'];
    const wanted = Math.max(1, Math.min(64, Number(count) || 4));
    let total = 0;
    const deadline = Date.now() + 120_000;

    while (total < wanted && Date.now() < deadline) {
      this.checkAbort(ctx);
      let found = null;
      for (const logName of logs) {
        const block = this.bot.registry.blocksByName[logName];
        if (!block) continue;
        found = this.bot.findBlock({ matching: block.id, maxDistance: 48, count: 1 });
        if (found) break;
      }
      if (!found) break;
      try {
        await this.bot.collectBlock.collect(found, { ignoreNoPath: true });
        total += 1;
      } catch (err) {
        this.log?.debug(`chop: ${err.message}`);
        break;
      }
    }

    return {
      ok: total > 0,
      mesaj: total > 0 ? `Am tăiat ${total} bușteni. Lemnul e lemn.` : 'Nu văd copaci în apropiere. Ori suntem în deșert, ori ești chior.',
      eveniment: total > 0 ? `A tăiat ${total} bușteni` : undefined,
    };
  }

  // ── Construit ────────────────────────────────────────────────
  async placeBlock(blockName, x, y, z, ctx) {
    const target = new Vec3(Math.floor(x), Math.floor(y), Math.floor(z));
    const existing = this.bot.blockAt(target);
    if (existing && existing.name !== 'air' && !existing.name.includes('water') && !existing.name.includes('lava')) {
      return { ok: true, mesaj: `Acolo era deja ${existing.name}.` };
    }
    const item = this.itemByName(blockName);
    if (!item) return { ok: false, mesaj: `Nu am ${blockName} în inventar.` };

    const ref = this.findReference(target);
    if (!ref) return { ok: false, mesaj: 'Nu am lângă ce să pun blocul (trebuie o suprafață lipită).' };

    await this.equipByName(blockName);
    if (this.bot.entity.position.distanceTo(target) > 4.2) {
      await this.goto(new goals.GoalNear(target.x, target.y, target.z, 3), { ctx, timeout: 30_000 });
    }
    try {
      await this.bot.placeBlock(ref.block, ref.face);
      return { ok: true, mesaj: `Am pus ${blockName} la ${target.x} ${target.y} ${target.z}.` };
    } catch (err) {
      // încercăm sărim și să punem din nou (foarte des ajută)
      this.bot.setControlState('jump', true);
      await this.wait(300, ctx);
      this.bot.setControlState('jump', false);
      try {
        await this.bot.placeBlock(ref.block, ref.face);
        return { ok: true, mesaj: `Am pus ${blockName} la ${target.x} ${target.y} ${target.z}.` };
      } catch (err2) {
        return { ok: false, mesaj: `Nu pot pune blocul acolo: ${err2.message}` };
      }
    }
  }

  findReference(target) {
    const faces = [
      [0, -1, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1],
    ];
    for (const [dx, dy, dz] of faces) {
      const p = target.offset(dx, dy, dz);
      const b = this.bot.blockAt(p);
      if (!b) continue;
      if (b.name === 'air' || b.name === 'cave_air' || b.name === 'void_air') continue;
      if (b.name.includes('water') || b.name.includes('lava')) continue;
      if (!b.boundingBox || b.boundingBox === 'empty') continue;
      return { block: b, face: new Vec3(-dx, -dy, -dz) };
    }
    return null;
  }

  /** Construiește o structură simplă din blueprint, în fața botului. */
  async build(type, blockName, size = 0, ctx) {
    const plan = blueprint(type, size);
    if (!plan.length) return { ok: false, mesaj: `Nu știu să construiesc "${type}".` };

    const have = this.countItem(blockName);
    if (have < plan.length) {
      return {
        ok: false,
        mesaj: `Îmi trebuie ${plan.length} x ${blockName}, dar am doar ${have}. Adu-mi ${plan.length - have} și fac o capodoperă.`,
      };
    }

    const base = this.buildOrigin(plan);
    await this.equipByName(blockName);

    let placed = 0;
    for (const cell of plan) {
      this.checkAbort(ctx);
      const target = base.offset(cell.x, cell.y, cell.z);
      const existing = this.bot.blockAt(target);
      if (existing && existing.name !== 'air' && existing.name !== 'cave_air') continue;
      try {
        if (this.bot.entity.position.distanceTo(target) > 4) {
          await this.goto(new goals.GoalNear(target.x, target.y + 1, target.z, 2), { ctx, timeout: 25_000 });
        }
        const ref = this.findReference(target);
        if (!ref) continue;
        await this.bot.placeBlock(ref.block, ref.face);
        placed += 1;
      } catch (err) {
        this.log?.debug(`build: ${err.message}`);
      }
      if (this.countItem(blockName) === 0) break;
    }

    return {
      ok: placed > 0,
      mesaj: placed > 0
        ? `Am construit ${type} cu ${placed} blocuri de ${blockName}. Arată… interesant.`
        : `N-am reușit să pun niciun bloc. Poate e prea abrupt locul.`,
      eveniment: placed > 0 ? `A construit ${type} (${placed} blocuri ${blockName})` : undefined,
    };
  }

  /** Găsește un loc liber în fața botului pentru construcție. */
  buildOrigin(plan) {
    const p = this.pos();
    const yaw = this.bot.entity.yaw;
    const dirX = Math.round(-Math.sin(yaw)) || 0;
    const dirZ = Math.round(Math.cos(yaw)) || 0;
    const width = Math.max(...plan.map((c) => c.x)) + 1;
    const depth = Math.max(...plan.map((c) => c.z)) + 1;
    // centrăm construcția la 2 blocuri în față
    const cx = p.x + dirX * (2 + Math.floor(width / 2));
    const cz = p.z + dirZ * (2 + Math.floor(depth / 2));
    return new Vec3(cx - Math.floor(width / 2), p.y, cz - Math.floor(depth / 2));
  }

  // ── Craft ────────────────────────────────────────────────────
  async craftItem(itemName, count = 1, ctx) {
    const mcData = this.bot.registry;
    const item = mcData.itemsByName[itemName];
    if (!item) return { ok: false, mesaj: `Nu cunosc itemul "${itemName}".` };
    const times = Math.max(1, Math.min(16, Number(count) || 1));
    const before = this.countItem(itemName);

    let table = null;
    let recipes = this.bot.recipesFor(item.id, null, 1, null) || [];

    if (!recipes.length) {
      table = this.findNearbyBlock(['crafting_table'], 32);
      if (table) {
        await this.goto(new goals.GoalNear(table.position.x, table.position.y, table.position.z, 2), { ctx, timeout: 40_000 });
        recipes = this.bot.recipesFor(item.id, null, 1, this.bot.blockAt(table.position)) || [];
      }
    }

    if (!recipes.length && this.countItem('crafting_table') > 0) {
      // punem o masă de craft lângă noi
      const p = this.pos();
      const r = await this.placeBlock('crafting_table', p.x + 1, p.y, p.z, ctx);
      if (r.ok) {
        table = this.bot.findBlock({ matching: mcData.blocksByName.crafting_table.id, maxDistance: 4 });
        if (table) recipes = this.bot.recipesFor(item.id, null, 1, this.bot.blockAt(table.position)) || [];
      }
    }

    if (!recipes.length) {
      return { ok: false, mesaj: `Nu am rețeta pentru ${itemName} sau nu am materialele. Adu-mi ce trebuie.` };
    }

    this.checkAbort(ctx);
    try {
      await this.bot.craft(recipes[0], times, table ? this.bot.blockAt(table.position) : null);
    } catch (err) {
      return { ok: false, mesaj: `Craftul a eșuat: ${err.message}` };
    }

    const got = this.countItem(itemName) - before;
    return {
      ok: got > 0,
      mesaj: got > 0 ? `Am craftat ${got} x ${itemName}.` : `Nu s-a produs nimic. Suspectez gravitația.`,
      eveniment: got > 0 ? `A craftat ${got} ${itemName}` : undefined,
    };
  }

  findNearbyBlock(names, maxDistance = 32) {
    const ids = names.map((n) => this.bot.registry.blocksByName[n]?.id).filter(Boolean);
    if (!ids.length) return null;
    return this.bot.findBlock({ matching: ids, maxDistance, count: 1 });
  }

  // ── Echipare / mâncare ───────────────────────────────────────
  async equipByName(name) {
    const item = this.itemByName(name);
    if (!item) return false;
    try {
      await this.bot.equip(item, 'hand');
      return true;
    } catch {
      return false;
    }
  }

  async equipBest(what = 'unealta') {
    const items = this.bot.inventory.items();
    const rank = (name) => {
      const found = TOOL_RANK.findIndex((m) => name.startsWith(`${m}_`));
      return found === -1 ? 99 : found;
    };
    const pickSuffix = () => {
      switch (what) {
        case 'sabie': return ['_sword'];
        case 'tarnacop': return ['_pickaxe'];
        case 'topor': return ['_axe'];
        case 'armura':
          return ['_helmet', '_chestplate', '_leggings', '_boots'];
        default:
          return ['_pickaxe', '_axe', '_sword', '_shovel'];
      }
    };
    const suffixes = pickSuffix();
    const candidates = items
      .filter((i) => suffixes.some((s) => i.name.endsWith(s)))
      .sort((a, b) => rank(a.name) - rank(b.name));
    if (!candidates.length) {
      if (what === 'armura' && this.bot.armorManager) {
        try {
          await this.bot.armorManager.equipAll();
          return { ok: true, mesaj: 'Am pus ce armură aveam.' };
        } catch {
          /* ignorat */
        }
      }
      return { ok: false, mesaj: `Nu am nimic de tip "${what}" în inventar.` };
    }
    const best = candidates[0];
    try {
      await this.bot.equip(best, 'hand');
      return { ok: true, mesaj: `Am echipat ${best.name}.` };
    } catch (err) {
      return { ok: false, mesaj: `Nu pot echipa: ${err.message}` };
    }
  }

  async eatFood(ctx) {
    const foods = this.bot.inventory
      .items()
      .filter((i) => this.isFood(i.name))
      .sort((a, b) => (this.foodPoints(b.name) || 0) - (this.foodPoints(a.name) || 0));
    if (!foods.length) return { ok: false, mesaj: 'Nu am nimic de mâncare. Adu-mi o pâine, ceva.' };
    if ((this.bot.food ?? 20) >= 20) return { ok: true, mesaj: 'Nu mi-e foame. Sunt plin de energie și de idei.' };
    try {
      await this.bot.equip(foods[0], 'hand');
      this.checkAbort(ctx);
      await this.bot.consume();
      return { ok: true, mesaj: `Am mâncat ${foods[0].name}. Acum pot muta munți.` };
    } catch (err) {
      return { ok: false, mesaj: `Nu pot mânca: ${err.message}` };
    }
  }

  isFood(name) {
    const foods = this.bot.registry?.foodsByName;
    if (foods && foods[name]) return true;
    return /bread|apple|carrot|potato|beef|porkchop|chicken|mutton|rabbit|cod|salmon|cookie|cake|stew|soup|melon|berries|beetroot/.test(name);
  }

  foodPoints(name) {
    const f = this.bot.registry?.foodsByName?.[name];
    return f?.foodPoints ?? 0;
  }

  // ── Luptă ────────────────────────────────────────────────────
  async attackNearest(targetName = null, radius = 12, ctx) {
    const me = this.bot.entity.position;
    const candidates = Object.values(this.bot.entities || {})
      .filter((e) => e && e !== this.bot.entity && e.position && e.isValid !== false)
      .filter((e) => (targetName ? e.name === targetName : e.kind === 'Hostile mobs' || HOSTILE.includes(e.name)))
      .filter((e) => e.position.distanceTo(me) <= radius)
      .sort((a, b) => a.position.distanceTo(me) - b.position.distanceTo(me));

    const target = candidates[0];
    if (!target) {
      return { ok: false, mesaj: targetName ? `Nu văd niciun ${targetName} în jur.` : 'Nu văd niciun monstru. Liniște suspectă.' };
    }

    await this.equipBest('sabie');
    const deadline = Date.now() + 25_000;
    let hits = 0;

    while (Date.now() < deadline && target.isValid !== false) {
      this.checkAbort(ctx);
      const d = target.position.distanceTo(this.bot.entity.position);
      if (d > 2.8) {
        try {
          await this.goto(new goals.GoalNear(target.position.x, target.position.y, target.position.z, 2), { ctx, timeout: 8000 });
        } catch {
          break;
        }
      }
      if (target.position.distanceTo(this.bot.entity.position) <= 3.2) {
        try {
          await this.bot.lookAt(target.position.offset(0, target.height || 1.5, 0), true);
          this.bot.attack(target);
          hits += 1;
        } catch (err) {
          this.log?.debug(`attack: ${err.message}`);
          break;
        }
      }
      if ((this.bot.health ?? 20) < 8) {
        return { ok: true, mesaj: `M-am bătut cu ${target.name}, dar am viață puțină. Bat în retragere, strategic.` };
      }
      await this.wait(620, ctx);
    }

    return {
      ok: true,
      mesaj: hits ? `M-am luptat cu ${target.name}. Am dat ${hits} lovituri. Eu sunt încă întreg, el mai puțin.` : `Nu am ajuns la ${target.name}.`,
      eveniment: `Luptă cu ${target.name}`,
    };
  }

  async sleepInBed(ctx) {
    const bed = this.findNearbyBlock(
      ['red_bed', 'white_bed', 'blue_bed', 'green_bed', 'black_bed', 'yellow_bed', 'orange_bed', 'purple_bed', 'pink_bed', 'lime_bed', 'cyan_bed', 'magenta_bed', 'brown_bed', 'gray_bed', 'light_blue_bed', 'light_gray_bed'],
      24,
    );
    if (!bed) return { ok: false, mesaj: 'Nu văd niciun pat. Fără pat nu dorm nici dacă visez.' };
    if (!this.isNight()) return { ok: true, mesaj: 'E zi. Nu dorm la amiază, nu sunt pensionar.' };
    try {
      await this.goto(new goals.GoalNear(bed.position.x, bed.position.y, bed.position.z, 1), { ctx, timeout: 40_000 });
      await this.bot.sleep(bed);
      return { ok: true, mesaj: 'Noapte bună! Dacă vine un creeper, nu mă trezi. Adică trezește-mă.' };
    } catch (err) {
      return { ok: false, mesaj: `Nu pot dormi: ${err.message}` };
    }
  }

  // ── Cufăr / iteme ────────────────────────────────────────────
  async chest(action, itemName = null, count = null, ctx) {
    const chestBlock = this.findNearbyBlock(['chest', 'trapped_chest', 'barrel'], 32);
    if (!chestBlock) return { ok: false, mesaj: 'Nu văd niciun cufăr în apropiere.' };
    try {
      await this.goto(new goals.GoalNear(chestBlock.position.x, chestBlock.position.y, chestBlock.position.z, 2), { ctx, timeout: 40_000 });
      const container = await this.bot.openContainer(chestBlock);
      const type = itemName ? this.bot.registry.itemsByName[itemName] : null;

      if (action === 'depune') {
        if (type) {
          const have = this.countItem(itemName);
          const n = count ? Math.min(count, have) : have;
          if (!n) {
            await container.close();
            return { ok: false, mesaj: `Nu am ${itemName} de depus.` };
          }
          await container.deposit(type, null, n);
          await container.close();
          return { ok: true, mesaj: `Am depus ${n} x ${itemName} în cufăr.` };
        }
        let moved = 0;
        for (const it of this.bot.inventory.items()) {
          try {
            await container.deposit(it.type, null, it.count);
            moved += it.count;
          } catch {
            /* ignorat */
          }
        }
        await container.close();
        return { ok: true, mesaj: `Am depus ${moved} iteme în cufăr.` };
      }

      if (action === 'ia') {
        const fromChest = container.containerItems();
        const pick = type ? fromChest.filter((c) => c.type === type.id) : fromChest;
        if (!pick.length) {
          await container.close();
          return { ok: false, mesaj: itemName ? `Nu e ${itemName} în cufăr.` : 'Cufărul e gol. Ca planurile mele.' };
        }
        let taken = 0;
        for (const it of pick) {
          const n = count ? Math.min(count - taken, it.count) : it.count;
          if (n <= 0) break;
          try {
            await container.withdraw(it.type, null, n);
            taken += n;
          } catch {
            /* ignorat */
          }
        }
        await container.close();
        return { ok: true, mesaj: `Am luat ${taken} iteme din cufăr.` };
      }

      await container.close();
      return { ok: false, mesaj: 'Acțiune necunoscută pentru cufăr.' };
    } catch (err) {
      return { ok: false, mesaj: `Cufărul nu vrea să colaboreze: ${err.message}` };
    }
  }

  async tossItem(itemName, count = 1) {
    const item = this.itemByName(itemName);
    if (!item) return { ok: false, mesaj: `Nu am ${itemName}.` };
    const n = Math.max(1, Math.min(count || 1, item.count));
    try {
      await this.bot.toss(item.type, null, n);
      return { ok: true, mesaj: `Am aruncat ${n} x ${itemName}. Prinde!` };
    } catch (err) {
      return { ok: false, mesaj: `Nu pot arunca: ${err.message}` };
    }
  }

  async useItem(thingName = null, ctx) {
    if (thingName && this.itemByName(thingName)) {
      try {
        await this.equipByName(thingName);
        this.bot.activateItem();
        await this.wait(400, ctx);
        this.bot.deactivateItem();
        return { ok: true, mesaj: `Am folosit ${thingName}.` };
      } catch (err) {
        return { ok: false, mesaj: `Nu pot folosi ${thingName}: ${err.message}` };
      }
    }
    const block = this.findNearbyBlock(INTERACTABLE, 12);
    if (!block) return { ok: false, mesaj: 'Nu văd nimic cu care să interacționez prin apropiere.' };
    try {
      await this.goto(new goals.GoalNear(block.position.x, block.position.y, block.position.z, 2), { ctx, timeout: 30_000 });
      await this.bot.activateBlock(block);
      return { ok: true, mesaj: `Am activat ${block.name}. Dacă a explodat, nu a fost intenția mea.` };
    } catch (err) {
      return { ok: false, mesaj: `Nu pot activa ${block.name}: ${err.message}` };
    }
  }

  async lookAt(targetName) {
    const wanted = String(targetName || '').toLowerCase();
    const player = this.findPlayer(wanted);
    const entity =
      player?.entity ||
      Object.values(this.bot.entities || {}).find((e) => e && e.name === wanted && e.position);
    if (!entity) return { ok: false, mesaj: `Nu văd ${targetName} în jur.` };
    await this.bot.lookAt(entity.position.offset(0, entity.height || 1.6, 0), true);
    return { ok: true, mesaj: `Mă uit la ${targetName}. Intens.` };
  }

  async dance(seconds = 4.5, ctx) {
    const end = Date.now() + Math.min(10, Math.max(1, seconds)) * 1000;
    let hops = 0;
    while (Date.now() < end) {
      this.checkAbort(ctx);
      this.bot.setControlState('jump', true);
      await this.wait(220, ctx);
      this.bot.setControlState('jump', false);
      try {
        await this.bot.look(this.bot.entity.yaw + 1.9, (Math.random() - 0.5) * 0.6, true);
      } catch {
        /* ignorat */
      }
      try {
        this.bot.swingArm('right');
      } catch {
        /* ignorat */
      }
      hops += 1;
      await this.wait(260, ctx);
    }
    this.stop();
    return { ok: true, mesaj: `Am dansat ${hops} pași. Publicul e în delir.`, eveniment: 'A dansat' };
  }

  findThing(query, radius = 32) {
    const q = String(query || '').toLowerCase();
    const block = this.bot.registry.blocksByName[q];
    if (block) {
      const found = this.bot.findBlock({ matching: block.id, maxDistance: radius, count: 1 });
      if (found) {
        const p = found.position;
        const d = p.distanceTo(this.bot.entity.position);
        return { ok: true, mesaj: `${found.name} la ${p.x} ${p.y} ${p.z}, ${Math.round(d)} blocuri depărtare.` };
      }
    }
    const player = this.findPlayer(q);
    if (player?.entity) {
      const p = player.entity.position;
      return { ok: true, mesaj: `${player.username} e la ${Math.round(p.x)} ${Math.round(p.y)} ${Math.round(p.z)}.` };
    }
    const entity = Object.values(this.bot.entities || {}).find(
      (e) => e && e.name === q && e.position && e.position.distanceTo(this.bot.entity.position) <= radius,
    );
    if (entity) {
      const p = entity.position;
      return { ok: true, mesaj: `${entity.name} e la ${Math.round(p.x)} ${Math.round(p.y)} ${Math.round(p.z)}.` };
    }
    return { ok: false, mesaj: `Nu găsesc "${query}" în ${radius} blocuri.` };
  }
}

/**
 * Planul unei structuri, în coordonate relative (pure, testabil fără Minecraft).
 * @returns {Array<{x:number,y:number,z:number}>} ordonate de jos în sus
 */
export function blueprint(type, size = 0) {
  const n = Math.max(3, Math.min(12, Math.round(size || defaultSize(type))));
  const cells = new Set();
  const add = (x, y, z) => cells.add(`${x},${y},${z}`);
  const tip = String(type || '').toLowerCase();

  if (tip === 'platforma' || tip === 'platformă') {
    for (let x = 0; x < n; x++) for (let z = 0; z < n; z++) add(x, 0, z);
  } else if (tip === 'zid') {
    for (let x = 0; x < n; x++) for (let y = 0; y < 3; y++) add(x, y, 0);
  } else if (tip === 'pod') {
    for (let x = 0; x < n; x++) for (let z = 0; z < 3; z++) add(x, 0, z);
  } else if (tip === 'turn') {
    const h = Math.max(4, n);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) {
        if (x === 1 && z === 1) continue; // gol pe dinăuntru
        add(x, y, z);
      }
    }
    for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) add(x, h, z);
  } else if (tip === 'scari' || tip === 'scări') {
    for (let i = 0; i < n; i++) for (let y = 0; y <= i; y++) add(i, y, 0);
  } else {
    // casa: podea + pereți + acoperiș + ușă
    const w = Math.max(3, n);
    for (let x = 0; x < w; x++) for (let z = 0; z < w; z++) add(x, 0, z);
    for (let y = 1; y <= 3; y++) {
      for (let x = 0; x < w; x++) {
        for (let z = 0; z < w; z++) {
          const edge = x === 0 || z === 0 || x === w - 1 || z === w - 1;
          if (!edge) continue;
          const mid = Math.floor(w / 2);
          const isDoor = z === 0 && x === mid && y <= 2;
          if (isDoor) continue;
          add(x, y, z);
        }
      }
    }
    for (let x = 0; x < w; x++) for (let z = 0; z < w; z++) add(x, 4, z);
  }

  return [...cells]
    .map((key) => {
      const [x, y, z] = key.split(',').map(Number);
      return { x, y, z };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x || a.z - b.z);
}

export function defaultSize(type) {
  const tip = String(type || '').toLowerCase();
  if (tip === 'turn') return 6;
  if (tip === 'pod') return 8;
  if (tip === 'scari' || tip === 'scări') return 6;
  return 5;
}

export { HOSTILE, INTERACTABLE };
