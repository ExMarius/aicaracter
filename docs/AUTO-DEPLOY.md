# Deploy automat pe server (plugin + Simple Voice Chat)

Pipeline-ul din `.github/workflows/deploy-server.yml` face totul singur, pe serverele GitHub (care au internet complet):

1. **compilează** pluginul Gicu pentru Paper 1.21.4;
2. **descarcă ultimul Simple Voice Chat** compatibil de pe Modrinth;
3. le **urcă pe server prin API-ul panoului** (fără SFTP, fără parolă);
4. **reporneste serverul** și **citește `logs/latest.log`** ca să confirme că pluginurile s-au încărcat.

Se declanșează:
- **automat** la fiecare push pe `main` care atinge `plugin/` sau scripturile de deploy,
- **manual** din Actions → „Deploy pe server" → *Run workflow* (cu opțiuni: restart da/nu, voice chat da/nu).

> De ce așa: din sandbox-ul meu nu pot trimite date către serverul tău. GitHub Actions poate. Deci „mâinile" sunt ale runner-ului, nu ale mele.

---

## Pasul 1 — Creează cheia API a panoului

1. Intră pe **https://freepanel.hidencloud.com**.
2. Sus dreapta → click pe numele tău → **Account Settings**.
3. Tab **API Credentials** → **Create Credential**.
4. Dă-i un nume („github-deploy") și apasă **Create**.
5. **Copiază cheia imediat** — se afișează o singură dată.

> Cheia arată ca `SHA256:...` și poate porni/opri serverul. Nu o pune în cod și nu o trimite pe chat.

## Pasul 2 — Adaugă secretul în GitHub (unul singur)

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Nume | Valoare |
|---|---|
| `PANEL_API_KEY` | cheia de la pasul 1 |

Atât. Restul sunt deja completate în workflow:

| Setare | Valoare implicită | Poți schimba cu |
|---|---|---|
| `PANEL_URL` | `https://freepanel.hidencloud.com` | o **Variable** cu același nume |
| `SERVER_ID` | `d496911d` | o **Variable** cu același nume |

> Nu mai e nevoie de SFTP: upload-ul se face prin API-ul Client (`files/write` pentru fișiere mici, upload multipart pentru cele mari).

## Pasul 3 — Rulează

Repo → **Actions** → **Deploy pe server (plugin + Simple Voice Chat)** → **Run workflow** → *Run workflow*.

Durează 1-3 minute. La final, în logul pasului „Urcă pluginurile și repornește" vei vedea:

```
🚀 Deploy prin API către serverul d496911d
· dist/Gicu.jar → /plugins/Gicu.jar (12 KB)
✓ urcat: /plugins/Gicu.jar
· dist/simple-voice-chat.jar → /plugins/simple-voice-chat.jar (2341 KB)
✓ urcat: /plugins/simple-voice-chat.jar
· starea înainte: running
· semnal de restart trimis, aștept să pornească...
✓ server: running
──── ultimele 25 de linii din logs/latest.log ────
[Gicu] GICU 0.1.0 pornit pe Paper 1.21.4
[voicechat] Starting voice chat server
──────────────────────────────────────────────────
✓ pluginul Gicu apare în log
✓ Simple Voice Chat apare în log
```

## Pasul 4 — Verifică în joc

În consola panoului:

```
plugins       →  Gicu, voicechat
gicu status   →  versiunea și jucătorii online
```

---

## Simple Voice Chat: ce trebuie să știi

- **Pluginul se instalează automat** prin pipeline.
- **Jucătorii au nevoie de modul de client** (Modrinth: *Simple Voice Chat*) ca să audă. Fără mod, nu aud nimic — așa funcționează SVC.
- **Portul de voce:** implicit SVC folosește **UDP 24454**. Pe panourile Pterodactyl alocarea ta e de obicei doar TCP. Dacă jucătorii nu se pot conecta la voce:
  1. deschide `plugins/voicechat/voicechat-server.properties` din File Manager,
  2. caută `port=24454`,
  3. pune portul serverului tău de Minecraft sau cere adminului o alocare UDP,
  4. restart.
- **Vocea lui Gicu** în SVC vine la faza 4 din `docs/PLAN-PLUGIN.md` (API-ul SVC). Până atunci SVC îți dă voice chat între jucători, iar Gicu vorbește în chat.

---

## Curățenie: un singur jar

Pipeline-ul urcă mereu ca `plugins/Gicu.jar` și `plugins/simple-voice-chat.jar` (fără versiune în nume), ca să nu se adune mai multe versiuni. **Dacă ai urcat manual** vreodată `Gicu-0.1.0.jar`, șterge-l din File Manager — altfel Paper încarcă pluginul de două ori.

---

## Cum oprești restartul automat

- Manual: la *Run workflow*, debifează **Repornește serverul după upload**.
- Permanent: șterge secretul `PANEL_API_KEY` — pipeline-ul va sări peste deploy și va scrie un avertisment în sumar.

---

## Dacă ceva nu merge

| Simptom | Cauză / fix |
|---|---|
| „Lipsește secretul PANEL_API_KEY — sar peste deploy" | nu ai adăugat secretul (pasul 2) |
| `Cheia API e respinsă (401)` | cheia e greșită sau a fost ștearsă; creează alta |
| `Cheia nu are voie la acest server (403)` sau `404` | `SERVER_ID` greșit (doar ID-ul scurt, ex. `d496911d`) |
| `Upload eșuat` la voice chat | fișierul e mare; îl urci manual din File Manager (2-3 MB) |
| Upload ok, dar pluginul nu apare | verifică `plugins/Gicu.jar` în File Manager; restartează din panou |
| „nu am putut citi logul" | normal imediat după restart; rulează din nou deploy-ul cu *restart* debifat |
| „Nu am putut descărca Simple Voice Chat" | Modrinth indisponibil temporar; rulează din nou sau debifează voice chat |

---

## Securitate

- Cheia API stă doar în **GitHub Secrets**. Nimic din repo nu conține chei.
- Dacă o cheie a fost lipită vreodată într-un chat, într-un `.yml` sau într-un screenshot: **șterge-o** din Account → API Credentials și creează alta. Durează 20 de secunde.
- Parola SFTP: nu mai e necesară pentru deploy. Dacă a fost expusă, schimb-o (vezi `docs/PTERODACTYL.md`).
