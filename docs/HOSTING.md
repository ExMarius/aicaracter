# Gicu ca jucător permanent, găzduit pe server

## Ce înseamnă „jucător real"

Gicu **nu e un NPC de decor**. Folosește protocolul oficial de joc, exact ca Minecraft-ul tău, deci pentru server este un jucător obișnuit:

- apare în lista de jucători și în tab;
- are inventar, viață, foame, poziție, XP;
- poți să-l omori, poți să-i dai iteme cu `/give`, poți să-l pui în whitelist;
- pluginurile serverului (protecție, economie, chat, skins) îl tratează ca pe orice jucător;
- se vede cu client vanilla, fără moduri la nimeni.

Ce **nu** este: un plugin care desenează o clonă. Aia ar fi NPC (fără inventar real, fără fizică de jucător). Diferența se vede imediat în joc.

## Singura condiție ca să fie „găzduit"

Procesul care gândește (Node.js) trebuie să ruleze undeva. **Nu poate rula în containerul de Minecraft**: pe panourile Pterodactyl acel container are doar Java, iar la restart se șterge tot. Deci ai nevoie de un loc mic, separat, pentru procesul de ~150 MB.

Ai trei variante:

| | Unde rulează Gicu | Cost | Voce | Bun pentru |
|---|---|---|---|---|
| **A. PC-ul tău** | `start.bat` | 0 | **da** (intră în OBS) | filmare, episoade |
| **B. Al doilea server în panel** (egg Node.js) | panoul de găzduire | 0 (dacă planul îl permite) | nu | prezență 24/7 |
| **C. VPS / Raspberry Pi / laptop vechi** | hostul tău Linux | 1-3 €/lună sau 0 | nu | prezență 24/7 + control |

Pentru un serial, combinația câștigătoare e: **lumea pe panel (Aternos/HidenCloud) + Gicu pe PC când filmezi**. Dacă vrei să fie acolo non-stop și când nu filmezi, alegi B sau C.

---

## Varianta B — al doilea server în panel (egg Node.js)

### Cum verifici dacă poți

