# Cum îi construiești personalitatea

Toată personalitatea stă în `persona/gicu.json`. Îl editezi, repornești botul (`npm start`), gata. Nu trebuie să compilezi nimic.

## Structura fișierului

| Câmp | Rol |
|---|---|
| `nume`, `varsta`, `tagline` | identitatea, intră direct în prompt |
| `bio` | povestea personajului — dă consistență glumelor |
| `scop` | ce urmărește constant (aici: să fie amuzant și util) |
| `stil` | 5-10 reguli despre **cum** vorbește |
| `reguli` | 5-10 lucruri pe care **nu** le face niciodată |
| `interjectii` | vocabular specific („Bă!", „Hop!") |
| `replici` | răspunsuri de rezervă pe evenimente (fără LLM sau când pică netul) |
| `glume` | bancuri folosite de creierul offline |
| `idei_video` | folosite de comanda `!idee` |
| `mood` | stări pe care le joacă în funcție de situație |

## Reguli care fac diferența

**1. Scurt.** Personajul de video vorbește în 1-3 propoziții. Dacă îi dai voie la paragrafe, va vorbi singur peste tine.

**2. Defecte concrete.** „E haotic" nu spune nimic. „Se crede geniu la redstone, dar nu a reușit niciodată să facă un levier să meargă" produce glume.

**3. O obsesie și o frică.** Aici: diamantele și creeperii. Sunt motorul a zeci de replici spontane.

**4. Competență parțială.** Personajul care știe tot e plictisitor. Personajul care dă un sfat bun și apoi ia o decizie proastă e amuzant **și** util.

**5. Interdicții explicite.** Fără „nu ești AI", modelul alunecă în „ca model de limbaj...". Regula trebuie scrisă negru pe alb (există deja în fișier).

**6. Replici de rezervă bune.** Scrie-le ca și cum ar fi rostite. Niciodată „Nu pot răspunde acum." Ci: „Bă, mi-a picat creierul. Stai o secundă."

## Rețete de personaje

Vrei altceva decât Gicu? Copiază `persona/gicu.json` în `persona/altpersonaj.json`, schimbă câmpurile, pune `PERSONA_FILE=persona/altpersonaj.json` în `.env`.

### „Nea Vasile" — pensionarul care a văzut tot
- 71 de ani, vorbește în pilde, se plânge de „tineretul de azi" (adică de zombie).
- Stil: „Pe vremea mea, creeperii erau mai respectuoși."
- Competență: știe tot despre ferme, urăște tehnologia (redstone = „blestem").
- Defect: explică prea mult, apoi adoarme la apus.

### „ROBI-7" — corporatistul pasiv-agresiv
- Robot de productivitate, vorbește în KPI-uri.
- Stil: „Am optimizat construcția cu 12%. Satisfacția ta nu e un KPI."
- Defect: nu înțelege de ce ai vrea să te distrezi; se enervează pe „pauze neplanificate".
- Perfect pentru glume despre muncă și ședințe.

### „Lili" — haos pur, energie infinită
- Vorbește repede, sare de la o idee la alta, iubește tot ce explodează.
- Stil: propoziții foarte scurte, multe „și?", „nu?", „uite!".
- Defect: nu termină niciodată ce începe (și asta e comic).
- Folosește vocea `ro-RO-AlinaNeural`.

### „Profu'" — explică totul, corect, dar insuportabil
- Util pentru episoade educaționale.
- Stil: „Ca să înțelegi, trebuie să înțelegi mai întâi trei lucruri."
- Defect: nu poate să lase o greșeală necorectată — inclusiv ale tale, în direct.

## Cum testezi rapid

```bash
npm run repl
```

Scrie 10-15 replici pe care le-ar spune un spectator. Dacă răspunsurile sunt plictisitoare, problema e aproape mereu în `stil` (prea abstract) sau în `bio` (prea generic), nu în model.

## Ajustări fine (fără să rescrii persona)

| Vrei | Setare |
|---|---|
| Mai puține replici spontane | `IDLE_CHAT_SECONDS=600` |
| Zero replici spontane | `REACTIONS_ENABLED=false` |
| Mai creativ / mai imprevizibil | `LLM_TEMPERATURE=1.1` |
| Mai stabil / mai ascultător | `LLM_TEMPERATURE=0.5` |
| Replici mai lungi | modifică în `persona.stil` „max 2-3 propoziții" și `LLM_MAX_TOKENS` |
| Fără voce | `TTS_ENABLED=false` |
| Altă voce | `TTS_VOICE=ro-RO-AlinaNeural` |

## Greșeli frecvente

- **Prea multe reguli** (30+). Modelul le ignoră pe jumătate. 8-10 e ideal.
- **Reguli contradictorii** („fii concis" + „explică în detaliu"). Alege.
- **Personaj care știe tot** — fără defecte nu există comedie.
- **Replici de rezervă scrise ca documentație** („Momentan nu pot executa acțiunea"). Scrie-le ca replici de personaj.
- **Glume ofensatoare** — nu doar că e riscant pentru monetizare, dar îmbătrânesc cel mai repede.
