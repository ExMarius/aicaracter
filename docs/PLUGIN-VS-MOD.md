# Plugin, mod sau bot? Ghidul complet

Întrebarea e corectă, dar are un răspuns mai nuanțat decât „A sau B".

## Pe scurt

**Pentru scopul tău — un personaj AI care joacă Minecraft și face conținut pentru YouTube — cel mai bun raport e botul-jucător**, exact ce e în proiectul ăsta. Nu trebuie instalat nimic, merge pe orice server 1.21.4, iar AI-ul, vocea și memoria sunt nativ în Node.js.

Pluginul și modul nu sunt greșite — rezolvă alte probleme. Mai jos vezi exact care.

---

## Comparație pe criterii care contează pentru un serial

| Criteriu | Mod (Fabric / NeoForge) | Plugin (Paper / Spigot) | Bot-jucător (proiectul ăsta) |
|---|---|---|---|
| **Instalare la spectatori** | Modul trebuie pus în client | Nimic | Nimic |
| **Instalare la tine** | Mod + Fabric Loader | Acces la server (jar) | Doar `npm install` |
| **Merge pe servere găzduite (Aternos, PloudOS etc.)** | Nu | Uneori, dacă poți încărca jar | **Da, oriunde ai IP + port** |
| **Viteză de iterare (personalitate, glume)** | Recompilare Java | Recompilare Java | **Editezi un JSON** |
| **AI / LLM / memorie** | Posibil, dar dureros (JSON, fire de execuție, async) | La fel de dureros | **Nativ, cu `fetch`** |
| **Voce în video** | Greu (client-side, resurse) | Greu (trebuie să ajungă la difuzoare) | **Trivial: TTS local + Desktop Audio în OBS** |
| **Acțiuni reale în joc** | Da, cu acces complet | Da, dar multe cer NMS / packet hacking | **Da, prin protocolul de joc** |
| **Arată ca un jucător** | Da (dar ești tu) | NPC, de obicei fără animații corecte | **Da, cu skin, animații normale** |
| **Skin personalizat** | Da | Da | Doar skin de jucător (poți face un cont cu skin) |
| **Model 3D custom** | **Da** | Nu | Nu |
| **Animații faciale / lip-sync** | **Da** | Nu | Nu |
| **Anti-cheat** | Nu se aplică | Curat | Poate fi suspect (pathfinding) |
| **Ocupă un slot de jucător** | Nu | Nu | Da (1 slot din 20) |
| **Rulează când tu ești offline** | Nu | Da (e pe server) | **Da, dacă lași PC-ul deschis** |

---

## De ce botul câștigă pentru un serial

1. **Conținutul e despre comportament, nu despre grafică.** Ce face publicul unui serial Minecraft AI să râdă: replicile, greșelile, momentele neașteptate. Toate astea stau în prompt și în memorie — adică în JSON, nu în Java.
2. **Repetiție rapidă.** Vrei o glumă nouă? Editezi `persona/gicu.json` în 20 de secunde. La un mod, asta înseamnă 10 minute de compilat, la fiecare idee.
3. **Zero fricțiune pentru spectatori.** Nimeni nu trebuie să instaleze nimic. Serialele care cer moduri pierd jumătate din public.
4. **Vocea e cea mai mare armă.** Un text pe chat e amuzant; o voce ro-RO care spune „CREEPER! BĂ, CREEPER!" e aur. Botul redă vocea local, OBS o prinde cu un singur click.
5. **Funcționează cu orice server.** Propriu, prietenilor, găzduit ieftin, chiar și un Realm dacă folosești un proxy. Un plugin are nevoie de acces la server, un mod de client — botul doar de IP.

---

## Când ai nevoie de plugin

Treci la un plugin Paper 1.21.4 dacă:

- **Nu vrei să ocupe slot de jucător** (servere mici, 2-3 locuri).
- **Vrei ca personajul să fie mereu online**, chiar și când PC-ul tău e închis (rulează pe server 24/7).
- **Vrei NPC cu skin dedicat, nume colorat, prefix în tab list**, integrare cu chat-ul serverului, economie, quest-uri.
- **Ai nevoie de lucruri ce nu se pot face prin protocolul de client**: blocuri protejate, regiuni, permisiuni, evenimente custom.
- **Anti-cheat-ul e agresiv** și botul e dat afară.

Cum ar arăta: un jar mic care ține un NPC (packet-based) și expune un API HTTP/WebSocket local; creierul din proiectul ăsta rămâne neschimbat și doar „mâinile" se mută în Java. Asta e pasul 2 din roadmap.

## Când ai nevoie de mod

Treci la un mod Fabric/NeoForge 1.21.4 dacă:

- Vrei **model 3D propriu** (nu un jucător, ci o creatură).
- Vrei **animații faciale și lip-sync** cu vocea.
- Vrei **HUD custom**: imagini cu ce gândește personajul, emoții, subtitrări stilizate.
- Vrei **voce pozițională 3D** fără Simple Voice Chat.
- Vrei ca personajul să aibă fizică/animații imposibile pentru un jucător vanilla.

Costul: 3-6x mai mult cod, build pipeline Java, fiecare update de Minecraft strică tot, iar publicul trebuie să instaleze modul.

---

## Varianta hibridă (recomandarea pe termen lung)

```
   ┌──────────────────────────┐
   │  CREIER (Node.js)        │  ← personalitate, LLM, memorie, voce
   │  un singur loc           │
   └────────┬─────────────────┘
            │ WebSocket local
   ┌────────▼─────────────────┐
   │  CORP                    │
   │  a) bot-jucător (azi)    │  ← zero instalare
   │  b) plugin Paper (mâine) │  ← NPC pe server 24/7
   │  c) mod Fabric (poimâine)│  ← model 3D + lip-sync
   └──────────────────────────┘
```

Creierul rămâne același. Schimbi doar „corpul". De asta proiectul e structurat pe straturi: `src/ai` nu știe ce e mineflayer, iar `src/minecraft` nu știe ce e un LLM.

---

## Verdict

| Situația ta | Alege |
|---|---|
| Vrei să filmezi primul episod weekendul ăsta | **bot** (proiectul de față) |
| Vrei NPC permanent pe serverul comunității | plugin |
| Vrei personaj cu model 3D și lip-sync pentru un serial „de producție" | mod |
| Nu ești hotărât | **începe cu botul** — 90% din personalitate se scrie o singură dată și se refolosește în oricare variantă |
