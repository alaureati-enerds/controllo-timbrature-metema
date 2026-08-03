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
   con `calcolaCorretti(giornata, override, regole, orario, rapportino)`:
   [overlay a tre livelli](#lorario-dei-giorni-con-rapportino) (correzione
   manuale → rapportino → marcatempo) → completamento della pausa → totali e
   anomalie.

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
| `ancoraRapportinoAlleTimbrature` | `true` | Sui giorni con rapportino spalma le ore dichiarate sugli **orari davvero timbrati** invece che sull'orario standard (vedi sotto). Disattivo = comportamento storico. |
| `sogliaScostamentoRapportino` | `60` | Oltre questa differenza (minuti) fra ore da timbratura e ore da rapportino, il giorno è segnalato `scostamento_rapportino`. `0` = disattivato. Calibrato sui dati reali: sui giorni "puliti" il 93% degli scostamenti sta entro 30', il 97% entro 60' — oltre inizia la coda degli errori veri (solo l'1.3% supera i 120'). |

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

## L'orario dei giorni con rapportino

I tecnici in assistenza compilano un **rapportino** (tabella `cmd` del MySQL
aziendale, letta da [`lib/mysql/rapportini.ts`](../lib/mysql/rapportini.ts) e
sommata per giorno da [`lib/rapportini/calcolo.ts`](../lib/rapportini/calcolo.ts)).
Quando un giorno ha un rapportino con **ore > 0**, quelle ore sono la verità del
giorno: il marcatempo di chi gira fra i cantieri è inaffidabile per definizione.

### L'overlay a tre livelli

`calcolaCorretti` risolve ogni slot **indipendentemente dagli altri**, in
quest'ordine:

1. **correzione manuale** (`override`) — l'admin ha scritto un orario: vince
   sempre, è l'unica fonte umana;
2. **rapportino** — orario ricostruito dalle ore dichiarate (lavoro + viaggio);
3. **marcatempo** — il timbro reale arrotondato.

