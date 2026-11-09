# Arhitectură

## Ideea de bază

Proiectul e împărțit în trei straturi care nu se cunosc între ele:

```
   ┌─────────────────────────────────────────────────────────┐
   │  CREIER  (src/ai)                                       │
   │  personalitate · LLM · memorie · decizie                 │
   │  API: handleMessage(), quip(), runTool()                │
   └──────────────────────┬──────────────────────────────────┘
                          │ 22 de unelte cu schemă JSON
   ┌──────────────────────▼──────────────────────────────────┐
   │  MÂINI   (src/minecraft)                                │
   │  skills.js: mișcare, săpat, construit, craft, luptă     │
   │  actions.js: validează argumentele, cheamă skills       │
   └──────────────────────┬──────────────────────────────────┘
                          │ protocol Minecraft 1.21.4
   ┌──────────────────────▼──────────────────────────────────┐
   │  LUME   (serverul tău)                                  │
   └─────────────────────────────────────────────────────────┘

   VOCE (src/voice) ← ascultă ce spune creierul, sintetizează, redă
```

`src/ai` nu importă nimic din `mineflayer`. `src/minecraft` nu știe ce e un LLM. Asta permite:
- teste fără Minecraft și fără internet (vezi `tests/`),
- înlocuirea „corpului" cu un plugin sau un mod fără rescrierea personalității,
- rularea în REPL doar cu creierul.

---

## Fluxul unei comenzi

1. **Chat** → `src/minecraft/events.js` prinde mesajul, verifică dacă e de la proprietar.
2. **Comenzi interne** (`!stop`, `!recap`...) → tratate direct în `Brain.handleCommand`, fără model.
3. **Prompt** → `persona.js` construiește promptul de sistem din:
   - `persona/gicu.json` (identitate, stil, reguli, mood-uri, interjecții),
   - starea reală a lumii (`Skills.stateText()`: poziție, viață, inventar, mobi din jur, oră),
   - rezumatul memoriei (`Memory.summary()`),
   - lista uneltelor disponibile,
   - ultimele 12 replici din conversație.
4. **Model** → răspunde cu `tool_calls` (sau JSON, pentru modele mici).
5. **Execuție** → `brain.runTool()` → `actions.js` → `skills.js` → acțiune reală.
6. **Feedback** → rezultatul fiecărei acțiuni (succes/eșec + motiv) intră înapoi în conversație, ca modelul să poată reacționa.
7. **Replică** → `spune` (chat) + TTS + transcript pentru subtitrări.

Bucla se repetă până la maximum `BRAIN_MAX_STEPS` pași (implicit 8). Dacă jucătorul trimite un mesaj nou în timpul unei acțiuni, `Brain.interrupt()` anulează tot (AbortController + `pathfinder.stop()`), apoi pornește noul tur.

---

## Uneltele (22)

| Categorie | Unelte |
|---|---|
| Vorbă | `spune`, `priveste`, `danseaza`, `asteapta` |
| Mișcare | `mergi_la`, `urmeaza`, `opreste` |
| Resurse | `sapa`, `taie_copac`, `pune_bloc`, `construieste`, `craft` |
| Inventar | `echipeaza`, `mananca`, `cufar`, `arunca`, `foloseste` |
| Luptă | `ataca` |
| Info | `status`, `cauta`, `dormi` |
| Memorie | `retine` |

Fiecare unealtă are:
- **schemă JSON** cu `required` (definită în `src/ai/tools.js`),
- **implementare** în `src/minecraft/actions.js`,
- **validare** care nu aruncă excepții: orice problemă devine `{ ok: false, mesaj }` în română.

Testele verifică automat că fiecare unealtă din `tools.js` are implementare (altfel modelul ar cere ceva ce nu există).

### Cum adaugi o unealtă nouă

Exemplu: „pescuiește".

1. În `src/minecraft/skills.js`, adaugi metoda:

```js
async fish(ctx) {
  const rod = this.itemByName('fishing_rod');
  if (!rod) return { ok: false, mesaj: 'Nu am undiță. Adu-mi una și prind un pește mare.' };
  await this.equipByName('fishing_rod');
  for (let i = 0; i < 30; i++) {
    this.checkAbort(ctx);
    this.bot.activateItem();
    await this.wait(1000, ctx);
    if (this.bot.fish?.caught) break;
  }
  return { ok: true, mesaj: 'Am pescuit! Adică am stat cu undița. Aproape la fel.' };
}
```

2. În `src/ai/tools.js`, adaugi schema:

```js
{
  name: 'pescuieste',
  description: 'Pescuiește cu undița pe care o are în inventar.',
  parameters: { type: 'object', properties: {}, required: [] },
}
```

