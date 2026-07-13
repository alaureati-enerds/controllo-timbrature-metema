# Piano — Motore di regole per il calcolo delle timbrature

> **Documento di lavoro, non una guida.** È il piano della feature in corso sul
> branch `feature/motore-regole-calcolo-timbrature`. A lavoro finito viene
> **sostituito** da `docs/calcolo-timbrature.md` (la guida definitiva) e
> cancellato.

---

## Contesto

Questo software sostituisce il vecchio gestionale Access
(`__reference/vecchio_programma.txt`). Confrontando le due logiche sui **dati
reali** (MySQL marcatempo `192.168.3.8:3309/arc_met`, 23 dipendenti attivi,
~2.150 giorni nel 2026) emerge che **nessuna delle due funziona**.

**I dati grezzi sono molto più sporchi del previsto.** Solo il 37% dei giorni è
una giornata "pulita" `EUEU`:

| Pattern | Giorni | % |
| --- | --- | --- |
| `EUEU` — giornata completa | 797 | 37% |
| `EU` — due sole timbrature (di cui **726 con span > 8h**) | 795 | 37% |
| `E` o `U` — timbratura singola | 287 | 13% |
| sequenze irregolari (`EEU`, `EUU`, `EUE`, …) | ~270 | 13% |

Più: **76 timbrature a `00:00`** (valore sentinella) e **102 coppie di timbri
doppi** dello stesso tipo entro 5 minuti.

Il punto centrale: le 726 giornate `EU` con span > 8h **non sono mezze
giornate**, sono **giornate piene in cui la pausa pranzo non è stata timbrata**.
Ed è un'abitudine personale, non casuale — FERRARI timbra la pausa nell'84% dei
giorni, VECCHIATTI nello **0%**, MAGNAPANE L. nell'1%.

### Cosa fa Access

Se un timbro manca lo sostituisce con l'orario standard
(07:30/12:30/14:00/17:00). Così le giornate `EU` tornano 8h. Ma lo fa in modo
**indiscriminato**, e qui sta il difetto fatale: BONI il 30/06 timbra `E 07:27`
+ `U 12:07` (mezza giornata), Access non trova Entrata2/Uscita2, le riempie con
14:00–17:00 e gli accredita **7h30 invece di 4h30**. Tre ore mai lavorate.

Inoltre:

- non elabora affatto i giorni con 1 o 3 timbrature (`WHERE to = 2 OR to = 4` →
  il 20% dei giorni), che restano grezzi e rotti;
- usa soglie fisse confrontate come **stringhe** (`"12"` per le entrate, `"16"`
  per le uscite): chi stacca alle 15:30 viene letto come uscita per il pranzo, e
  poi gli viene inventata l'uscita serale delle 17:00;
