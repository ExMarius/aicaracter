# Deploy automat pe server (plugin + Simple Voice Chat)

Pipeline-ul din `.github/workflows/deploy-server.yml` face totul singur, pe serverele GitHub (care au internet complet):

1. **compilează** pluginul Gicu pentru Paper 1.21.4;
2. **descarcă ultimul Simple Voice Chat** compatibil de pe Modrinth;
3. le **urcă prin SFTP** în `plugins/`;
4. **reporneste serverul** prin API-ul panoului.

Se declanșează:
- **automat** la fiecare push pe `main` care atinge `plugin/` sau scripturile de deploy,
- **manual** din Actions → „Deploy pe server" → *Run workflow* (cu opțiuni: restart da/nu, voice chat da/nu).

> De ce așa: din sandbox-ul ăsta nu pot trimite date către serverul tău. GitHub Actions poate. Deci „mâinile" sunt ale runner-ului, nu ale mele.

---

## Pasul 1 — Creează cheia API a panoului

1. Intră pe **https://freepanel.hidencloud.com**.
2. Sus dreapta → click pe numele tău → **Account Settings**.
3. Tab **API Credentials** → **Create Credential**.
4. Dă-i un nume („github-deploy"), eventual o descriere, și apasă **Create**.
5. **Copiază cheia imediat** — se afișează o singură dată.

Această cheie poate porni/opri/re porni serverul. Nu o pune nicăieri în cod.

## Pasul 2 — Adaugă secretele în GitHub

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Nume | Valoare | De unde |
|---|---|---|
| `SFTP_HOST` | `jacob.hidencloud.com` | panoul tău, secțiunea SFTP |
| `SFTP_PORT` | `2022` | la fel |
| `SFTP_USER` | `mariusuke-184939.d496911d` | la fel |
| `SFTP_PASS` | parola SFTP | la fel |
| `PANEL_URL` | `https://freepanel.hidencloud.com` | panoul |
| `SERVER_ID` | `d496911d` | panoul tău |
| `PANEL_API_KEY` | cheia de la pasul 1 | Account → API Credentials |

Ultimele trei sunt **opționale**: fără ele pipeline-ul urcă fișierele, dar nu poate da restart (îl dai tu din panou).

## Pasul 3 — Rulează

Repo → **Actions** → **Deploy pe server (plugin + Simple Voice Chat)** → **Run workflow** → *Run workflow*.

Durează 1-2 minute. La final vezi în sumar ce s-a urcat. În consola panoului ar trebui să apară:

```
[Gicu] GICU 0.1.0 pornit pe Paper 1.21.4
[voicechat] Starting voice chat server
```

## Pasul 4 — Verifică

În consola serverului:

```
plugins          →  Gicu, voicechat
gicu status      →  versiunea și jucătorii online
```

---

## Simple Voice Chat: ce trebuie să știi

- **Pluginul se instalează automat** prin pipeline. Bun.
- **Jucătorii au nevoie de modul de client** (Modrinth: *Simple Voice Chat*) ca să audă. Fără mod, nu aud nimic — așa funcționează SVC.
- **Portul de voce:** implicit SVC folosește **UDP 24454**. Pe panourile Pterodactyl, alocarea ta e de obicei pe alt port și doar TCP. Dacă jucătorii nu se pot conecta la voce:
  1. deschide `plugins/voicechat/voicechat-server.properties` din File Manager,
  2. caută `port=24454`,
  3. pune portul serverului tău de Minecraft sau cere adminului o alocare UDP,
  4. restart.
- **Vocea lui Gicu** în SVC vine în faza 4 din `docs/PLAN-PLUGIN.md` (API-ul SVC). Până atunci, SVC îți dă voice chat între jucători, iar Gicu vorbește în chat.

---

## Curățenie: un singur jar

Pipeline-ul urcă mereu ca `plugins/Gicu.jar` și `plugins/simple-voice-chat.jar` (fără versiune în nume), ca să nu se adune mai multe versiuni. **Dacă ai urcat manual** vreodată `Gicu-0.1.0.jar`, șterge-l din File Manager — altfel Paper încarcă pluginul de două ori și dă erori.

---

## Cum oprești restartul automat

- Manual: la *Run workflow*, debifează **Repornește serverul după upload**.
- Permanent: șterge secretul `PANEL_API_KEY` — pipeline-ul va sări peste restart și va scrie un avertisment în sumar.

---

## Dacă ceva nu merge

| Simptom | Cauză / fix |
|---|---|
| „Secretele SFTP lipsesc — sar peste deploy" | nu ai adăugat secretele (pasul 2) |
| `Conexiune SFTP eșuată: All configured authentication methods failed` | `SFTP_USER` sau `SFTP_PASS` greșite |
| `Cheia API e respinsă (401)` | `PANEL_API_KEY` greșită sau ștearsă; recreează |
| `Serverul nu există sau cheia nu are acces (404)` | `SERVER_ID` greșit (trebuie doar ID-ul scurt, ex. `d496911d`) |
| Upload ok, dar pluginul nu apare | verifică `plugins/Gicu.jar` în File Manager; restartează din panou |
| „Nu am putut descărca Simple Voice Chat" | Modrinth indisponibil temporar; rulează din nou sau debifează voice chat |

---

## Securitate

- Toate parolele stau în **GitHub Secrets**, nu în fișiere. Nimic din repo nu conține chei.
- Cheia API a panoului poate opri serverul — dacă bănuiești că a fost expusă, șterge-o din Account → API Credentials și creează alta.
- Parola SFTP veche: dacă a fost scrisă vreodată într-un `.yml` public, schimb-o (vezi secțiunea de securitate din `docs/PTERODACTYL.md`).
