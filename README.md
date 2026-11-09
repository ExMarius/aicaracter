# GICU — personaj AI pentru Minecraft 1.21.4

> „Primul român care s-a instalat cu succes în Minecraft."

Un coechipier AI care **intră pe server ca un jucător normal**, vorbește română cu voce, sapă, construiește, craftează, se bate cu monștri, dansează și comentează tot ce se întâmplă. Făcut pentru seriale de YouTube: îi spui în chat „fă-mi o casă" și se apucă de treabă.

> **Nu ești tehnic?** Citește **[GHID-RAPID.md](GHID-RAPID.md)** (explicat fără termeni de programare) și dă dublu-click pe **`start.bat`**. Nu e nici mod, nici plugin: e un program care se conectează la server ca un jucător.

```
tu (în chat):  „Gicu, taie 10 lemne și fă-ne o casă"
Gicu (voce):   „Arhitectul a sosit! Am un plan. Planul e bun. Nu e bun, dar hai să vedem."
               [taie 10 bușteni] [construiește]  →  96 de blocuri mai târziu: „Arată… interesant."
```

---

## Plugin sau mod? (răspunsul scurt)

**Nici plugin, nici mod — un bot-jucător.** Pentru un serial, e cea mai bună variantă din toate punctele de vedere:

| | Mod (Fabric/NeoForge) | Plugin (Paper/Spigot) | **Bot-jucător (ce e aici)** |
|---|---|---|---|
| Trebuie instalat ceva? | Da, la fiecare jucător | Nu | **Nu** |
| Funcționează pe servere existente / Aternos? | Nu | Doar dacă ai acces la server | **Da, oriunde** |
| AI + voce + memorie | Greu (totul în Java) | Greu | **Nativ** |
| Acțiuni reale (sapă, craft, luptă) | Da | Da, cu NMS | **Da, prin protocolul de joc** |
| Se vede ca un jucător normal | Nu | NPC | **Da, cu skin** |
| Cât de repede îl modifici | Recompilare | Recompilare | **Editezi un JSON și repornești** |

Detalii, plus când are sens să treci la plugin/mod: **[docs/PLUGIN-VS-MOD.md](docs/PLUGIN-VS-MOD.md)**.

---

## Ce știe să facă

**Mișcare:** merge la coordonate, te urmează, se oprește la comandă.

**Muncă:** sapă orice bloc, taie copaci, craftează (inclusiv la masă), pune blocuri, construiește case / turnuri / ziduri / poduri / scări, depune și ia din cufere, aruncă iteme.

**Supraviețuire:** mănâncă, doarme, se echipează cu cea mai bună unealtă și armură, se bate cu monștri.

**Show:** dansează, se uită insistent la tine, face glume, reacționează la creeperi, diamante, noapte, moarte, plictiseală.

