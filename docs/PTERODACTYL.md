# Server pe Pterodactyl — cum îl punem pe Gicu acolo

## Pe scurt

**Nu instalezi nimic pe panou.** Gicu e un program care rulează pe PC-ul tău și se conectează la serverul din Pterodactyl exact ca Minecraft-ul tău: cu adresă și port.

```
   PC-ul tău                              Serverul din Pterodactyl
┌───────────────────────┐               ┌──────────────────────────┐
│  Minecraft (tu joci)  │──────────────►│                          │
│                       │               │  lumea, chunk-urile,     │
│  Gicu (start.bat)     │──────────────►│  alte pluginuri          │
└───────────────────────┘               └──────────────────────────┘
        două conexiuni separate, ca doi jucători
```

Singurul lucru de făcut: să iei adresa corectă din panou și să o pui în `.env`.

---

## Pasul 1 — Ia adresa din panou

În Pterodactyl, intră la serverul tău și uită-te în **Consola** (sus de tot) sau la **Network / Allocations**. Acolo scrie ceva de genul:

```
Server Address:  node-07.hostul-tau.ro:25678
```

sau

```
IP: 185.123.45.67   Port: 25678
```

Asta e tot ce îți trebuie. **Nu folosi `25565` dacă panoul îți arată alt port** — e cea mai frecventă greșeală.

> Dacă ai mai multe alocări (IP-uri/porturi), folosește-o pe cea marcată `primary` sau cea pe care intri tu din Minecraft.

---

## Pasul 2 — Pune adresa în `.env`

Deschide `.env` (dublu-click pe `start.bat` prima dată ți-l deschide automat) și scrie:

```env
MC_HOST=node-07.hostul-tau.ro
MC_PORT=25678
MC_USERNAME=Gicu
MC_OWNER=NumeleTauExactDinMinecraft
MC_VERSION=auto
```

De ce `MC_VERSION=auto`? Pentru că pe paneluri nu se vede mereu versiunea exactă, iar `auto` o detectează singur. Dacă știi sigur că e 1.21.4, poți lăsa `MC_VERSION=1.21.4`.

---

## Pasul 3 — Verifică legătura

Dublu-click pe **`verifica.bat`**. Caută linia:

```
✓ Server Minecraft   node-07.hostul-tau.ro:25678 răspunde
```

- **Verde** → serverul e pornit și adresa e bună. Treci la pasul 4.
- **Roșu `ECONNREFUSED` / `nu răspunde`** → serverul e oprit în panou, sau adresa/portul sunt greșite.
- **Roșu `ENOTFOUND`** → numele hostului e scris greșit (verifică litere cu literă).

---

## Test live, în 10 secunde (înainte să filmezi)

```bash
npm run test-server
```

Îți spune, fără să intre cu botul în joc:

```
🔌 Test live: node-07.hostul-tau.ro:25678

  ✓ Serverul răspunde la ping.
  versiune: 1.21.4 (protocol 769)
  ✓ Jucători: 0 / 20
  MOTD: Un server facut de cap

🎮 Încerc conectarea ca jucător "Gicu" (offline)...

  ✓ CONECTAT în 1.8s. Botul poate intra pe server.
    Poziție: 128 64 -32 | viață 20/20 | overworld
```

Iar dacă nu poate intra, îți spune **motivul exact și ce să schimbi**:

```
  ✗ Nu a intrat. Serverul m-a dat afară: "You are not whitelisted on this server!"

Ce faci:
  → Serverul are whitelist.
  → În Consola panoului scrie:  whitelist add Gicu
```

Dacă vrei doar partea de ping (fără conectare): `npm run test-server -- --ping-only`.

---

## Pasul 4 — Pornește

Dublu-click pe **`start.bat`**. În fereastra neagră ar trebui să vezi:

```
» Conectare la node-07.hostul-tau.ro:25678 ca "Gicu" (versiune auto, auth: offline)...
✓ Sunt în joc. Scrie-mi în chat ce vrei să fac.
```

Iar în Minecraft apare jucătorul **Gicu**.

---

## Dacă nu intră — cele 6 cauze reale

### 1. „You are not whitelisted"
Serverul are whitelist. În **Consola** din panou scrie:

```
whitelist add Gicu
```

(sau `op Gicu` dacă vrei să poți folosi comenzi de admin ca să-i dai materiale cu `/give`)

### 2. „You are not authenticated" / „Invalid session" / „Failed to verify username"
Serverul are `online-mode=true` (premium). Ai două variante:

**A. Cont premium pentru bot** (recomandat dacă serverul e public):
```env
MC_AUTH=microsoft
MC_USERNAME=numele_contului_premium
```
La prima pornire, fereastra neagră îți dă un cod și un link (microsoft.com/link). Introduci codul, te loghezi o dată, și de atunci intră singur (își ține minte sesiunea).

> Ai nevoie de un cont Minecraft premium pentru bot. Poate fi același cont cu al tău? **Nu** — nu poți fi conectat de două ori cu același cont.

**B. Server cu `online-mode=false`** (dacă serverul e doar al tău și nu e public):
În panou → **File Manager** → `server.properties` → caută linia:
```properties
online-mode=true
```
schimb-o în `online-mode=false`, salvezi, apoi **Restart** din panou.

⚠️ Atenție: cu `online-mode=false` oricine îți poate lua numele pe server. E ok pentru un server privat de filmare, nu pentru unul public cu prieteni.