În panoul de găzduire: **Create Server** (sau „New Server") → la **Egg / Nest** uită-te dacă apare ceva de genul:

- `Node.js`, `Node.js Generic`, `Generic Nodejs`
- `Bot Hosting`, `Discord Bot`, `Node Bot`
- `Npm`, `Generic Runtime`

**Dacă apare** → poți găzdui Gicu acolo, gratuit sau ieftin, 24/7.
**Dacă nu apare** → întreabă administratorul dacă îți poate da un server cu egg de Node.js, sau mergi pe varianta C.

> Important: serverul de Minecraft (Paper) și serverul de bot sunt **două instanțe separate** în panel. Nu încerca să urci botul peste lumea de Minecraft.

### Instalare (5 minute)

1. Creează serverul cu egg Node.js (RAM minim 256 MB, 512 MB e confortabil).
2. Ia datele SFTP din pagina serverului și pune-le în `.env`-ul local:

   ```env
   SFTP_HOST=jacob.hidencloud.com
   SFTP_PORT=2022
   SFTP_USER=utilizatorul.tau
   SFTP_PASS=parola_sftp
   REMOTE_DIR=.
   ```

3. Urcă proiectul:

   ```bash
   npm run deploy:sftp -- --dry     # vezi ce s-ar urca
   npm run deploy:sftp             # urcă
   ```

4. În **Consolă**: `npm install`
5. În **File Manager** creează `.env` (sau urcă-l cu `--with-env`):

   ```env
   MC_HOST=adresa.serverului.de.minecraft
   MC_PORT=portul
   MC_USERNAME=Gicu
   MC_OWNER=numele_tau
   MC_VERSION=auto
   LLM_BASE_URL=https://api.groq.com/openai/v1
   LLM_MODEL=llama-3.3-70b-versatile
   LLM_API_KEY=gsk_...
   TTS_ENABLED=false
   ```

6. **Startup command**: `npm start` → **Restart**.

Dacă pornește, în consola serverului de Minecraft vei vedea `Gicu joined the game`.

---

## Varianta C — VPS / Raspberry Pi / laptop vechi

Orice Linux cu 512 MB RAM și Node 20+ e suficient. Pe un VPS de 1-2 €/lună stă și lumea, și botul, pe același host.

```bash
git clone https://github.com/ExMarius/aicaracter.git
cd aicaracter
bash deploy/install-hosted.sh
```

Scriptul:
1. verifică Node.js,
2. instalează dependințele,
3. te întreabă adresa serverului, numele tău și cheia AI (și scrie `.env`),
4. rulează testul live de conectare,
5. îl instalează ca **serviciu systemd** (pornește singur la boot, repornește la crash) sau cu **pm2**.

Comenzi utile după:

```bash
sudo systemctl status gicu     # merge?
journalctl -u gicu -f          # loguri în timp real
sudo systemctl restart gicu    # repornire
```

Dacă serverul de Minecraft e pe același VPS, pune `MC_HOST=localhost`.

---

## VPS mic: 1 GB RAM, 1 CPU — merge?

**Da, confortabil.** Am măsurat procesul real (bot conectat, cu pathfinding, collectblock și armor-manager încărcate):

```
RSS: 135 MB | heap: 42 MB
```

Cu tot cu sistemul de operare, încarci cam așa:

| Ce consumă | RAM |
|---|---|
| Ubuntu minim | ~200 MB |
| **Gicu** | **~135-250 MB** (vârf la generarea de chunk-uri) |
| Total | ~400 MB din 1024 → **~600 MB liberi** |

**CPU:** aproape zero. Gândirea nu se face pe VPS — modelul AI rulează la furnizor (Groq/OpenAI), iar VPS-ul doar trimite text și primește text. Un singur nucleu e mai mult decât suficient.

### Instalare, de pe VPS (3 comenzi)

```bash
sudo apt update && sudo apt install -y git
git clone --depth 1 https://github.com/ExMarius/aicaracter.git ~/aicaracter
bash ~/aicaracter/deploy/setup-vps.sh
```

Scriptul îți instalează Node.js 22, creează **1 GB de swap** (plasă de siguranță la vârfurile de memorie), clonează proiectul și te întreabă adresa serverului, numele tău și cheia AI. La final îl lasă ca serviciu systemd — pornește singur după reboot și repornește dacă pică.

Verifici că merge:

```bash
sudo systemctl status gicu
journalctl -u gicu -f
```

### Dacă vrei să pui ȘI serverul de Minecraft pe același VPS

Se poate, dar e strâmt la 1 GB. Paper 1.21.4 cu 2 jucători are nevoie de ~700-900 MB. Ca să încapă amândouă:

```bash
java -Xms384M -Xmx640M -XX:+UseG1GC -jar paper.jar --nogui
```

Și în `server.properties`:

```properties
view-distance=5
simulation-distance=4
max-players=5
```

Așteptă-te la lag la generarea de chunk-uri. Pentru un serial curat recomand:

| Unde | Ce |
|---|---|
| VPS 1 GB | **doar Gicu** (24/7, fără PC-ul tău) |
| Panel / Aternos | lumea de Minecraft |

Dacă vrei amândouă pe VPS, urcă la **2 GB RAM** și scapi de griji.

### Ce NU încerca pe 1 CPU / 1 GB

**Ollama sau orice model local.** Un model de 7B are nevoie de ~5 GB RAM și de CPU serios. Pe VPS-ul ăsta folosești obligatoriu un API în cloud (Groq e gratis și rapid).

---

## Detalii care fac diferența la un „jucător real"

### Skin
Pe serverele cu `online-mode=false`, botul apare cu skinul implicit (Steve/Alex). Ca să aibă skin propriu, instalează pe serverul Paper pluginul **SkinsRestorer** și rulează în consolă:

```
skins set Gicu Notch
```

(sau orice nume de cont premium de la care să ia skinul). Clientul vanilla va vedea skinul corect.

### Nume și prefix
În `paper.yml` sau cu un plugin de chat poți să-i pui prefix colorat. Numele din `MC_USERNAME` trebuie să aibă maxim 16 caractere, fără spații.

### Whitelist
Dacă serverul are whitelist: `whitelist add Gicu` în consolă.

### Slot de jucător
Botul ocupă un slot. Pe un server de 4 locuri cu 4 prieteni, nu mai încape nimeni.

### Voce
Pe găzduire (B și C) **nu se aude nimic** — hostul nu are boxe. Gicu va vorbi doar în chat. Pentru episoade, rulează-l local: vocea iese pe Desktop Audio și intră în OBS.

### Anti-cheat
Pathfinding-ul se mișcă prea „perfect" pentru unele pluginuri. Pe server propriu, relaxează verificările de mișcare (vezi `docs/TROUBLESHOOTING.md`).

### Reporniri
Dacă serverul de Minecraft repornește, botul se reconectează singur (la 6 secunde). Nu trebuie să faci nimic.

---

## „Pe orice server" — limitele reale

| Server | Funcționează? |
|---|---|
| Paper/Spigot/Purpur 1.21.x, propriu | **Da** (cel mai simplu: `MC_HOST=localhost`) |
| Panel Pterodactyl / Aternos / HidenCloud | **Da**, cu adresa și portul din panel |
| Server premium (`online-mode=true`) | Da, dar botul are nevoie de **cont premium propriu** (`MC_AUTH=microsoft`) |
| Server cu AuthMe | Da, cu `MC_PASSWORD` sau `MC_AUTH_COMMAND` |
| Servere mari publice (Hypixel etc.) | **Nu** — interzic boți prin regulament, plus verificări anti-bot |
| Server cu anti-bot agresiv | Depinde; cere excepție de la admin |

---

## De ce nu un plugin care să conțină totul

Întrebarea firească: „nu se poate pune AI-ul direct în server, ca plugin?". Se poate, dar atunci personajul e un **NPC**, nu un jucător real, iar ca să-l faci jucător real trebuie să injectezi un `ServerPlayer` prin NMS — muncă serioasă, fragilă la fiecare update de Minecraft, plus reimplementarea în Java a tot ce face acum botul (mers, săpat, craft).

Compromisul actual e cel mai bun raport: **protocolul oficial = jucător real**, iar procesul separat = poți schimba personalitatea dintr-un JSON, fără să recompilezi nimic. Dacă vrei totuși varianta plugin (NPC frumos, 24/7, fără proces separat), e pasul 2 din roadmap și o putem face — dar cu NPC, nu cu jucător real.
