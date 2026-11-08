# Probleme frecvente

Începe mereu cu:

```bash
npm run doctor
```

Îți spune în 10 secunde dacă lipsesc cheia API, vocea, serverul sau playerul audio.

---

## Conexiune la Minecraft

### `ECONNREFUSED` / `getaddrinfo ENOTFOUND`
Serverul nu e pornit sau `MC_HOST`/`MC_PORT` sunt greșite. Testează întâi cu clientul normal din Minecraft.

### `Disconnected: You are not whitelisted` / `not authenticated`
- Server cu `online-mode=false` → `MC_AUTH=offline`.
- Server premium → `MC_AUTH=microsoft`. Prima rulare afișează un cod; îl introduci pe https://microsoft.com/link. Datele se salvează în cache și nu mai e nevoie a doua oară.
- Server cu AuthMe → pune parola în `MC_PASSWORD`; botul trimite singur `/login`.

### „Kicked: moved too quickly" / botul e dat afară de anti-cheat
Pathfinder-ul se mișcă prea eficient. Opțiuni:
- Server propriu: dezactivează verificările de mișcare (`spigot.yml` → `moved-wrongly-threshold: 1000`, `moved-too-quickly-multiplier: 100`).
- Server găzduit: cere administratorului să pună botul pe whitelist de verificări sau folosește un server local pentru filmare.

### Botul se blochează la un perete / nu găsește drumul
- Este o limitare normală a pathfinder-ului în peșteri și lichide. Spune-i „vino aici" sau mută-te mai aproape.
- Poți reduce complexitatea: în `src/minecraft/bot.js`, setează `allowParkour = false` dacă sare aiurea.
- `!stop`, apoi altă comandă — de multe ori e suficient.

---

## Creierul (LLM)

### `401 Unauthorized`
Cheia e greșită sau nu e pentru furnizorul din `LLM_BASE_URL`. Atenție: cheia OpenAI nu merge pe Groq și invers.

### `404 model not found`
Numele modelului e greșit. Verifică lista furnizorului. Exemple valide:
- OpenAI: `gpt-4o-mini`, `gpt-4o`
- Groq: `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`
- Ollama: `qwen2.5:7b`, `llama3.1:8b` (exact cum apare la `ollama list`)

### „Modelul nu suportă function calling"
Clientul trece automat pe `LLM_MODE=json` și reîncearcă. Dacă tot nu merge, pune manual `LLM_MODE=json` în `.env`.

### Răspunde foarte încet
- Modele mari (70B) sunt lente. Pentru reacții spontane, folosește un model mic și rapid.
- Verifică latența: `npm run doctor` o afișează.
- Ollama local: depinde de placa video. Un 7B pe CPU = 2-5s/răspuns.

### Vorbește prea mult / prea serios
Scade `LLM_TEMPERATURE` la 0.7 și scurtează `persona.stil`. Vezi `docs/PERSONALITATE.md`.

### „Bă, mi-a picat creierul"
Mesajul apare când toate încercările au eșuat; botul trece pe regulile de rezervă. Verifică internetul și cheia API în loguri (`logs/`).

---

## Voce

### Nu se aude nimic, dar în log scrie „Voce pregătită"
1. Verifică `npm run doctor` → linia „Player audio".
2. Windows: pornește PowerShell manual și rulează comanda din `src/voice/tts.js` dacă vrei să vezi eroarea.
3. Linux: instalează `mpv` sau `ffmpeg`:
   ```bash
   sudo apt install mpv
   ```
4. Alternativ, pune o comandă proprie:
   ```env
   TTS_PLAYER_CMD=mpv --no-video {file}
   ```

### Se aude, dar nu în înregistrare (OBS)
OBS nu prinde sunetul sistemului. Activează **Desktop Audio** în surse, sau, dacă folosești căști, instalează un cablu virtual (VB-Cable pe Windows, BlackHole pe macOS) și rutează vocea acolo.

### Vocea e tăiată la jumătate
Normal: la un mesaj nou sau `!stop`, replica curentă e întreruptă (ca într-o conversație reală). Crește `TTS_MAX_CHARS` dacă vrei replici mai lungi rostite integral.

### Vocea nu corespunde personajului
```env
TTS_VOICE=ro-RO-AlinaNeural
TTS_RATE=+15%
TTS_PITCH=+10Hz
```
Vezi lista de voci cu `node -e "import('msedge-tts').then(m=>console.log(Object.keys(m)))"` sau documentația Microsoft.

---

## Comportament în joc

### Nu răspunde la comenzi
- Verifică numele din `MC_OWNER` — trebuie să fie exact numele tău din joc (fără spații, case-insensitive).
- Pentru teste: `MC_ALLOW_ALL_PLAYERS=true`.
- Dacă scrii pe server cu prefix (`!` sau `/`), mesajul trebuie să ajungă în chat normal. Pe servere cu canale de chat custom, botul poate primi alt format — vezi evenimentul `chat` în `src/minecraft/events.js`.

### Spamează chatul
Replicile lungi sunt împărțite în bucăți de 240 de caractere, cu 0.9s între ele. Dacă tot e prea mult, folosește `!voce on` (atunci când vocea merge, poți renunța la chat) sau scurtează `persona.stil`.

### Nu construiește nimic
Verifică în log: `[sapa] A eșuat…` sau `Îmi trebuie 96 x cobblestone, dar am doar 12`. Botul e cinstit: nu inventează blocuri. Dă-i materiale:
- „sapă 64 de piatră", apoi „fă-mi o casă de 5".
- Sau pune-i itemele în inventar dacă serverul permite (`/give Gicu cobblestone 128`).

### Construiește pe dos / în aer
- Planul e calculat în fața botului; rotește-l cu „privește spre locul ăla" sau mută-te pe un teren plat.
- Nu construiește peste apă/lavă (intenționat).

### Se blochează când îl întrerupi
Apasă `!stop`. Dacă tot e blocat, repornește botul (`Ctrl+C`, `npm start`). Memoria se păstrează.

### Doarme prea des / nu doarme
`dormi` funcționează doar noaptea și doar dacă există pat în 24 de blocuri.

---

## Altele

### `Cannot find module ...`
Rulează `npm install` din nou. Dacă ai Node < 20, urcă la 20+.

### Unde sunt logurile?
- `logs/transcript-AAAA-LL-ZZ.txt` — toate replicile (chat + voce), cu timestamp. Perfect pentru subtitrări.
- Consola afișează gândurile modelului dacă pornești cu `LOG_LEVEL=debug`.

### Vreau să resetez tot
Șterge `data/memorie.json` (memoria pe termen lung) sau doar `!reset` în joc (conversația recentă).

### Pot rula pe un VPS fără sunet?
Da, cu `TTS_ENABLED=false`. Vocea nu are unde să se audă; chatul funcționează normal.