**Memorie:** reține fapte între episoade („casa e la 120 64 -30"), face recapitulări (`!recap`) și îți propune idei de video (`!idee`).

---

## Pornire în 5 minute

### 1. Ce îți trebuie
- [Node.js](https://nodejs.org) 20 sau mai nou
- Un server de Minecraft **1.21.4** la care să te poți conecta (poți rula unul local cu `java -jar server.jar`)
- Opțional: o cheie de la un model AI (merge și gratis, vezi mai jos)

### 2. Instalează

```bash
git clone https://github.com/ExMarius/aicaracter.git
cd aicaracter
npm install
cp .env.example .env      # pe Windows: copy .env.example .env
```

### 3. Completează `.env`

Minimul absolut:

```env
MC_HOST=localhost
MC_PORT=25565
MC_USERNAME=Gicu
MC_OWNER=NumeleTauDinMinecraft
```

> **Server pe Pterodactyl sau alt panou de găzduire?** Nu instalezi nimic pe panou — iei adresa și portul din Consolă/Network și le pui în `.env`. Ghid pas cu pas, cu toate erorile tipice: **[docs/PTERODACTYL.md](docs/PTERODACTYL.md)**.
>
> **Deploy automat pe server:** pipeline GitHub Actions care compilează pluginul, descarcă Simple Voice Chat, le urcă în `plugins/` prin SFTP și repornește serverul. Vezi **[docs/AUTO-DEPLOY.md](docs/AUTO-DEPLOY.md)**.

> **Vrei ca Gicu să fie jucător permanent, găzduit 24/7?** Vezi **[docs/HOSTING.md](docs/HOSTING.md)**. Pe un VPS de 1 GB RAM / 1 CPU merge lejer (consumă ~135 MB): `bash deploy/setup-vps.sh`.

### 4. Alege un creier (LLM)

| Variantă | Cost | Setare în `.env` |
|---|---|---|
| **Ollama** (local) | gratis | `LLM_BASE_URL=http://localhost:11434/v1`<br>`LLM_MODEL=qwen2.5:7b`<br>`LLM_API_KEY=ollama` |
| **Groq** (rapid, generos la free tier) | gratis | `LLM_BASE_URL=https://api.groq.com/openai/v1`<br>`LLM_MODEL=llama-3.3-70b-versatile`<br>`LLM_API_KEY=gsk_...` |
| **OpenAI** | plătit | `LLM_MODEL=gpt-4o-mini`, `LLM_API_KEY=sk-...` |
| **OpenRouter** (multe modele) | mixt | `LLM_BASE_URL=https://openrouter.ai/api/v1` |
| Fără cheie | gratis | nu pui nimic → merge cu reguli simple (`--offline`) |

### 5. Verifică și pornește

```bash
npm run doctor     # îți spune exact ce lipsește (voce, server, model)
npm start
```

Intră pe server și scrie-i în chat. Atât. 🎬

> Serverul trebuie să aibă `online-mode=false` dacă folosești `MC_AUTH=offline`. Pentru cont premium: `MC_AUTH=microsoft` (prima dată îți cere un cod pe microsoft.com/link).

---

## Vorbește cu el fără Minecraft

```bash
npm run repl
```

Perfect ca să testezi personalitatea, glumele și răspunsurile înainte de filmare.

---

## Comenzi în joc

Doar proprietarul (`MC_OWNER`) îi poate da ordine.

| Comandă | Ce face |
|---|---|
| orice mesaj normal | „vino", „sapă 20 de fier", „fă-mi un turn", „ce faci?" |
| `!stop` | oprește tot (mers, săpat, construit) |
| `!status` | poziție, viață, inventar, ce e în jur |
| `!voce on` / `!voce off` | pornește / oprește vocea |
| `!muta` | tace complet |
| `!retine <fapt>` | bagă ceva în memoria pe termen lung |
| `!recap` | recapitulare de serial, în stilul lui |
| `!idee` | o idee de video pentru episodul următor |
| `!reset` | șterge conversația recentă |
| `!ajutor` | lista comenzilor |

---

## Vocea și OBS

Vocea folosește **Microsoft Edge TTS** — gratuit, fără cont, cu voci românești reale:

- `ro-RO-EmilNeural` (băiat, default)
- `ro-RO-AlinaNeural` (fată, dacă vrei alt personaj)

Botul rulează pe calculatorul tău și redă sunetul local, deci în OBS trebuie doar să ai activă **Desktop Audio** (sau să redai pe un cablu virtual dacă folosești căști). Vocea intră automat în înregistrare, fără moduri în client.

Fiecare replică e scrisă și în `logs/transcript-AAAA-LL-ZZ.txt` — ai textul gata pentru subtitrări.

> **Voce pentru mai mulți jucători?** Azi vocea se aude pe PC-ul care rulează botul (deci în înregistrare). Pentru ca toți jucătorii să-l audă în joc există 4 variante, cu tot cu ce presupune fiecare: **[docs/VOICE.md](docs/VOICE.md)**.

Instalează `mpv` sau `ffmpeg` dacă ești pe Linux; pe Windows folosește PowerShell (deja prezent). Vezi `docs/TROUBLESHOOTING.md`.

---

## Cum arată un episod

Un flux care funcționează:

1. `!recap` — începi episodul cu rezumatul lui haotic.
2. Îi dai o sarcină clară: „taie 20 de lemne, apoi fă-ne o casă de 7".
3. Îl lași să greșească. Greșelile sunt conținutul.
4. Îl întrerupi: „nu, nu, fă un turn". Se oprește și schimbă planul.
5. La final: `!retine casa e la 120 64 -30` și `!idee`.

Ghid complet cu 10 idei de episoade, hook-uri și setări OBS: **[docs/SERIE-YOUTUBE.md](docs/SERIE-YOUTUBE.md)**.

---

## Personalitate

Tot ce e „Gicu" stă în **`persona/gicu.json`** — bio, stil, reguli, replici de rezervă, glume, idei de video. Editezi fișierul, repornești, gata. Vrei un personaj complet diferit? Copiază fișierul, schimbă-l, pune calea în `PERSONA_FILE`.

Cum se scrie o personalitate bună: **[docs/PERSONALITATE.md](docs/PERSONALITATE.md)**.

---

## Cum funcționează (pe scurt)

```
                    ┌──────────────────────────────────────────┐
  tu în chat  ─────►│  CREIER (src/ai)                         │
                    │  personalitate + memorie + stare + LLM   │
                    │  decide: „spune X" / „sapă Y" / „construiește Z"
                    └───────────────┬──────────────────────────┘
                                    │ unelte (22)
                    ┌───────────────▼──────────────────────────┐
                    │  MÂINI (src/minecraft)                    │
                    │  mineflayer: mers, săpat, craft, luptă    │
                    └───────────────┬──────────────────────────┘
                                    │ protocol Minecraft 1.21.4
                    ┌───────────────▼──────────────────────────┐
                    │  SERVERUL TĂU  ←  tu, prietenii, mobii    │
                    └──────────────────────────────────────────┘
                                    │
                    ┌───────────────▼──────────────────────────┐
                    │  VOCE (src/voice) + chat + transcript     │
                    └──────────────────────────────────────────┘
```

Detalii tehnice, cum adaugi o unealtă nouă, cum modifici promptul: **[docs/ARHITECTURA.md](docs/ARHITECTURA.md)**.

---

## Comenzi utile

```bash
npm start          # pornește botul
npm run repl       # vorbește cu el în terminal
npm run doctor     # verifică tot setup-ul
npm run test-server # test live: ping + conectare reală pe serverul tău
npm run deploy:sftp # urcă botul pe un server din panel (egg Node.js)
npm test           # 52 de teste (fără Minecraft, fără internet)
npm run check      # verifică sintaxa
```

---

## Structura proiectului

```
start.bat / start.sh    pornire cu dublu-click
GHID-RAPID.md           ghid fără termeni tehnici
deploy/                 instalare pe găzduire Linux (systemd / pm2 / nohup)
src/
  index.js              pornește tot (Minecraft sau REPL)
  config.js             citirea .env
  ai/
    brain.js            bucla de agent: model ↔ unelte
    persona.js          construiește promptul de personalitate
    tools.js            cele 22 de unelte (scheme JSON)
    llm.js              client pentru orice API compatibil OpenAI
    memory.js           memoria pe termen lung (data/memorie.json)
    offline.js          creierul de rezervă, fără LLM
  minecraft/
    bot.js              conexiunea + pathfinding
    skills.js           abilitățile reale (sapă, construiește, luptă…)
    actions.js          legătura unelte → abilități
    events.js           reacții la ce se întâmplă în joc
  voice/tts.js          vocea românească + redare
persona/gicu.json       personalitatea
docs/                   ghiduri (plugin vs mod, serie, personalitate…)
tests/                  teste automate
```

---

## Stare și limitări (onest)

- Versiunea țintă: **1.21.4** (funcționează și pe 1.21.x vecine).
- Construcțiile sunt simple, din blocuri, fără schematics. Casele ies „interesante" — și asta e parte din farmec. Dacă vrei construcții complexe, urmează versiunea cu plugin.
- Pe servere cu anti-cheat agresiv, botul poate fi considerat suspect (se teleportează la pathfinding). Recomandat: server propriu sau Paper cu verificări relaxate.
- Modelul poate greși (uneori mult). De aceea există `!stop` și de aceea fiecare acțiune are rezultat real înapoi în model.

---

## Roadmap

- [x] Bot-jucător 1.21.4 cu 22 de unelte, voce română, memorie, reacții
- [ ] Plugin Paper opțional (NPC fără slot de jucător, skin custom, mai puțin suspect pentru anti-cheat)
- [ ] Mod Fabric opțional (model 3D custom, animații faciale, lip-sync)
- [ ] Integrare Simple Voice Chat (vocea auzită pozițional, de toți jucătorii)
- [ ] Editor de personalitate din browser

## Licență

MIT — fă ce vrei cu el, doar dă-i credit dacă îl folosești în video.
