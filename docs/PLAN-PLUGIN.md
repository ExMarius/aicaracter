# Plan: Gicu ca plugin, fără VPS

> Răspuns scurt: **da, se poate**, și e chiar o idee bună pentru cazul tău. Dar pe serverul tău Paper se numește **plugin**, nu mod, și înseamnă o rescriere a părții „mâini" în Java.

## De ce plugin și nu mod

| | Mod (Fabric / NeoForge) | **Plugin (Paper)** |
|---|---|---|
| Se instalează pe serverul tău actual | nu — ar trebui să muți lumea pe Fabric | **da** |
| Ce pierzi | pluginurile Paper, dar câștigi acces total la joc | nimic |
| Cum faci un „jucător" | Carpet are deja `fake player` (nativ, curat) | trebuie pornit un client intern |

Serverul tău e **Paper 1.21.4**. Modurile nu se pot pune pe Paper. Deci varianta realistă e **plugin**.

## Cum funcționează (arhitectura)

```
┌─────────────────────── containerul tău de pe panel ───────────────────────┐
│                                                                           │
│   Paper 1.21.4  ──────────────────────────────┐                           │
│        ▲                                      │                           │
│        │ conexiune locală (127.0.0.1)         │  tick-uri, lume, chunk-uri │
│        │                                      ▼                           │
│   ┌────┴──────────────────────────────────────────────┐                   │
│   │  Plugin GICU (.jar)                               │                   │
│   │   ├─ client intern (MCProtocolLib) = „Gicu"       │                   │
│   │   ├─ creier: HTTP către API-ul LLM (Groq/OpenAI)  │                   │
│   │   ├─ unelte: mers, săpat, construit, luptă       │                   │
│   │   └─ voce: API-ul Simple Voice Chat (opțional)    │                   │
│   └───────────────────────────────────────────────────┘                   │
└───────────────────────────────────────────────────────────────────────────┘
        Sfârșit: niciun VPS, niciun PC pornit, un singur jar de urcat.
```

Ideea-cheie: pluginul **pornește un client Minecraft în interiorul aceleiași aplicații** (biblioteca MCProtocolLib) și se conectează la `127.0.0.1` — adică la serverul însuși. Serverul îl vede ca pe orice jucător. Totul rulează în containerul pe care deja plătești.

## Ce câștigi

- **Zero VPS, zero PC pornit.** Un `.jar` în `plugins/` și gata.
- **Voce pentru toți jucătorii** — API-ul Simple Voice Chat permite serverului să redea audio pozițional. Gicu te poate auzi și răspunde vocal, în joc, fără difuzoane locale.
- **Totul într-un loc**: un fișier de config, un restart.
- **Nu mai depinzi de PC-ul tău** când filmezi cu prietenii.

## Ce costă (onest)

1. **Rescrierea în Java** a creierului și a uneltelor (~1500 de linii de JS de portat). Nu imposibil, dar e muncă.
2. **Acțiunile vor fi inițial mai simple** decât pathfinding-ul din Node; le rafinăm pe parcurs.
3. **RAM în container**: +150-250 MB peste Paper. La 1 GB e strâmt; recomandat 2 GB pe serverul de Minecraft.
4. **Nu pot compila aici** (nu am Java în sandbox) — dar build-ul rulează automat pe GitHub Actions, deci primești jar-ul gata de urcat, iar eu citesc logurile și repar.
5. **Update-uri de Minecraft** = rebuild (la fel ca orice plugin).

## Fazele

| Fază | Ce livrez | Ce merge după |
|---|---|---|
| **0. Schelet** | proiect Gradle + `plugin.yml` + comandă `/gicu` + build automat pe GitHub Actions | jar-ul se încarcă pe server, apare în `plugins/` ✅ |
| **1. Client intern** | MCProtocolLib conectat la localhost, config cu nume/port | Gicu apare ca jucător real, fără VPS |
| **2. Creier** | HTTP către LLM + personalitatea din `persona/gicu.json` (portată în resurse) | vorbește în chat, răspunde la comenzi |
| **3. Unelte** | mers, urmărire, săpat, pus blocuri, craft, luptă | „fă-mi o casă", „taie lemne" |
| **4. Voce** | TTS → Opus → Simple Voice Chat API | **toți jucătorii îl aud** pozițional |
| **5. Ascultă** | STT pe vocea jucătorilor (Whisper) | vorbești cu el, nu scrii |

## Cum îl instalezi (după faza 0)

1. GitHub → **Actions** → ultima rulare „Build plugin" → descarci artefactul `Gicu-plugin` (conține `Gicu-0.1.0.jar`).
2. În panou: **File Manager** → `plugins/` → **Upload**.
3. **Restart** server.
4. În consolă: `plugins` (trebuie să apară `Gicu`) și `/gicu status`.

## Riscuri și plan de rezervă

- **Risc:** clientul intern în același proces cu serverul poate fi sensibil la lag dacă serverul e încărcat. *Mitigare:* pornire întârziată, reconectare, limită de tick.
- **Risc:** MCProtocolLib trebuie să știe protocolul 1.21.4. *Mitigare:* verificăm versiunea înainte de a începe faza 1.
- **Plan de rezervă:** varianta Node (ce funcționează azi) rămâne intactă în repo. Dacă pluginul nu ajunge la nivelul dorit, îl folosești pe VPS/panel și îl filmăm la fel.

## Alternativa „curată": Fabric + Carpet

Dacă ai accepta să muți lumea pe **Fabric**, modul **Carpet** are deja `fake player` nativ (`/player Gicu spawn`), iar un mod mic poate conduce acel jucător. E tehnic cea mai elegantă variantă, dar înseamnă server Fabric (fără pluginurile Paper) și un ecosistem diferit. Pentru situația ta — Paper deja funcțional — pluginul e drumul mai scurt.