3. În `src/minecraft/actions.js`, adaugi:

```js
async pescuieste(args, ctx) { return skills.fish(ctx); },
```

4. `npm test` — testul „fiecare unealtă are implementare" verifică singur.
5. Repornești. Modelul vede unealta automat, din lista de unelte.

---

## Moduri de răspuns

**`LLM_MODE=tools`** (recomandat) — function calling nativ. Modelul apelează unelte structurate, promptul rămâne scurt, greșelile de parsare sunt zero.

**`LLM_MODE=json`** — pentru modele mici sau endpoint-uri fără suport de tool calling. Modelul răspunde cu:

```json
{ "spune": "ce zice jucătorului", "actiuni": [ { "unealta": "sapa", "argumente": { "bloc": "stone" } } ] }
```

Dacă serverul răspunde „tools unsupported", clientul trece singur pe JSON după prima eroare.

---

## Personalitatea ca sistem

`persona/gicu.json` nu e doar un text de prompt. Are:

- **stil** — cum vorbește (propoziții scurte, interjecții, comentariu de streamer);
- **reguli** — ce nu face niciodată (nu spune că e AI, nu minte despre acțiuni, fără înjurături grele);
- **mood** — stări pe care le joacă în funcție de context;
- **replici** — fallback garantat când LLM-ul lipsește sau pică;
- **idei_video** — folosite de `!idee` și de creierul offline.

Fallback-ul e important: personajul nu are voie să tacă niciodată. Fără LLM, fără net, fără cheie — tot spune ceva și tot execută comenzi simple (`src/ai/offline.js`).

---

## Memoria

`data/memorie.json`:

```json
{
  "fapte": ["casa e la 120 64 -30", "Marius urăște creeperii"],
  "evenimente": ["2026-11-08 20:14 — A construit casa (96 blocuri cobblestone)"],
  "gaguri": ["porcul care nu era impresionat"],
  "jucatori": { "exmarius": { "nume": "ExMarius", "ultimaData": "2026-11-08" } }
}
```

- Se limitează automat (40 fapte, 40 evenimente, 25 gaguri) ca promptul să nu crească.
- Se poate edita de mână între episoade — util pentru continuitate de serie.
- `!recap` transformă evenimentele într-o recapitulare în stilul personajului.

---

## Vocea

`msedge-tts` (API-ul public al Microsoft Edge Read Aloud) → mp3 → player local:

| Sistem | Player |
|---|---|
| Windows | PowerShell + WPF `MediaPlayer` (inclus) |
| macOS | `afplay` (inclus) |
| Linux | `mpv`, `ffplay`, `paplay` sau `cvlc` |
| Orice | `TTS_PLAYER_CMD` cu `{file}` |

Replicile intră într-o coadă (maxim 4 în așteptare, cele vechi se aruncă) ca să nu rămână în urmă la scene rapide. La `!stop` sau la un mesaj nou, vocea curentă e tăiată — exact ca o întrerupere naturală.

---

## Reacțiile spontane

`src/minecraft/events.js` urmărește:

| Eveniment | Reacție |
|---|---|
| creeper la < 7 blocuri | panică comică (cooldown 25s) |
| diamant în inventar | extaz |
| lăsarea nopții | neliniște, planuri |
| moarte | dramă |
| viață < 10 lovită | „au!" |
| jucătorul principal intră | salut |
| nimic de 3 minute | propune o prostie |

Toate trec prin `Brain.quip()`: un apel scurt (max 90 tokeni) cu prompt dedicat, cu cooldown de 6 secunde și fallback pe replicile din persona. Nu blochează comanda curentă și nu strică bugetul de tokeni.

---

## Costuri

Cu `gpt-4o-mini` și o oră de joc vorbăreț (≈30 de comenzi + ≈40 de reacții), costul e de ordinul a câțiva cenți. Cu Groq/Ollama, zero. Ca să reduci costul:

- `IDLE_CHAT_SECONDS` mai mare (mai puține reacții spontane),
- model mai mic pentru reacții (poți rula două instanțe, dar implicit e unul singur),
- `BRAIN_MAX_STEPS` mai mic.

---

## Testare

```bash
npm test        # 43 de teste, fără rețea, fără Minecraft
npm run check   # sintaxă
```

Ce se testează:
- parsarea `.env` și suprascrierile de config;
- promptul de personalitate (conține identitate, stare, unelte, regula „nu ești AI");
- schemele celor 22 de unelte + existența implementării;
- bucla de agent: tool calls, mod JSON, fallback offline, întrerupere, comenzi `!`;
- planurile de construcție (ordine de jos în sus, golul ușii);
- împărțirea textului pentru chat și curățarea pentru TTS.
