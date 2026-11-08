# GHID RAPID — pentru cine nu vrea să audă de cod

## 1. Ce este, de fapt, ce ai primit?

Imaginează-ți un **prieten care intră pe serverul tău de Minecraft și joacă alături de tine**. Doar că prietenul ăsta nu e un om: e un program care vorbește, sapă, construiește și comentează tot ce se întâmplă.

Când intră pe server, îl vezi ca pe orice alt jucător: are nume, are skin, apare în lista de jucători, scrie în chat. Serverul nu știe (și nici nu-l interesează) că în spate e un program.

**Nu e plugin. Nu e mod.** Nu pui nimic în folderul `mods` și nimic în folderul `plugins`. Nu modifici Minecraftul deloc.

| | Ce modifică | Trebuie instalat ceva? |
|---|---|---|
| **Mod** | fișierele jocului tău | da, la fiecare jucător |
| **Plugin** | serverul (un fișier `.jar` în folderul serverului) | da, pe server |
| **Ce ai primit tu** | **nimic** — e un program separat care se conectează ca jucător | **nu, nimic** |

E ca diferența dintre „modifici motorul mașinii" (mod), „modifici drumul" (plugin) și „angajezi un șofer care vine cu mașina lui" (bot). Al treilea nu strică nimic din ce ai.

## 2. Ce ar trebui să vezi pe ecran

Pornești programul, iar în fereastra neagră apare:

```
» Conectare la localhost:25565 ca "Gicu" (1.21.4, auth: offline)...
✓ Sunt în joc. Scrie-mi în chat ce vrei să fac.
GICU Bă! Bine ai venit în lumea mea. E cam goală, e cam întunecată, dar e a mea.
```

În Minecraft, un jucător numit **Gicu** apare lângă tine și începe să vorbească.

## 3. Pornire, pas cu pas (Windows)

### Pasul 1 — instalează Node.js
Intră pe **https://nodejs.org** și apasă butonul verde **LTS**. Next, Next, Finish. (E ca atunci când instalezi orice program.)

### Pasul 2 — pornește serverul de Minecraft 1.21.4
Trebuie să ai un server pornit. Cel mai simplu: joci pe un server de-al tău (poți descărca un server de pe minecraft.net) sau pe un server unde ai voie să intre boți.

> Dacă serverul e pe același PC cu jocul tău, adresa e `localhost`.
> Dacă e găzduit (Aternos etc.), adresa e cea pe care o primești de la ei.

### Pasul 3 — dublu-click pe **`start.bat`**
Se deschide o fereastră neagră care:
1. își instalează singură componentele (prima dată, 1-2 minute),
2. deschide Notepad cu un fișier de setări și îți spune ce să completezi.

Completează doar 3 rânduri:

```env
MC_HOST=localhost          ← adresa serverului
MC_OWNER=NumeleTau         ← numele tău exact din Minecraft
LLM_API_KEY=...            ← cheia de la AI (pasul 4)
```

Salvezi cu `Ctrl+S`, închizi Notepad, apeși o tastă în fereastra neagră. Gata.

### Pasul 4 — de unde iei „cheia AI"
AI-ul care gândește replicile are nevoie de un creier. Ai 3 variante:

- **Gratis (recomandat pentru început):** intri pe **https://console.groq.com**, îți faci cont (10 secunde, cu Google), apeși „API Keys" → „Create Key", copiezi cheia care începe cu `gsk_...`. În `.env`:
  ```env
  LLM_BASE_URL=https://api.groq.com/openai/v1
  LLM_MODEL=llama-3.3-70b-versatile
  LLM_API_KEY=gsk_cheia_ta
  ```
- **Local, fără internet:** instalezi [Ollama](https://ollama.com), rulezi `ollama pull qwen2.5:7b`, apoi în `.env` pui `LLM_BASE_URL=http://localhost:11434/v1`, `LLM_MODEL=qwen2.5:7b`, `LLM_API_KEY=ollama`.
- **Fără cheie deloc:** nu completezi nimic. Gicu tot merge, dar cu răspunsuri simple, din reguli („creierul de rezervă"). Bun pentru teste.

## 4. Cum vorbești cu el

Intri pe server și scrii în chat, pur și simplu:

```
tu:   Gicu, vino aici
Gicu: Vin, vin! Nu pleca, că mă pierd și după aia trei zile te caut.

tu:   taie 10 lemne
Gicu: Mă duc după 10 bucăți de lemn. Dacă mă întorc cu 11, e bonus.
      [se duce și taie]

tu:   fă-mi o casă
Gicu: Arhitectul a sosit! Am un plan. Planul e bun. Nu e bun, dar hai să vedem.

tu:   !stop
Gicu: Gata, m-am oprit. Stau ca un stan de piatră. Frumos stan.
```

Comenzi rapide: `!stop`, `!status`, `!voce on` / `!voce off`, `!idee`, `!recap`, `!ajutor`.

## 5. Ce face toate fișierele alea?

Nu trebuie să le atingi, dar ca să știi ce e acolo:

| Fișier / folder | Ce e, pe românește |
|---|---|
| `start.bat` | butonul tău de pornire (dublu-click) |
| `verifica.bat` | butonul care îți spune ce lipsește dacă nu merge |
| `.env` | foaia de setări (server, numele tău, cheia AI) |
| `persona/gicu.json` | **personalitatea** — aici schimbi cum vorbește, glumele, numele |
| `src/` | codul propriu-zis (creierul, mâinile, vocea) |
| `docs/` | ghiduri |
| `logs/` | toate replicile scrise, cu ora — bune pentru subtitrări |

## 6. Dacă nu merge

Dublu-click pe **`verifica.bat`**. Îți scrie în clar, cu bifă verde sau roșie:

```
✓ Node.js            v22.22.3
✗ Server Minecraft   localhost:25565 — ECONNREFUSED (serverul e pornit?)
✗ Creier (LLM)       fără cheie API — pune LLM_API_KEY în .env
✓ Player audio       powershell
```

Rezolvi ce e roșu, rulezi din nou. Restul detaliilor: `docs/TROUBLESHOOTING.md`.

## 7. Pentru filmare

- Fereastra neagră trebuie să rămână deschisă cât joci — ea este „jucătorul".
- Vocea se aude pe calculatorul tău, deci în OBS trebuie doar să ai **Desktop Audio** pornit.
- Toate replicile se salvează în `logs/transcript-AAAA-LL-ZZ.txt` — le poți folosi ca subtitrări.

Ghidul complet de serial (10 episoade, idei, hook-uri): `docs/SERIE-YOUTUBE.md`.
