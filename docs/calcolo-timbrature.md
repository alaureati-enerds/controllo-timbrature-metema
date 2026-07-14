# Calcolo delle timbrature (motore di regole)

Come le timbrature grezze del marcatempo diventano ore lavorate: pulizia dei
dati, assegnazione dei turni, arrotondamenti, ricostruzione della pausa pranzo e
segnalazione dei giorni da rivedere. Tutto è governato da **regole configurabili
da GUI** (globali, persistite in DB), con default che riproducono il
comportamento storico dove ha senso e lo correggono dove serve.

## Perché un motore di regole

I dati del marcatempo sono più sporchi del previsto. Sul 2026 (23 dipendenti,
~2.150 giorni) solo il 37% delle giornate è un `EUEU` pulito:

| Pattern | % | Note |
| --- | --- | --- |
| `EUEU` — giornata completa | 37% | il caso «pulito» |
| `EU` — due sole timbrature | 37% | di cui la maggior parte a **giornata piena** con la **pausa non timbrata** |
| `E` / `U` — timbratura singola | 13% | mezze giornate o dati rotti |
| sequenze irregolari (`EEU`, `EUU`, …) | 13% | doppioni, dimenticanze |

Più: timbrature sentinella a `00:00` e coppie di timbri doppi dello stesso tipo
a pochi minuti di distanza.

Il nodo sono le giornate `EU` a span lungo: **non sono mezze giornate, è la pausa
pranzo non timbrata**, ed è un'abitudine personale (chi la timbra sempre, chi
mai). La regola centrale del motore risolve proprio questo: **ricostruisce la
pausa solo quando la giornata è chiusa ai due estremi**, senza mai inventare
l'entrata o l'uscita, e **segnala** (non falsifica) i giorni che restano
ambigui.

## La pipeline

Due metà pure (nessun React, nessun I/O), così i numeri **a schermo** e quelli
**stampati** non possono divergere — pagina e stampa chiamano le stesse funzioni.

1. **Grezzo → turni.** [`lib/timbrature/giornate.ts`](../lib/timbrature/giornate.ts)
   legge le presenze dal MySQL aziendale (sola lettura) e, per ogni giorno,
   chiama [`assegnaTurni`](../lib/timbrature/turni.ts) (modulo puro, estratto per
   essere testabile senza DB): pulizia dei grezzi → bucketing mattino/pomeriggio
   → assegnazione di `entrata1/uscita1/entrata2/uscita2`. Porta con sé due
   segnali grezzi (`nTimbrature`, `haSentinella0000`) che servono a valle.
2. **Turni → corretti.** [`lib/timbrature/calcolo.ts`](../lib/timbrature/calcolo.ts)
   con `calcolaCorretti(giornata, override, regole, orario)`: overlay delle
   correzioni manuali → completamento della pausa → totali e anomalie.

Le correzioni manuali dell'admin sono un **overlay non distruttivo** salvato in
`timbratura_corretta` (Prisma): un ricalcolo non le cancella mai.

> **Nota architetturale.** `calcolaCorretti` gira **anche nel browser** (la
> pagina ricalcola le righe a ogni render). Per questo `getGiornate` restituisce
> anche `regole` e `orario` nel payload: la pagina li passa a `calcolaCorretti`,
> la stampa (server) fa lo stesso. Le regole sono lette una volta lato server con
> `getCalcoloSettingsForAdmin()`.

## Le regole e i loro default

Configurabili in **Impostazioni → Regole di calcolo**
([`components/admin/calcolo-settings-form.tsx`](../components/admin/calcolo-settings-form.tsx)).
Persistite nella chiave `calcolo` del blob `SystemSetting` (nessuna migrazione);
i default di fallback sono in `CALCOLO_DEFAULTS`
([`lib/settings/schema.ts`](../lib/settings/schema.ts)).

