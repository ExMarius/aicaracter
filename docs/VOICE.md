# Vocea: cine îl aude și pe cine aude el

Adevărul, fără ocolișuri:

| | Azi (ce e construit) | Ce se poate |
|---|---|---|
| **Gicu vorbește** | da, voce românească | la fel |
| **Cine îl aude** | doar PC-ul care rulează botul (deci tu + înregistrarea OBS) | poți extinde la toți jucătorii (vezi mai jos) |
| **Ce aude el** | text din chat, de la orice jucător | voce reală, cu transcriere (STT) |
| **Folosește chestii** | da — 22 de acțiuni reale | la fel |

De ce: vocea se sintetizează și se redă pe difuzoanele calculatorului unde rulează Gicu. Serverul de Minecraft nu transportă audio — jocul vanilla nu are așa ceva. Nu e o limitare a proiectului, e o limitare a Minecraftului.

---

## Varianta 1 — Chat (merge acum, zero instalare)

Toți jucătorii văd ce spune, în chat. El primește comenzile de la toți (dacă pui `MC_ALLOW_ALL_PLAYERS=true`).

**Bun pentru:** serie solo, unde vocea se aude în înregistrare.
**Slab pentru:** prieteni în joc care vor să-l audă vorbind.

---

## Varianta 2 — Discord + cablu virtual (merge acum, fără mod)

Cea mai rapidă soluție dacă joci cu prietenii:

1. Instalezi un cablu audio virtual: **VB-Cable** (Windows) sau **BlackHole** (macOS).
2. În Windows: Settings → System → Sound → Output → alege `CABLE Input`.
3. În Discord: Settings → Voice → Input → `CABLE Output`.
4. Pornești Gicu (`start.bat`) — vocea lui merge acum în Discord, nu în difuzoane.
5. În Minecraft, folosești **Desktop Audio** în OBS pentru joc și microfonul normal pentru tine.

**Rezultat:** toți prietenii din canalul de Discord aud vocea lui Gicu, în timp real.
**Limitare:** nu e pozițional (nu se aude „din colțul camerei"), iar Gicu te aude tot prin chat.

---

## Varianta 3 — Simple Voice Chat (voice chat real în joc)

Asta e ce vrei de fapt când spui „să ne audă pe toți".

**Ce e:** [Simple Voice Chat](https://modrinth.com/plugin/simple-voice-chat) e modul standard de voce pozițională pentru Minecraft. Există versiune de server (plugin Bukkit/Paper și mod Fabric/Forge) și mod de client. Toți jucătorii care vor să audă au nevoie de modul instalat.

**Ce trebuie făcut ca Gicu să intre în el:**

1. Pe serverul Paper: instalezi pluginul Simple Voice Chat (un `.jar` în `plugins/`).
2. Prietenii instalează modul de client (o dată, 2 minute).
3. **Puntea audio** — partea care nu există încă și pe care trebuie s-o construim:
   - un mic plugin Paper care folosește **API-ul Simple Voice Chat** (`AudioPlayer` + `LocationalAudioChannel`) ca să redea sunet pozițional, exact din locul unde e Gicu;
   - în bot: TTS → mp3 → PCM → **Opus** (48 kHz, mono, cadre de 20 ms) → trimis pluginului prin WebSocket local;
   - pluginul îl redă tuturor jucătorilor din raza de voce, cu atenuare după distanță.

4. **Ca să te audă și el** (nu doar chat): jucătorii vorbesc în SVC → pluginul botului primește streamul audio → **STT** (Whisper API sau faster-whisper local) → text → creierul lui → răspuns. Latență realistă: 1-2 secunde.

**Cost:** Whisper API ~0.006 $/minut de voce (practic nimic pentru un episod). Local, gratis, dar consumă CPU.

**Efort:** plugin Java (~400 de linii) + pipeline Opus în Node + STT. Se poate face, dar e partea cea mai fragilă a proiectului (protocol audio binar, testare grea fără server real). De aceea n-am pus-o în prima versiune: voiam ceva ce merge garantat.

---

## Varianta 4 — OpenAudioMc (fără mod la clienți)

Plugin care trimite audio jucătorilor prin browser (client vanilla, fără mod). Avantaj: nimeni nu instalează nimic. Dezavantaj: ai nevoie de un endpoint web public, iar experiența e mai puțin „în joc".

---

## Comparație

| | Instalare la prieteni | Pozițional | Gicu te aude | Efort de făcut |
|---|---|---|---|---|
| 1. Chat | nimic | nu | text | **gata** |
| 2. Discord + cablu | nimic (doar Discord) | nu | text | **gata** (10 min de setat) |
| 3. Simple Voice Chat | mod de client | **da** | voce (STT) | de construit |
| 4. OpenAudioMc | nimic | parțial | text | mediu |

---

## Recomandarea mea

- **Filmezi solo?** Varianta 1 e suficientă — vocea intră în OBS, spectatorii o aud în video.
- **Joci cu prieteni acum?** Varianta 2, în 10 minute, fără să scriem cod.
- **Vrei voice chat real în joc?** Varianta 3. O construim, dar cu pași mici și cu testare pe serverul tău la fiecare pas.

Spune-mi care dintre ele și mă apuc. Dacă alegi 3, primul pas e pluginul + build automat prin GitHub Actions, ca să ai un `.jar` gata de urcat în `plugins/`.
