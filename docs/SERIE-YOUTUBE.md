# Serial YouTube cu Gicu — ghid practic

## Premisa care funcționează

Publicul nu se uită la un AI care joacă Minecraft. Se uită la **un partener haotic care îl face pe creator să reacționeze**. Deci camera ta (vocea, râsul, enervarea) e jumătate din show, iar Gicu e cealaltă jumătate.

Formula care ține un episod de 15-25 de minute:

```
hook (10s) → promisiune clară („astăzi construim X") → încercări + eșecuri amuzante
→ moment de geniu neașteptat → dezastru → rezolvare improvizată → teaser pentru următorul
```

## Înainte de filmare (5 minute)

```bash
npm run doctor     # verifică voce, model, server
npm start          # pornește botul
```

1. Intră pe server, dă-i `!recap` — îți dă recapitularea episodului trecut, bună ca „previously on".
2. `!voce on` dacă vrei voce.
3. Testează o comandă scurtă („vino aici") ca să vezi că răspunde în 2-3 secunde.
4. Verifică în OBS că se aude (Desktop Audio).

## Setări OBS

- **Audio:** Desktop Audio ON (vocea iese pe difuzoane), microfon separat pe alt track.
- **Track-uri:** 1 = tot, 2 = microfon, 3 = joc + voce. Așa poți remixa la montaj.
- **Captură:** Game Capture pe Minecraft, 60 fps dacă poți.
- **Scene utile:** „joc", „joc + webcam mare" (pentru reacții), „full screen pe Gicu" (când face ceva amuzant).
- **Subtitrări:** ai transcriptul în `logs/transcript-*.txt` cu timestamp — lipește-l în CapCut/Premiere și folosește funcția de aliniere automată.

Sfat: lasă 1-2 secunde de liniște după fiecare replică a lui. Vocea lui are nevoie de spațiu ca să „respire" la montaj.

---

## 10 episoade gata de filmat

| # | Titlu | Ce faci | De ce merge |
|---|---|---|---|
| 1 | „I-am dat unui AI control asupra lumii mele" | Îi ceri o casă. Îl lași să greșească. Dormiți prima noapte împreună. | Prezintă personajul + promisiunea seriei |
| 2 | „Gicu construiește, eu dau note ca la MasterChef" | 3 construcții, tu jurizezi dur | Format repetabil, foarte citabil |
| 3 | „24 de ore, dar Gicu nu are voie să mintă" | Regulă impusă, el se străduiește | Tensiune comică constantă |
| 4 | „Îl pun să adune 64 de diamante. Eu îl sabotez" | Tu pui lavă, el încearcă | Conflict direct, natural |
| 5 | „Gicu explică redstone. Totul e greșit" | Cere explicații, verifică pe wiki | Umor din încredere falsă |
| 6 | „Ne mutăm în sat și candidăm la primar" | Interacțiuni cu villageri, construcții publice | Serialul se lărgește |
| 7 | „Speedrun la prima noapte, dar echipa e un AI" | Cronometru, obiective | Stres + timp limită = ritm |
| 8 | „Gicu are memoria unui serial TV" | `!recap`, referințe la episoadele trecute | Recompensează spectatorii fideli |
| 9 | „Ziua în care Gicu a distrus tot" | Lasă-l nesupravegheat 10 minute | Payoff după 8 episoade |
| 10 | „Îi dăm o misiune imposibilă" | Ceva greu (Nether, dragon) | Final de sezon |

---

## Comenzi care produc scene bune

**Eșecul e mai bun decât succesul.** Cere lucruri puțin peste nivelul lui:

```
„fă-mi o casă de 9"            → nu are destule blocuri → negociere amuzantă
„sapă până găsești diamant"    → drum lung, monștri, panică
„construiește un turn lângă râu" → locul e prost, încearcă oricum
„du-te și bate creeperul ăla"  → refuză sau moare
„explică-mi ce faci acum"       → justificări inventate
```

**Întrerupe-l.** Schimbarea planului la mijloc de acțiune e cea mai bună sursă de momente:

```
Tu: „fă un zid"
(el începe)
Tu: „nu, nu, fă un turn. acum."
→ se oprește, schimbă planul, comentează
```

**Folosește liniștea.** Dacă nu zici nimic 3 minute, îți propune el o prostie. Lasă-l.

---

## Momente de aur (nu le tăia)

- Prima dată când moare și comentează.
- Când un creeper apare exact când se laudă.
- Când găsește diamant și îl pierde.
- Când refuză politicos o sarcină proastă.
- Când zice „știu eu" și greșește complet.
- Când, din greșeală, face ceva chiar frumos.

Păstrează-le chiar dacă strică ritmul — sunt motivul pentru care oamenii dau share.

---

## Thumbnail & titluri

- **Titluri:** promisiune + conflict. „I-am dat control total unui AI" > „Minecraft cu AI #1".
- **Thumbnail:** fața ta șocată + personajul în fundal + text de 3-4 cuvinte („A DISTRUS TOT").
- **Serie:** pune numărul episodului în titlu de la #2 încolo; crește vizionarea în lanț.

## Descriere (template)

```
Astăzi l-am pus pe Gicu să [sarcina]. Nu a mers. A ieșit [rezultatul].

Gicu e un personaj AI care joacă Minecraft pe bune: sapă, construiește, greșește.
Făcut cu @aicaracter — link în comentariu.

00:00 Începutul
00:40 Prima sarcină
...

#minecraft #ai #romania
```

---

## Continuitate între episoade

La finalul fiecărui episod:

```
!retine casa noastră e la 120 64 -30 și e urâtă
!retine Marius a promis că îmi dă un diamant (nu a dat)
```

La începutul următorului: `!recap`. Refolosirea glumelor interne („porcul care nu era impresionat") creează sentimentul de serial, nu de clipuri separate.

Poți edita și direct `data/memorie.json` — adaugă fapte despre lume înainte de filmare.

---

## Etică și reguli YouTube

- **Declară că e AI.** YouTube cere etichetarea conținutului sintetic realist; aici e evident, dar o linie în descriere („personaj controlat de AI") e suficientă și te ferește de probleme.
- **Nu folosi vocea ca să imiți o persoană reală.** Vocea e una sintetică generică — ok. Clone vocale ale cuiva real = nu.
- **Fără înjurături grele / discurs de ură** — regulile din `persona/gicu.json` sunt deja conservatoare; nu le relaxa „pentru engagement".
- **Serverul tău, regulile tale** — dacă joci pe server public, întreabă administratorul înainte să bagi un bot.

---

## Ritm de producție sustenabil

- 1 episod / săptămână e suficient; consistența bate frecvența.
- Filmează 2 episoade în aceeași sesiune (lumile se schimbă, dar contexte diferite).
- Nu edita zile întregi: taie doar liniștea și repetițiile. Momentele „proaste" sunt conținut.
- Păstrează un fișier `idei.md` și lipește acolo fiecare `!idee` care ți-a plăcut.