| Regola | Default | Perché |
| --- | --- | --- |
| `ignora0000` | `true` | Le `00:00` sono un valore sentinella del marcatempo, non un orario reale: vanno scartate. |
| `dedupMinuti` | `5` | Collassa due timbri dello stesso tipo ravvicinati (tiene la **prima E**, l'**ultima U**). `0` = disattivato. |
| `sogliaPomeriggio` | `12:45` | Orario che separa il primo turno dal secondo. È il midpoint dell'orario standard configurato (12:00/13:30). |
| `strategiaUscita` | `ultima` | Con timbri multipli chiude il turno sull'**ultima** uscita, non la prima (corregge `EUU`/`EUEUU`). |
| `granularitaMinuti` | `15` | Passo di arrotondamento. |
| `versoEntrata` | `su` | Le entrate si arrotondano per eccesso (tradizione del gestionale). |
| `versoUscita` | `giu` | Le uscite si arrotondano per difetto. `vicino` = al più vicino. |
| `pausaAutomatica` | `true` | Attiva la ricostruzione della pausa (vedi sotto). La regola centrale. |
| `pausaSpanMinimo` | `360` | Sotto le 6h di span fra entrata e uscita la pausa **non** viene ricostruita (resta una mezza giornata). |
| `minutiOrdinari` | `480` | Oltre le 8h il tempo diventa straordinario. |
| `oreMassimeGiorno` | `720` | Oltre le 12h il giorno è segnalato `durata_eccessiva`. |

## La ricostruzione della pausa

`calcolaCorretti`, se `pausaAutomatica`, riempie gli slot interni mancanti
(`uscita1 ← orario.primaUscita`, `entrata2 ← orario.secondoIngresso`), ma **solo
se**:

- la giornata è **chiusa ai due estremi** (`ce1` **e** `cu2` presenti), **e**
- lo span `cu2 − ce1` ≥ `pausaSpanMinimo`, **e**
- lo slot da riempire non è stato azzerato a mano dall'admin.

In più una **guardia di monotonia**: la sequenza risultante deve essere
`ce1 < cu1 < ce2 < cu2`, altrimenti niente fill (non si ricostruisce una pausa
alle 12:30 per chi è entrato alle 15:00) e il giorno resta un'anomalia.

Copre sia `EU` (mancano entrambi gli slot interni) sia `EUU`/`EEU` (ne manca
uno). La regola è **auto-selettiva**: su chi timbra la pausa non scatta (i timbri
ci sono già), su chi non la timbra scatta sempre — per questo non serve
configurarla per dipendente.

## La provenienza degli slot

Ogni slot corretto porta la sua origine (`GiornataCalcolata.provenienza`):

- `timbrata` — dal dato reale del marcatempo (arrotondato);
- `corretta` — valore inserito a mano dall'admin;
- `ricostruita` — pausa dedotta dall'orario standard;
- `assente` — nessun valore.

È la garanzia di onestà del sistema: la pagina rende i valori `ricostruita` in
muted/corsivo con un tooltip, e la stampa PDF li mette in corsivo grigio. Nessun
orario dedotto si confonde con uno timbrato davvero.

## Le anomalie

Calcolate **dopo** overlay e fill (`GiornataCalcolata.anomalie`), così una
correzione manuale che sistema il giorno lo fa sparire dalle anomalie senza
codice extra. La pagina mostra un badge per riga, un contatore «N giorni da
verificare» e un filtro; la stampa ne riporta il conteggio.

| Anomalia | Quando |
| --- | --- |
| `entrata_mancante` | Ci sono timbrature ma nessuna entrata. |
| `uscita_mancante` | C'è un'entrata ma nessuna uscita che la chiuda. |
| `turno_incompleto` | Dopo il fill un turno ha un solo estremo. |
| `timbratura_sospetta` | Il giorno conteneva una sentinella `00:00`. |
| `durata_eccessiva` | Totale oltre `oreMassimeGiorno`. |
| `assente` | Giorno **feriale** senza alcuna timbratura (mai nel weekend). |

## Come estendere

- **Aggiungere una regola:** aggiungi il campo a `calcoloSettingsSchema` /
  `calcoloSettingsInputSchema` e a `CALCOLO_DEFAULTS`
  ([`lib/settings/schema.ts`](../lib/settings/schema.ts)), leggilo in
  `getCalcoloSettingsForAdmin` ([`lib/settings/calcolo.ts`](../lib/settings/calcolo.ts)),
  usalo nel motore (`turni.ts`/`calcolo.ts`) ed esponilo nel form. Nessuna
  migrazione: il blob è schemaless.
- **Aggiungere un'anomalia:** aggiungi il valore al tipo `Anomalia`, la
  condizione in `calcolaCorretti` (dopo overlay+fill) e l'etichetta in
  `ANOMALIA_LABEL` ([`components/admin/timbrature-manager.tsx`](../components/admin/timbrature-manager.tsx)).

## Test

Le funzioni pure sono coperte da
[`lib/timbrature/calcolo.test.ts`](../lib/timbrature/calcolo.test.ts) (`npm run
test`, vitest, nessun I/O) con i casi reali di BONI di giugno 2026. La
regressione chiave: il **30/06 (`E 07:27 U 12:07`) deve restare a 4h30** — la
giornata non è chiusa, quindi nessun fill. È ciò che distingue questo motore dal
vecchio Access, che riempiva indiscriminatamente e accreditava ore mai lavorate.

## Fuori scopo

- **Ferie / permessi / malattia.** Un giorno feriale senza timbrature è oggi
  indistinguibile da un'assenza giustificata: lo marchiamo `assente`.
- **Calendario delle festività.** Nessuna fonte disponibile: le festività
  infrasettimanali risultano `assente`.
- **Override delle regole per dipendente.** I dati 2026 non ne mostrano il
  bisogno (la regola della pausa è auto-selettiva). Se servisse: una tabella
  `dipendente_regole` con un JSON parziale in merge sul globale.