Essendo slot per slot, l'admin può correggere la sola entrata e lasciare gli
altri tre al rapportino. Sopra tutto sta il
[giustificativo di assenza](#i-giustificativi-di-assenza), che azzera la
giornata prima ancora di guardare le fonti.

Un rapportino **con zero ore** (es. solo spese) non spiega nulla: il giorno
ricade sul marcatempo come se non esistesse. Il rapportino **spiega** il giorno,
quindi silenzia le anomalie del grezzo (`assente`, `timbratura_sospetta`).

Le **ore** (`totale`/`ordinario`/`straordinario`) vengono dalle ore dichiarate,
non dagli orari ricostruiti — con una sola eccezione: appena l'admin corregge un
orario a mano, il totale torna a derivare dagli orari (altrimenti la correzione
sposterebbe l'orario mostrato senza mai muovere le ore). Il prezzo è perdere la
distinzione lavoro/viaggio su quel giorno: l'admin ha scritto un orario, non
delle ore di viaggio.

### L'ancoraggio alle timbrature

Il rapportino dice **quante** ore, non **quando**. Storicamente il motore
riempiva l'orario standard dal primo ingresso (`costruisciOrario`): funziona
solo per chi quell'orario lo segue davvero. Su un tecnico che entra alle 06:37
ed esce alle 17:14 il registro mostrava `07:30–18:00`, cioè **un'uscita dopo
l'ultimo timbro**: una giornata mai esistita.

Con `ancoraRapportinoAlleTimbrature` (default) le ore si spalmano invece sugli
orari **davvero timbrati** (`costruisciOrarioAncorato`). Le ancore sono la
prima entrata e l'ultima uscita, arrotondate **con le stesse regole** degli slot
`timbrata`: l'orario corretto è quindi *letteralmente* il valore che la colonna
del marcatempo mostra, senza una seconda convenzione. Quattro casi:

| Caso | Condizione | Cosa fa |
| --- | --- | --- |
| **A** | Entrambe le ancore e le ore ci stanno | La differenza fra span timbrato e ore dichiarate **è la pausa pranzo**: entrata e uscita restano quelle vere. La pausa parte dall'uscita di mezzogiorno realmente timbrata, se c'è, altrimenti da `primaUscita`. |
| **C** | Regge l'uscita **serale** | Si riempie **all'indietro**: pomeriggio da `secondoIngresso` fino al timbro, il resto in coda al mattino. |
| **B** | Regge l'entrata | Si riempie **in avanti** dal timbro: mattino fino alla pausa, il resto dal `secondoIngresso`. |
| **D** | Nessuna timbratura | Niente a cui ancorarsi: `costruisciOrario` e orario standard, come prima. |

Il totale ricostruito è **sempre** uguale alle ore del rapportino, in ogni ramo:
cambia la giornata rappresentata, mai le ore. Sui dati reali di giugno-luglio
2026 la modifica ha cambiato l'orario di 172 giorni su 320 senza spostare di un
minuto un solo totale mensile.

**Perché la pausa assorbe la differenza (caso A).** Non è un residuo di calcolo:
sui 177 giorni con entrambi gli estremi timbrati sta fra 0 e 120 minuti nel
**98,9% dei casi**, con mediana 75'. È una pausa pranzo vera. Sui giorni in cui
i tecnici timbrano tutti e quattro i colpi, l'uscita di mezzogiorno è alle ~12:31
e il rientro alle ~13:53: ancorare l'**inizio** della pausa è la scelta più
aderente ai dati, e lascia tre slot su quattro uguali al timbro reale.

**Perché quando le ore non entrano regge l'uscita (caso C).** Mostrare ore
**dopo** l'ultimo timbro è esattamente il difetto da correggere, mentre chi ha
lavorato prima di timbrare è plausibile: il timbro del mattino dimenticato è il
caso reale più frequente. Un'uscita di **mezzogiorno** però non è la fine della
giornata — lì regge l'entrata, altrimenti 8h ancorate a un'uscita delle 12:00
farebbero cominciare la giornata alle 04:00. Il giorno resta comunque segnalato
da `scostamento_rapportino`.

**Guardie.** Se le ore riempiono esattamente lo span, o se la giornata non
attraversa la fascia della pausa (es. tutta di pomeriggio), si usa un **turno
unico**: è l'unico ramo in cui una delle due ancore cede. Se riempire
all'indietro porterebbe l'entrata prima di mezzanotte (rapportini abnormi) si
rinuncia all'ancora: meglio l'orario standard di un orario all'indietro.

## La provenienza degli slot

Ogni slot corretto porta la sua origine (`GiornataCalcolata.provenienza`):

- `timbrata` — dal dato reale del marcatempo (arrotondato). Include gli slot
  **ancorati** di un giorno con rapportino: se il valore mostrato coincide con
  il timbro arrotondato, quel valore *è* il timbro, e chiamarlo altrimenti
  sarebbe una bugia;
- `corretta` — valore inserito a mano dall'admin;
- `ricostruita` — pausa dedotta dall'orario standard;
- `rapportino` — slot [ricostruito dalle ore del rapportino](#lorario-dei-giorni-con-rapportino)
  e non riconducibile a un timbro (tipicamente fine mattino e rientro);
- `assente` — nessun valore (anche su una giornata coperta da un
  [giustificativo di assenza](#i-giustificativi-di-assenza): tutti e quattro
  gli slot sono vuoti per definizione).

La provenienza è oggi **informativa**: nessun consumatore la legge — né la
tabella né i template PDF, che mostrano gli orari senza distinguere da dove
vengono.

La **tabella della pagina Timbrature** non distingue le provenienze:
le quattro colonne corrette sono tutte blu e tutte cliccabili allo stesso modo
(scelta deliberata, per non trasformare la griglia in un codice a colori da
decifrare). La colonna dei dati grezzi, lì accanto, resta il riferimento: se un
orario compare fra i corretti ma non fra i grezzi, è dedotto.

## Le anomalie

Calcolate **dopo** overlay e fill (`GiornataCalcolata.anomalie`). La pagina mostra
un badge per riga, tinge la riga di rosso tenue e offre il filtro «Da verificare»
(col conteggio) nell'header della tabella. La stampa non elenca le anomalie.

| Anomalia | Quando | Origine |
| --- | --- | --- |
| `entrata_mancante` | Ci sono timbrature ma nessuna entrata. | corretti |
| `uscita_mancante` | C'è un'entrata ma nessuna uscita che la chiuda. | corretti |
| `turno_incompleto` | Dopo il fill un turno ha un solo estremo. | corretti |
| `durata_eccessiva` | Totale oltre `oreMassimeGiorno`. | corretti |
| `timbratura_sospetta` | Il giorno conteneva una sentinella `00:00`. | **grezzo** |
| `assente` | Giorno **feriale e già trascorso** senza alcuna timbratura (mai nel weekend, mai da oggi in avanti). | **grezzo** |
| `rapportino_mancante` | Dipendente soggetto all'obbligo (impostazioni di sistema), giorno feriale già trascorso, nessun rapportino registrato — può comparire insieme ad `assente`. | **UI** |
| `scostamento_rapportino` | Giorno determinabile automaticamente (nessuna correzione manuale, nessuna anomalia calcolata dal solo marcatempo) con rapportino attivo, e differenza fra i due totali oltre `sogliaScostamentoRapportino`. | **UI** |

**Nessuna anomalia compare su una giornata coperta da un
[giustificativo di assenza](#i-giustificativi-di-assenza)**: il motore esce
prima di calcolarle, e le due anomalie unite in UI hanno la stessa guardia.

**`rapportino_mancante` e `scostamento_rapportino` sono un'eccezione: non
nascono in `calcolaCorretti`.** Le altre sei sono calcolate dentro il motore
puro, che lavora solo su orari. Queste due dipendono da dati esterni al
motore — quali dipendenti sono soggetti all'obbligo di rapportino
(`lib/rapportini/richiesti.ts`, configurabile in Impostazioni di sistema) o il
contenuto stesso del rapportino — quindi le condizioni vivono come funzioni
pure in [`lib/rapportini/calcolo.ts`](../lib/rapportini/calcolo.ts)
(`mancaRapportinoObbligatorio`, `scostamentoRapportinoEccessivo`) e si
uniscono all'array `anomalie` in `timbrature-manager.tsx`, nello stesso punto
in cui si costruiscono le righe della tabella. Da lì in poi badge, tinta riga,
tab «Da verificare» e Sheet di dettaglio le trattano come una qualunque altra
anomalia, perché leggono tutti lo stesso array. Non essendo calcolate da
`calcolaCorretti`, oggi non sono nella stampa (che non elenca comunque le
anomalie).

**`rapportino_mancante` può comparire insieme ad `assente`.** Le due
anomalie rispondono a domande diverse — «manca la timbratura» e «manca il
rapportino» — e su un giorno senza nessuno dei due è corretto mostrarle
entrambe: lascia a chi rivede la decisione se aggiungere la presenza a mano
o sollecitare il rapportino al tecnico. `mancaRapportinoObbligatorio` non
guarda l'anomalia `assente`.

**`scostamento_rapportino` confronta due grandezze diverse per natura, non
solo per rumore.** Il marcatempo misura la presenza fisica badge-in/badge-out
(arrotondata secondo le regole sopra); il rapportino misura ore di
lavoro+viaggio autodichiarate dal tecnico, spesso arrotondate a mano in blocchi
più larghi. Un confronto senza tolleranza avrebbe segnalato quasi ogni giorno
con rapportino attivo — puro rumore, non segnale. Un'analisi sui dati reali
(32 dipendenti, 13 mesi) ha mostrato che sui giorni "puliti" il match è invece
stretto (93% entro 30', 97% entro 60'), con un salto netto verso una coda di
pochi errori veri (1.3% oltre 120', fino a scostamenti di intere ore): da qui
il default di `sogliaScostamentoRapportino` a 60 minuti. Il confronto si
calcola chiamando una **seconda volta** `calcolaCorretti` con `override` e
`rapportino` entrambi `undefined`: è l'unico modo di ottenere il totale
marcatempo "puro", perché quando un rapportino è attivo esso **sostituisce**
(non affianca) il totale nel calcolo normale della riga (vedi
[L'overlay a tre livelli](#lorario-dei-giorni-con-rapportino)). Non risente
dell'ancoraggio, che cambia gli orari mostrati ma non le ore: il confronto resta
fra le stesse due grandezze di prima. L'anomalia scatta solo se quel calcolo puro non ha già
anomalie proprie (`entrata_mancante`, `uscita_mancante`, `turno_incompleto`,
`timbratura_sospetta`, `durata_eccessiva`, `assente`) e il giorno non ha una
correzione manuale: è la lettura di "timbrature corrette determinabili
automaticamente".

**Un'anomalia si spegne quando l'admin sistema il giorno.** È il principio: il
badge dice «da rivedere», quindi una volta rivisto deve sparire. Le anomalie di
origine *corretti* si spengono da sole, perché rileggono `ce1…cu2` dopo la
correzione. Quelle di origine *grezzo* guardano il dato del marcatempo, che una
correzione non tocca: per queste il motore controlla esplicitamente se esiste una
correzione manuale sul giorno (`override` non vuoto) e in quel caso non le
segnala.

In pratica: su un giorno con timbratura a `00:00`, appena assegni un preset o
correggi un orario, il badge «timbratura sospetta» sparisce.

**`assente` non guarda solo il weekend, anche il calendario.** `calcolaCorretti`
riceve un parametro `oggi` (default: la data odierna reale, `YYYY-MM-DD`) e
segnala `assente` solo se `giorno < oggi`: un giorno futuro — oggi compreso,
la giornata potrebbe non essere ancora conclusa — non è "assente", è solo non
ancora accaduto. Guardando il mese corrente a metà mese, i giorni successivi
non hanno né badge né icona di stato (stesso trattamento riservato ai
weekend, in `timbrature-manager.tsx`).

**Segnalare un'anomalia come revisionata, senza correggere nulla.** A volte
l'anomalia è corretta così com'è — un'assenza giustificata, una durata
eccessiva reale — e non c'è niente da riscrivere negli orari. Il bottone
**«Segnala come revisionato»** (attivo selezionando una o più righe) copre
questo caso: scrive `TimbraturaCorretta.revisionata = true` sul giorno, un
flag **indipendente dagli orari** che il motore di calcolo non legge affatto —
resta un dettaglio di visualizzazione, applicato dopo, in
[`components/admin/timbrature-manager.tsx`](../components/admin/timbrature-manager.tsx)
(badge, tinta di riga, conteggio) e nel PDF
([`lib/timbrature/stampa/`](../lib/timbrature/stampa/)). Le anomalie continuano
a essere calcolate normalmente; un giorno revisionato mostra la stessa spunta
muted di un giorno senza anomalie — deliberatamente indistinguibile a colpo
d'occhio, il Tooltip resta l'unico modo per sapere che è stato rivisto a mano —
ma non compare più nel filtro «Da verificare» né nel relativo conteggio. È un
toggle: selezionando giorni già revisionati il bottone smarca la revisione.

## I giustificativi di assenza

«Revisionato» dice *ho guardato, va bene così*, ma non dice **perché**. Un
giorno di ferie e uno di malattia si assomigliano troppo su un registro che
esce dall'ufficio: da qui i **giustificativi di assenza**.

**L'anagrafica è configurabile** dall'admin in `/admin/giustificativi`
([`components/admin/giustificativi-manager.tsx`](../components/admin/giustificativi-manager.tsx),
service in [`lib/timbrature/giustificativo.ts`](../lib/timbrature/giustificativo.ts)),
esattamente come i preset di orario: due campi, una **sigla** (`codice`, unica,
maiuscola) e una `descrizione` per esteso. Al primo avvio il seed crea F
(Ferie), M (Malattia), L104 (Permesso Legge 104) e DONA (Donazione sangue).

**Sulla giornata viene salvata la sola sigla**, in
`TimbraturaCorretta.giustificativo` — denormalizzata, senza chiave esterna
verso l'anagrafica. È deliberato: eliminare un codice non deve poter riscrivere
la storia delle presenze, e una giornata di due anni fa resta leggibile anche
se quel codice non esiste più (si perde la descrizione, non il fatto). Il
prezzo è che **rinominare** una sigla propaga l'aggiornamento alle giornate che
la usano, in transazione (`updateGiustificativo`).

**Il motore riceve solo un booleano.** `calcolaCorretti` ha un 7° parametro
`giustificato`: quando è vero esce subito con la giornata **azzerata** — orari
`ce1…cu2` nulli, ore a zero, nessuna anomalia — prima di overlay, fill e
controlli. Vale anche in presenza di timbrature reali o di una correzione
manuale, che restano salvate ma inerti e tornano valide se il giustificativo
viene rimosso. Il **pernotto** del rapportino, se c'è, viene comunque
preservato: resta un fatto del giorno, e continua a contare in
`giorniTrasferta`.

**Dove si applica.** Dalla pagina Timbrature, con il bottone **«Giustifica»**
sulle righe selezionate: gemello di «Applica orario», stessa conferma, stesso
posto. È quindi **un'azione da desktop**, come tutte le altre azioni di massa —
la lista mobile non ha le checkbox e la Sheet di dettaglio resta di sola
lettura. Applicare un **orario** a una giornata giustificata **rimuove** il
giustificativo: una giornata con un orario è una giornata lavorata. «Azzera
correzioni» lo rimuove insieme a tutto il resto (la DELETE elimina l'intera
riga).

**Come si vede.** In pagina, un badge con la sigla accanto alla data (tooltip
con la descrizione), su desktop e su mobile; le celle degli orari corretti
diventano non modificabili e la Sheet di dettaglio lo dichiara in testa. Nel
PDF, una banda che sostituisce l'intera fascia degli orari con la descrizione
per esteso — vedi [stampa-timbrature.md](stampa-timbrature.md).

## Come estendere

- **Aggiungere una regola:** aggiungi il campo a `calcoloSettingsSchema` /
  `calcoloSettingsInputSchema` e a `CALCOLO_DEFAULTS`
  ([`lib/settings/schema.ts`](../lib/settings/schema.ts)), leggilo in
  `getCalcoloSettingsForAdmin` ([`lib/settings/calcolo.ts`](../lib/settings/calcolo.ts)),
  usalo nel motore (`turni.ts`/`calcolo.ts`) ed esponilo nel form. Nessuna
  migrazione: il blob è schemaless.
- **Aggiungere un'anomalia calcolata dagli orari:** aggiungi il valore al tipo
  `Anomalia`, la condizione in `calcolaCorretti` (dopo overlay+fill) e
  l'etichetta in `ANOMALIA_LABEL`
  ([`components/admin/timbrature-manager.tsx`](../components/admin/timbrature-manager.tsx)).
- **Aggiungere un'anomalia che dipende da un dato esterno al motore** (come
  `rapportino_mancante`, che dipende dalla configurazione per dipendente, o
  `scostamento_rapportino`, che dipende dal contenuto del rapportino):
  aggiungi comunque il valore al tipo `Anomalia` e l'etichetta in
  `ANOMALIA_LABEL`, ma calcola la condizione come funzione pura vicino al dato
  da cui dipende (es. `lib/rapportini/calcolo.ts`) e uniscila all'array
  `anomalie` nel punto in cui `timbrature-manager.tsx` costruisce le righe —
  mai dentro `calcolaCorretti`, che deve restare un calcolo puro di orari.

## Test

Le funzioni pure sono coperte da
[`lib/timbrature/calcolo.test.ts`](../lib/timbrature/calcolo.test.ts) (`npm run
test`, vitest, nessun I/O) con i casi reali di BONI di giugno 2026, più un
blocco dedicato alla giornata giustificata (azzeramento, precedenza su
correzione manuale e rapportino, pernotto preservato). La
regressione chiave: il **30/06 (`E 07:27 U 12:07`) deve restare a 4h30** — la
giornata non è chiusa, quindi nessun fill. È ciò che distingue questo motore dal
vecchio Access, che riempiva indiscriminatamente e accreditava ore mai lavorate.

L'[ancoraggio alle timbrature](#lancoraggio-alle-timbrature) ha il suo blocco,
sui casi reali di **luglio 2026** che l'hanno motivato: un ramo per caso
(COLA DANIELE per la pausa che assorbe, il timbro del mattino e quello serale
mancanti; CAPRADOSSI per la mezza giornata; MAGN.G e LENTINI per le ore che non
entrano nella finestra timbrata), più tre invarianti che valgono ovunque:

- **BONI 07/07 non cambia di un minuto** — chi segue davvero l'orario standard
  deve restare identico a prima. È la regressione che protegge la maggioranza
  dei dipendenti;
- **il totale è sempre quello del rapportino**, ramo per ramo;
- correzione manuale e giustificativo continuano a vincere sull'orario ancorato.

## Fuori scopo

- **Calendario delle festività.** Nessuna fonte disponibile: le festività
  infrasettimanali risultano `assente`. Rimedio manuale: giustificarle con un
  codice dedicato (vedi [I giustificativi di assenza](#i-giustificativi-di-assenza)).
- **Monte ore delle assenze.** Un giorno giustificato vale zero ore: il registro
  documenta le ore lavorate, non matura ferie né conteggia i permessi residui.
- **Override delle regole per dipendente.** I dati 2026 non ne mostrano il
  bisogno (la regola della pausa è auto-selettiva). Se servisse: una tabella
  `dipendente_regole` con un JSON parziale in merge sul globale.