- con timbrature multiple nella stessa fascia i `LEFT JOIN` producono righe
  duplicate e vince l'ultima processata, non la prima/ultima in ordine di orario
  (non c'è nessun `MIN`/`MAX`);
- `For i = 1 To 1000` in `aggiornapresenzecalendario` è un tetto arbitrario: con
  23 dipendenti × 30 giorni = 690 righe ci sta, ma basta un dipendente in più
  perché i giorni oltre il millesimo restino silenziosamente non calcolati;
- a ogni ricalcolo **cancella le correzioni manuali** (`elipre`), da cui l'avviso
  «annullerà tutte le modifiche».

Sugli **arrotondamenti** invece Access e noi **coincidiamo già**: entrate al
quarto d'ora superiore, uscite all'inferiore
([lib/timbrature/arrotondamento.ts](../lib/timbrature/arrotondamento.ts)).

### Cosa facciamo noi

`assegnaTurni` ([lib/timbrature/giornate.ts](../lib/timbrature/giornate.ts))
richiede entrambi gli estremi di un turno per contare i minuti. Su una giornata
`EU` mette `entrata1=07:26` / `uscita2=17:01` e lascia i due turni monchi →
**totale 0h**. Su BONI succede 33 giorni su 67. Siamo onesti ma inutilizzabili:
l'admin dovrebbe correggere a mano un giorno su tre.

### La correzione

La distinzione che ad Access manca è una sola: **ricostruire la pausa pranzo solo
quando la giornata è "chiusa" ai due estremi** (c'è l'entrata mattutina *e*
l'uscita serale). Mai inventare l'entrata o l'uscita.

La regola è **auto-selettiva**: su chi timbra la pausa non scatta (i timbri ci
sono), su chi non la timbra scatta sempre. Per questo **non serve configurarla
per dipendente**. Simulata sul 2026:

| Esito | Giorni | % |
| --- | --- | --- |
| Completo dalle timbrature | 830 | 38,5% |
| **Pausa ricostruita (auto-fill sicuro)** | **858** | **39,8%** |
| Mezza giornata (nessun fill, corretto) | 54 | 2,5% |
| **Anomalia → revisione manuale** | **414** | **19,2%** |

L'**81% si risolve da solo**, il 30/06 di BONI resta giustamente a 4h30, e il
19% viene **segnalato** invece che silenziosamente falsificato.

**Esito voluto:** un motore di regole configurabile da GUI (globale, persistito
in DB) che produce totali utilizzabili senza inventare ore, e che **segnala** i
giorni da rivedere invece di nasconderli.

### Decisioni prese

1. **Pausa pranzo** → ricostruita con gli **orari standard** (12:30/14:00), come
   Access: la riga mostra 4 slot pieni, coerente con tabella e stampa.
2. **Anomalie** → **lasciate vuote e segnalate**. Nessun auto-fill di
   entrata/uscita: il giorno resta a 0h con un badge, filtrabile.
3. **Ambito regole** → **solo globali**, nel blob `SystemSetting` (niente
   override per dipendente: i dati non ne mostrano il bisogno).

---

## Implementazione

### 1. Schema delle regole (nessuna migrazione Prisma)

`SystemSetting.data` è un blob JSON con default zod: si aggiunge una chiave
`calcolo` **senza toccare il DB**.

In [lib/settings/schema.ts](../lib/settings/schema.ts), accanto a
`orarioLavoroSettingsSchema`, aggiungi `calcoloSettingsSchema` (+ `…InputSchema`
e i tipi `…Admin`, seguendo la stessa forma), e registra `calcolo` in
`systemSettingsSchema` con `.default({})`.

I default riproducono **il comportamento di oggi**, tranne dove indicato:

| Campo | Default | Nota |
| --- | --- | --- |
| `ignora0000` | `true` | scarta le 76 timbrature sentinella a `00:00` |
| `dedupMinuti` | `5` | unifica i timbri doppi dello stesso tipo (`0` = off) |
| `sogliaPomeriggio` | `"13:15"` | oggi è il midpoint calcolato di `primaUscita`/`secondoIngresso`: lo rendiamo esplicito |
| `strategiaUscita` | `"ultima"` | **cambia**: oggi prende la *prima* U, sbagliato su `EUU`/`EUEUU` |
| `granularitaMinuti` | `15` | |
| `versoEntrata` | `"su"` | |
| `versoUscita` | `"giu"` | |
| `pausaAutomatica` | `true` | **nuovo**: la regola centrale |
| `pausaSpanMinimo` | `360` | non ricostruire la pausa sotto le 6h di span |
| `minutiOrdinari` | `480` | oggi è la costante `MINUTI_ORDINARI` |
| `oreMassimeGiorno` | `720` | oltre → anomalia `durata_eccessiva` |

Nuovo `lib/settings/calcolo.ts`: copia esatta della forma di
[lib/settings/orario.ts](../lib/settings/orario.ts)
(`getCalcoloSettingsForAdmin` / `updateCalcoloSettings` su
`getSystemSettings`/`updateSystemSettings`).

### 2. Pipeline di calcolo

L'architettura attuale è già quella giusta e va **conservata**: `giornate.ts`
(MySQL → dato grezzo) → `calcolo.ts` (overlay correzioni + totali), con
[lib/timbrature/stampa/dati.ts](../lib/timbrature/stampa/dati.ts) e la pagina che
chiamano le **stesse** funzioni pure — così i numeri a schermo e quelli stampati
non possono divergere. Le correzioni restano un overlay in `timbratura_corretta`
(non distruttivo: già meglio di `elipre`).

**[lib/timbrature/giornate.ts](../lib/timbrature/giornate.ts)** — `assegnaTurni`
prende le regole come parametro:

- *pulizia* (nuova, prima del bucketing): scarta le `00:00` se `ignora0000`;
  collassa i timbri consecutivi dello stesso tipo entro `dedupMinuti` (tieni il
  primo per le E, l'ultimo per le U).
- *bucketing*: usa `sogliaPomeriggio` dalle regole al posto del midpoint
  calcolato; l'uscita di ogni finestra segue `strategiaUscita` (default: ultima).

**[lib/timbrature/arrotondamento.ts](../lib/timbrature/arrotondamento.ts)** —
generalizza `arrotonda` a `(ora, verso, granularita)` con `verso` che accetta
anche `"vicino"`. Le firme `arrotondaEntrata`/`arrotondaUscita` diventano
`(ora, regole)`.

**[lib/timbrature/calcolo.ts](../lib/timbrature/calcolo.ts)** — `calcolaCorretti`
prende `regole` + `orario` e guadagna due fasi, **nell'ordine**:

1. **Overlay** (invariato): `override` > dato grezzo arrotondato. La semantica di
   `corretto()` resta: `""` = azzerato esplicitamente, valore = corretto,
   `undefined` = nessuna correzione.

2. **Completamento** — solo se `pausaAutomatica`, e **solo** se:
   - `ce1 != null` **e** `cu2 != null` (giornata chiusa ai due estremi), **e**
   - span `cu2 - ce1` ≥ `pausaSpanMinimo`, **e**
   - lo slot da riempire **non** è stato azzerato a mano (`""` nell'override).

   Riempie i mancanti fra `cu1` (← `orario.primaUscita`) e `ce2`
   (← `orario.secondoIngresso`). Copre sia il caso `EU` (mancano entrambi) sia
   `EUU`/`EEU` (ne manca uno).

   **Guardia:** se la sequenza risultante non è monotòna
   (`ce1 < cu1 < ce2 < cu2`) il fill **non** scatta e il giorno va in anomalia —
   evita di ricostruire una pausa alle 12:30 per chi è entrato alle 15:00.

3. **Totali**: invariati, ma su `minutiOrdinari` dalle regole.

Ogni slot porta la sua **provenienza** — `"timbrata" | "corretta" |
"ricostruita" | "assente"` — così la UI può distinguere un timbro vero da uno
ricostruito. È la garanzia di onestà che ad Access manca.

**Anomalie**: nuovo campo `anomalie: Anomalia[]` in `GiornataCalcolata`,
calcolato **dopo** overlay e fill (una correzione manuale che sistema il giorno
lo fa sparire dalle anomalie, senza codice extra):

- `entrata_mancante` — ci sono timbrature ma nessuna E
- `uscita_mancante` — c'è un'entrata ma nessuna U che la chiuda
- `turno_incompleto` — dopo il fill un turno ha un solo estremo
- `timbratura_sospetta` — il giorno conteneva una `00:00`
- `durata_eccessiva` — totale > `oreMassimeGiorno`
- `assente` — giorno feriale senza alcuna timbratura (mai nel weekend: riusa
  `isWeekend`)

`MINUTI_ORDINARI` (costante esportata) sparisce: i chiamanti passano le regole.

### 3. API

Nuovo `app/api/admin/settings/calcolo/route.ts` (GET + PUT), **copia della
forma** di
[app/api/admin/settings/orario/route.ts](../app/api/admin/settings/orario/route.ts)
(`safeHandler`, `requireRole("admin")`, zod, `ok()`).

[app/api/admin/timbrature/route.ts](../app/api/admin/timbrature/route.ts) e
[lib/timbrature/stampa/dati.ts](../lib/timbrature/stampa/dati.ts) leggono le
regole via `getCalcoloSettingsForAdmin()` e le passano a
`getGiornate`/`calcolaCorretti`.

### 4. UI

**a) Card «Regole di calcolo»** in `/admin/settings`, sotto `OrarioSettingsForm`
(le regole dipendono dall'orario standard: stanno insieme). Nuovo
`components/admin/calcolo-settings-form.tsx`, modellato su
[components/admin/orario-settings-form.tsx](../components/admin/orario-settings-form.tsx).

Layout a **larghezza piena**, campi raggruppati con `FieldSet`/`FieldLegend` e
separati da `FieldSeparator` (per [CLAUDE.md](../CLAUDE.md) — niente lista
piatta): *Pulizia* · *Turni* · *Arrotondamento* · *Completamento* ·
*Straordinario*. Coppie brevi su `grid sm:grid-cols-2`. Submit in `CardFooter`
con `justify-end`, bottone con icona + `Spinner` durante il salvataggio.

**b) [components/admin/timbrature-manager.tsx](../components/admin/timbrature-manager.tsx)**
— tre aggiunte:

- **badge di anomalia** sulla riga (solo icona + `Tooltip` con l'etichetta,
  `aria-label`: niente bottoni con testo nelle righe di tabella);
- **contatore in testata** («N giorni da verificare») + toggle filtro «mostra
  solo i giorni con anomalie»;
- gli slot **ricostruiti** resi visivamente distinti (testo `muted` + `Tooltip`
  «ricostruita dall'orario standard»), così non si confondono con un timbro
  reale.

Rispetta il pattern mobile già in uso (tabella `hidden md:table` + lista di
`Card` `md:hidden`).

**c) Stampa PDF** —
[lib/timbrature/stampa/dati.ts](../lib/timbrature/stampa/dati.ts) riusa già
`calcolaCorretti`, quindi eredita fill e anomalie **senza modifiche**. In
[lib/timbrature/stampa/registro-classico.tsx](../lib/timbrature/stampa/registro-classico.tsx)
marca gli orari ricostruiti (es. corsivo) e stampa il conteggio delle anomalie a
piè di pagina, così il registro firmato dice la verità.

### 5. Documentazione

Nuovo `docs/calcolo-timbrature.md` (registrato nell'indice di
[CLAUDE.md](../CLAUDE.md)): la pipeline, ogni regola con il suo default e il
*perché*, come aggiungere una regola o un tipo di anomalia. Include la tabella
dei pattern reali qui sopra: è la giustificazione dei default. **Sostituisce
questo file**, che va cancellato.

---

## Verifica

1. **Test delle funzioni pure** — sono già pure e senza I/O: testare
   `calcolaCorretti` sui casi reali di BONI (giugno 2026), che coprono tutta la
   casistica:

   | Giorno | Timbrature | Atteso |
   | --- | --- | --- |
   | 03/06 | `E 07:29 U 12:32 E 14:02 U 17:00` | 7h45, nessun fill, nessuna anomalia |
   | 04/06 | `E 07:26 U 17:01` | **8h00**, `uscita1`/`entrata2` *ricostruite* |
   | 18/06 | `E 07:26 U 18:30` | **9h30** (1h30 straordinario), pausa ricostruita |
   | 30/06 | `E 07:27 U 12:07` | **4h30**, **nessun fill** (giornata non chiusa) |
   | 09/06 | `U 17:01` | 0h, anomalia `entrata_mancante` |
   | 05/06 | `E 00:00 U 17:12` | `00:00` scartata → `entrata_mancante` + `timbratura_sospetta` |
   | 23/06 | *(nessuna)* | 0h, anomalia `assente` (feriale) |
   | 06–07/06 | *(nessuna)* | 0h, **nessuna** anomalia (weekend) |

   Il **30/06 è il caso che deve restare a 4h30**: è la regressione che
   distingue questa logica da quella di Access.

2. **End-to-end sull'app** (`/admin/timbrature`, dipendente BONI, giugno 2026):
   il mese deve chiudere con totali sensati e il contatore anomalie ≈ 3 giorni,
   non ~33 righe a zero come oggi.

3. **Confronto di regressione su tutti i dipendenti**: script una tantum che
   ricalcola il 2026 e verifica la ripartizione attesa (~38,5% completi, ~39,8%
   ricostruiti, ~19,2% anomalie). Uno scostamento marcato indica un errore nel
   bucketing o nella guardia di monotonia.

4. **Stampa PDF** dello stesso mese: i totali devono coincidere **esattamente**
   con quelli a schermo (stessa pipeline pura → per costruzione, ma va verificato
   che le regole arrivino a entrambi i chiamanti).

5. **Giro sulle regole da GUI**: `pausaAutomatica` → OFF e ricarica: le giornate
   `EU` tornano a 0h. Rimetti ON. Cambia `granularitaMinuti` a 30 e verifica gli
   arrotondamenti.

---

## Fuori scopo (da valutare dopo)

- **Ferie / permessi / malattia.** Oggi un giorno feriale senza timbrature è
  indistinguibile da un'assenza giustificata: lo marchiamo `assente` e basta. Né
  Access né il nostro sistema hanno un registro delle assenze (la tabella
  `calendario` del vecchio DB è solo un elenco di date, senza festività).
- **Calendario delle festività.** Nessuna fonte disponibile: il 2 giugno oggi
  risulta `assente`.
- **Override delle regole per dipendente.** I dati 2026 non mostrano part-time né
  turnisti, e la regola della pausa è auto-selettiva. Se in futuro servisse:
  tabella `dipendente_regole` con un JSON parziale che fa merge sul globale.