### 3. „Outdated client" / „Outdated server"
Versiunea nu se potrivește. Pune în `.env`:
```env
MC_VERSION=auto
```

### 4. Serverul cere `/login` (AuthMe)
Multe servere de pe paneluri au AuthMe. În `.env`:

```env
MC_PASSWORD=parola_botului
```

Gicu încearcă singur `/register` și `/login`. Dacă serverul tău cere altceva (ex. `/cp login`), scrie comanda exactă:

```env
MC_AUTH_COMMAND=/cp login {parola}
```

### 5. „Server is full"
Serverul are toate sloturile ocupate. Botul ocupă un slot. Dacă joci cu 3 prieteni pe un server de 4, nu mai încape.

### 6. Se conectează și pică imediat
Verifică dacă panoul are un **plugin de protecție la bot** (AntiBot, Panilla, anticheat agresiv). Soluții:
- oprește temporar modulul de protecție anti-bot,
- sau adaugă IP-ul tău în whitelist-ul lui,
- sau, dacă e anticheat de mișcare, vezi secțiunea din `docs/TROUBLESHOOTING.md` (botul se mișcă prea „eficient" pentru pathfinding).

---

## Vrei ca Gicu să fie pe server 24/7, fără PC-ul tău pornit?

Se poate, dar **nu în containerul serverului de Minecraft**. Containerul de la Pterodactyl rulează doar Java și-ți șterge tot la restart.

Ai nevoie de **un al doilea server separat**, tot în panou (dacă adminul îți permite să creezi mai multe), cu un egg **Node.js**:

1. În panou: **Create Server** → alege egg-ul `Node.js` (uneori se numește „Node.js Generic", „Generic Nodejs" sau „Bot Hosting").
2. RAM minim: 256 MB (Gicu consumă ~120-200 MB).
3. În **File Manager** sau prin SFTP, încarcă proiectul (poți urca un zip cu folderul, fără `node_modules`).
4. În **Console**, rulează:
   ```bash
   npm install
   cp .env.example .env
   nano .env      # sau editează din File Manager
   ```
   În `.env` pune adresa serverului de Minecraft (celălalt server din panou) și:
   ```env
   TTS_ENABLED=false
   ```
5. **Startup command** (în tab-ul Startup al serverului): `npm start`

### Cum urci fișierele acolo (SFTP)

Panoul îți dă datele SFTP în pagina serverului (la HidenCloud: host `jacob.hidencloud.com`, port `2022`, user `mariusuke-184939.d496911d`). Le pui în `.env`:

```env
SFTP_HOST=jacob.hidencloud.com
SFTP_PORT=2022
SFTP_USER=mariusuke-184939.d496911d
SFTP_PASS=parola_ta
REMOTE_DIR=.
```

Apoi:

```bash
npm run deploy:sftp -- --dry     # vezi ce s-ar urca (fără să urce nimic)
npm run deploy:sftp             # urcă proiectul
```

Scriptul sare peste `node_modules`, `.git`, `logs/`, `data/` și `.env` (adică peste secrete). Dacă vrei să urci și `.env`, adaugă `-- --with-env` — dar atunci cheia API ajunge pe host, așa că mai bine îl creezi direct din File Manager.

După upload, în **Consolă**: `npm install`, apoi creează `.env` și dă **Restart**.

### Ce pierzi dacă rulează pe panel
- **Vocea nu se aude** — panoul nu are boxe. Gicu va vorbi doar în chat.
- Pentru filmare, tot varianta locală e mai bună: vocea se aude pe PC-ul tău și intră în OBS.

### Configurația ideală pentru serial

| Unde | Ce rulează | De ce |
|---|---|---|
| Pterodactyl | **lumea** (serverul de Minecraft) | e pornită non-stop, nu-ți consumă PC-ul |
| PC-ul tău | **Gicu** (`start.bat`) | vocea se aude local, îl oprești când vrei, vezi logurile |

Exact asta ai deja. Nu trebuie schimbat nimic pe panou.

---

## Rezumat de 4 rânduri

```env
MC_HOST=adresa.din.panou
MC_PORT=portul.din.panou
MC_OWNER=numele_tau
MC_VERSION=auto
```

Apoi `verifica.bat` → `start.bat`. Dacă ceva nu merge, eroarea din fereastra neagră îți spune exact care dintre cele 6 cauze de mai sus e.

---

## Securitate — citește o dată

**Parola SFTP nu are ce căuta într-un fișier din repo**, nici măcar într-un workflow GitHub. Repo-urile publice sunt indexate de boți în minute, iar cine are parola are acces complet la fișierele serverului (inclusiv `server.properties`, lumi, pluginuri).

Dacă ai pus vreodată `SFTP_PASS` sau `SFTP_PASS_BACKUP` într-un `.yml` commis:

1. **Schimbă parola acum** din panoul de găzduire (sau cere adminului resetarea).
2. Șterge fișierul din repo: `git rm .github/workflows/hidencloud-sftp.yml` și fă commit (ștergerea nu scoate parola din istoric, dar oprește expunerea curentă).
3. Pune parola în **GitHub → Settings → Secrets and variables → Actions** ca `SFTP_PASS` și folosește-o ca `${{ secrets.SFTP_PASS }}`.
4. Ține parola doar în `.env` local (e în `.gitignore`) sau în secretul de mai sus.

Același principiu pentru cheia LLM: în `.env`, niciodată în cod.
