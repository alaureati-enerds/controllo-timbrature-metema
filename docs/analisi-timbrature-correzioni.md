# Analisi: pagina admin "Timbrature" e logica di correzione

Report di code review della pagina `/admin/timbrature` — analisi
architettura dati, aderenza alle convenzioni UI del progetto e solidità
della logica di correzione/salvataggio. Nessuna modifica al codice è stata
fatta contestualmente a questa analisi: è una base per decidere cosa e in
che ordine sistemare.

Data: 2026-07-02. Vedi [Stato avanzamento](#stato-avanzamento) in fondo per
cosa è stato sistemato dopo la review.

File coinvolti:
- `components/admin/timbrature-manager.tsx` (751 righe, client component)
- `app/(dashboard)/admin/timbrature/page.tsx` (route, `requireRole("admin")`)
- `app/api/admin/timbrature/route.ts` (GET giornate + assegnazione turni)
- `app/api/admin/timbrature/correzioni/route.ts` (GET/PUT/DELETE correzioni)
- `app/api/admin/timbrature/dipendenti/route.ts`
- `lib/timbrature/arrotondamento.ts`, `lib/mysql/timbrature.ts`
- `prisma/schema.prisma:349-361` (modello `TimbraturaCorretta`)

---

## Verdetto sintetico

**Architettura dati: buona idea, esecuzione incompleta.** La separazione tra
dato grezzo (MySQL aziendale, sola lettura, mai scritto) e correzioni
(tabella Postgres locale `TimbraturaCorretta`, overlay non distruttivo) è la
scelta giusta e va mantenuta. Ma la logica di persistenza attorno a questa
buona base **non è del tutto convincente**: manca validazione dei valori,
manca ogni traccia di audit (chi ha corretto cosa e quando), il reset è una
`DELETE` fisica irreversibile senza conferma, e non c'è storicizzazione dei
valori precedenti. Per dati che incidono su ore lavorate/straordinari
(rilevanza payroll) questi sono gap concreti, non solo rifiniture.

Sul fronte UI, il componente usa correttamente shadcn per la maggior parte
dell'interfaccia, ma **viola direttamente alcune regole vincolanti di
CLAUDE.md**: azione distruttiva ("Reset correzioni") senza `AlertDialog`,
bottoni icona senza `aria-label`, editing con `<input>` HTML nudo invece di
`Input` shadcn, azioni di card fuori posto. Il gap più rilevante in termini
di prodotto è che **su mobile la correzione delle timbrature non è
possibile**: la vista a card è sola lettura.

---

## 1. Problemi ad alta severità

### 1.1 "Reset correzioni" è distruttivo e irreversibile, senza conferma

**✅ Risolto** (conferma via `AlertDialog` — vedi [Stato avanzamento](#stato-avanzamento)).
Resta valido il resto del paragrafo: lato server il `DELETE` è ancora una
cancellazione fisica non recuperabile (vedi 1.4, non ancora affrontato).

`timbrature-manager.tsx:469-479` — il bottone chiama `resettaTutto()`
(righe 261-274) direttamente su `onClick`, che fa una `DELETE` di **tutte**
le correzioni del mese per il dipendente. Nessun `AlertDialog`, nessun modo
di annullare: CLAUDE.md è esplicito sul richiedere conferma per azioni
distruttive. Aggrava il problema il fatto che lato server il `DELETE` è una
cancellazione fisica (vedi 1.4) — non recuperabile nemmeno dal DB.

### 1.2 Nessuna validazione del formato orario, né client né server

**✅ Risolto** — regex `HH:MM` sia in `CorrettaCell.commit()` (client) sia
in `putSchema` (server, `correzioni/route.ts`). Vedi [Stato avanzamento](#stato-avanzamento).

- Client: `CorrettaCell.commit()` (righe 122-127) fa solo `trim()` +
  controllo "non vuoto/diverso dal precedente", nessun check `HH:MM`.
- Server: `putSchema` in `correzioni/route.ts:13-20` valida `giorno` con
  regex ma **`entrata1/uscita1/entrata2/uscita2` sono `z.string()` libere**,
  nessun pattern.
- Impatto concreto: un valore come `"abc"` viene salvato as-is. A rendering,
  `minutiDaOra()` (`timbrature-manager.tsx:73-76`) fa
  `ora.split(":").map(Number)` senza guardia → `NaN` che si propaga a
  `calcolaCorretti`, `totaliMese` e viene mostrato come `"NaNh NaNm"` in
  tabella, potenzialmente per l'intero mese. Dato scritto in DB e persistito.

### 1.3 Nessun audit trail per una modifica payroll-sensitive
Il progetto ha già un'infrastruttura di audit log generale e ben
documentata (`docs/audit-logging.md`, `lib/audit/`), usata per eventi meno
sensibili come `system.orario.update` (cambio dell'orario standard globale).
Le route `PUT`/`DELETE` di `correzioni/route.ts` **non chiamano mai
`audit(...)`**. Risultato: non esiste modo di sapere chi ha corretto la
timbratura di un dipendente in un giorno specifico, quando, o da quale
valore. Il modello `TimbraturaCorretta` (`prisma/schema.prisma:349-361`) non
ha nemmeno un campo `correctedBy`/`actorId` — l'unica traccia è `updatedAt`.
Per un dato che incide su ore ordinarie/straordinarie, è un gap reale.

### 1.4 Reset = `DELETE` fisica, nessuna storicizzazione dei valori precedenti
Ogni `PUT` fa un `upsert` che sovrascrive i campi correnti senza mantenere
il valore precedente (nessuna tabella di history/versioning); il reset
mensile è un `deleteMany` fisico. Una volta corretto/resettato, il valore
originale della correzione non è più recuperabile in alcun modo — solo il
dato grezzo MySQL resta (che però è quello che l'admin stava correggendo
perché ritenuto sbagliato/incompleto).

### 1.5 `DELETE` senza parametri validi risponde "successo" senza cancellare nulla
`correzioni/route.ts:77-97` — `deleteSchema` ha `giorno`, `mese`, `anno`
tutti opzionali. Se la richiesta non ne passa nessuno, il blocco
`if (giorno) {...} else if (mese && anno) {...}` non esegue alcuna query,
ma la route risponde comunque `200 { deleted: true }`. Falso positivo
silenzioso (oggi non raggiungibile dalla UI attuale, ma l'endpoint resta
pubblico e chiamabile così).

### 1.6 "Orario standard" applica un preset hardcoded, disallineato dalle Impostazioni

**✅ Risolto** — il preset hardcoded è stato rimosso: la pagina Timbrature ora
applica i preset tramite un select "Applica preset" che elenca l'**Orario
Standard** (derivato in tempo reale dalle Impostazioni di sistema, quindi
sempre allineato) più i **preset personalizzati** gestiti nella nuova pagina
**Orari di lavoro** (`/admin/orari-lavoro`). Vedi [Stato avanzamento](#stato-avanzamento).

`applicaOrarioStandard()` (righe 198-233) usa un preset fisso
(`08:30/12:30/14:30/18:30`, righe 200-205) invece dell'orario di lavoro
realmente configurato dall'admin in Impostazioni
(`getOrarioSettingsForAdmin`, default `08:00/12:00/13:30/17:30`). Il
componente **riceve già** quell'orario reale dall'API (`data.orario`, stato
`orario` righe 166-171) ma non lo usa mai per questo bottone. Se l'admin
cambia l'orario standard di sistema, il bottone "Orario standard" nella
pagina Timbrature continuerà ad applicare valori vecchi/sbagliati.

### 1.7 Fallimento parziale non gestito in `applicaOrarioStandard`
Righe 208-222: N richieste `PUT` in parallelo via `Promise.all`, non
transazionali fra loro (nessuna transazione lato server: verificato, zero
uso di `prisma.$transaction` nel repo). Se una fetch fallisce, `Promise.all`
rigetta e **nessuna** delle righe selezionate viene riflessa nello stato
locale — anche quelle già scritte con successo sul server. Risultato: stato
client/DB disallineato silenziosamente, comunicato solo con un toast
generico ("Errore applicazione preset"), senza dire quali giorni sono
davvero salvati.

### 1.8 Concorrenza: last-write-wins senza rilevamento conflitti
Nessun controllo di versione/timestamp lato client prima di scrivere. Se due
admin correggono lo stesso campo dello stesso giorno quasi in
contemporanea, vince l'ultima richiesta arrivata, senza notifica a chi ha
perso la propria modifica. Rischio basso in pratica (funzionalità ad uso
raro/singolo admin) ma non gestito nemmeno a livello difensivo minimo.

---

## 2. Violazioni delle linee guida UI (CLAUDE.md)

| # | Problema | Riferimento | Stato |
|---|---|---|---|
| A | Reset senza `AlertDialog` (vedi 1.1) | righe 469-479 | ✅ Risolto — bottone dentro `AlertDialog` (`variant="destructive"`) |
| B | Bottoni icona ‹‹›› periodo senza `aria-label`/`Tooltip` | righe 424, 435 | ✅ Risolto — `aria-label` + `Tooltip` su entrambi |
| C | Azioni bulk ("Orario standard", "Reset correzioni") infilate in `CardTitle` invece di `CardAction`/`CardFooter`; `CardFooter` è importato (riga 19) ma mai usato | righe 460-479 | ✅ Risolto, con un affinamento rispetto alla proposta iniziale: invece di spostarle a fondo card in un `CardFooter` (costringeva a scrollare la tabella per raggiungerle), ora vivono in una **card dedicata "Correzioni rapide"** sopra la tabella, pensata per ospitare altri preset futuri |
| D | Editing inline con `<input>` HTML nudo invece del componente `Input` shadcn | righe 137-143 | ✅ Risolto |
| E | `title="Clicca per modificare"` al posto di `Tooltip`; cella cliccabile (`onClick` su `TableCell`) senza `role`/`tabIndex`/gestione tastiera per **entrare** in editing — solo il mouse funziona, nessun accesso da tastiera/screen reader | riga 152 | ✅ Risolto — `Tooltip`, `role="button"`, `tabIndex`, Invio/Spazio per entrare in editing |
| F | `w-40` fisso sul bottone periodo dentro un gruppo che non stacca mai in colonna su mobile — rischio overflow orizzontale sotto ~375px | riga 429 | ✅ Risolto — `flex-1` che si restringe sotto `sm`, `w-40` solo da tablet in su |
| G | Icona `RotateCwIcon` a `size-3` (12px), fuori dalla convenzione standard (16px/`size-4`) | riga 476 | ✅ Risolto |
| H | Doppio meccanismo di autorizzazione: pagina con `requireRole("admin")`, API con `requireSettingsPermission` (permesso `settings`, pensato per configurazioni globali). Oggi coincidono solo perché `settings` è concesso esclusivamente al ruolo `admin` in `lib/permissions.ts` — nessuna garanzia esplicita nel codice che resti così se in futuro si introduce un ruolo più granulare (es. "HR" senza accesso a SMTP/MySQL/config) | `lib/permissions.ts`, `lib/settings/authz.ts` | ✅ Risolto — nuova risorsa RBAC dedicata `timbrature: ["read", "update"]` in `lib/permissions.ts` + `lib/timbrature/authz.ts` (`requireTimbraturePermission`), usata nelle tre route al posto di `requireSettingsPermission` |

**Cose fatte bene:** uso sistematico di `tabular-nums`, skeleton di
caricamento, pattern icona↔spinner sul bottone "Carica", struttura
tabella→card sotto `md` (`hidden md:table` / `md:hidden`), uso di shadcn per
il resto dell'interfaccia (Card, Table, Combobox, Checkbox, Skeleton,
Spinner), buona differenziazione visiva reale/corretta (`text-sky-600`).

---

## 3. Fruibilità / UX

### 3.1 Su mobile le timbrature non sono correggibili (gap principale)
La card list mobile (righe 687-744) mostra solo dato reale e totali:
**nessuna colonna corretta, nessun editing, nessuna checkbox di selezione,
nessun modo di popolare `selected`** (quindi "Orario standard (N)" non può
mai comparire da mobile). Un admin che lavora da telefono può solo
consultare, non correggere — mentre CLAUDE.md tratta esplicitamente la
parità mobile come requisito che "cresce man mano che rivediamo le pagine".

### 3.2 Rimozione del reset per singola cella è una regressione di workflow
Il commit `450fc99` ha tolto il reset per singola correzione lasciando solo
il reset globale del mese. Conseguenza pratica: se l'admin corregge 20
giorni e sbaglia l'ultimo, l'unica via per sistemarlo è o ri-editare a mano
la cella con il valore giusto (ok se si accorge subito) o azzerare **tutte**
le 20 correzioni e rifarle. L'endpoint per il reset di un singolo giorno
esiste ancora lato API (`DELETE ?giorno=`) — è "dead code" solo lato client.
Vale la pena riconsiderare un modo mirato di annullare una singola cella
(es. tasto destro, o un'icona "annulla" che compare on-hover), oggi assente.

### 3.3 Nessun feedback per-cella durante il salvataggio o in caso di errore
`salvaCorrezione` non mostra alcun loading/disabled sulla cella mentre la
`PUT` è in volo, e se fallisce il toast è generico — non indica quale
riga/campo non si è salvato, la cella torna semplicemente al valore
precedente.

### 3.4 Weekend evidenziati con `bg-destructive/10`
Riga 585/692 — l'uso del colore "destructive" (semanticamente
errore/pericolo) per marcare un giorno non lavorativo è una scelta di
significato opinabile; un tono neutro/muted comunicherebbe meglio "giorno
non significativo" senza sovrapporsi al significato di errore usato altrove
(es. valori NaN, se mai comparissero — vedi 1.2).

---

## 4. Code smell minori

- `endOfMonth` importato in `timbrature-manager.tsx:4` ma mai usato.
- `ApiError` importato in `correzioni/route.ts:3` ma mai usato (nessun
  `throw new ApiError` in quel file, solo `ok`).
- `giornoSettimana` restituito dal backend (`Giornata.giornoSettimana`) ma
  il frontend ricalcola il weekend da sé con `weekEnd()` (righe 351-354)
  invece di riusare il campo — duplicazione minore.
- Pattern di costruzione della `Map` correzioni con spread condizionali
  (righe 318-328) leggibile ma un po' involuto.

---

## 5. Assenza di test

Confermato: nessun framework di test configurato nel repo (`package.json`),
nessun file `*.test.ts(x)`/`*.spec.ts(x)`. La logica di correzione — la
parte più delicata (validazione, upsert, reset, calcolo ordinario/
straordinario) — non ha copertura automatica. Un refactor futuro può
rompere silenziosamente `calcolaCorretti`, `assegnaTurni` o gli endpoint
senza che nessun test se ne accorga.

---

## 6. Priorità consigliate (se si vuole intervenire)

Ordine suggerito per impatto/rischio, non un piano di implementazione
dettagliato — da usare come base per decidere cosa affrontare:

1. ✅ **Validazione formato orario** (client + `putSchema` con regex `HH:MM`) —
   previene dati corrotti (1.2), rischio concreto e facile da chiudere. *Fatto.*
2. ✅ **`AlertDialog` di conferma su "Reset correzioni"** — allineamento diretto
   a una regola vincolante di CLAUDE.md (1.1), piccola modifica. *Fatto.*
3. **Audit log sulle correzioni** (`timbrature.correzione.upsert` /
   `.reset` nel catalogo `lib/audit/catalog.ts` + chiamata `audit()` nelle
   route PUT/DELETE) — chiude il gap di accountability (1.3), pattern già
   pronto nel progetto, basso sforzo.
4. ✅ **Disallineamento preset "Orario standard"** — rimosso il preset
   hardcoded (1.6); introdotta la pagina **Orari di lavoro** (CRUD dei preset)
   e un select "Applica preset" che usa l'Orario Standard reale dalle
   Impostazioni. *Fatto.*
5. **Editing/correzione anche da mobile** — la lacuna di prodotto più
   visibile (3.1), richiede più lavoro di design (quale UX per editing
   inline su card?).
6. Il resto: accessibilità tastiera sulla cella ✅, `Input` shadcn invece di
   `<input>` nudo ✅, permesso RBAC dedicato ✅ — fatti insieme alle altre
   violazioni CLAUDE.md. Restano aperti: fallimento parziale del bulk apply
   (1.7) e reset singola cella (3.2), priorità minore rispetto ai punti 1-3
   che toccano integrità e tracciabilità del dato.

---

## Stato avanzamento

**2026-07-03** — Sistemate tutte le violazioni CLAUDE.md della sezione 2
(A-H) su `components/admin/timbrature-manager.tsx` e sulle route
`app/api/admin/timbrature/**`:

- Reset correzioni dietro `AlertDialog` di conferma (destructive).
- `aria-label` + `Tooltip` sui bottoni ‹/› del selettore periodo.
- Editing inline con `Input` shadcn (non più `<input>` nudo), cella
  navigabile/attivabile da tastiera (`role="button"`, `tabIndex`,
  Invio/Spazio) con `Tooltip` al posto di `title`.
- Icona reset portata a `size-4` (16px), in linea con la convenzione.
- Permesso RBAC dedicato `timbrature` (`lib/permissions.ts`,
  `lib/timbrature/authz.ts`) al posto di `settings` nelle tre route API.
- **Riposizionamento controlli**: le azioni bulk ("Orario standard",
  "Reset correzioni") sono state spostate dal `CardTitle` a una **card
  dedicata "Correzioni rapide" sopra la tabella** (non in un `CardFooter` a
  fondo pagina come da proposta iniziale in tabella): visibili senza
  scroll con molte righe, disabilitate invece di sparire quando non
  applicabili, e con spazio pronto per altri preset futuri. Aggiunto anche
  il pattern icona↔spinner (`ClockIcon`/`RotateCwIcon` ↔ `Spinner`) durante
  le rispettive operazioni asincrone, mancante in precedenza.

Verificato con `npm run typecheck` e `npm run lint` puliti (nessun nuovo
errore/warning introdotto; anzi risolti tre warning preesistenti di import
inutilizzati: `endOfMonth`, `CardFooter`, `ApiError`).

**2026-07-03 (2)** — Validazione formato orario `HH:MM` (punto 1 della
lista priorità, problema 1.2):

- Client: `CorrettaCell.commit()` verifica il valore con la regex
  `^([01]\d|2[0-3]):[0-5]\d$` prima di salvare. Se non valido: toast di
  errore, il campo resta in editing con `aria-invalid` (bordo rosso, stile
  shadcn) e il focus torna sull'`Input` invece di chiudersi silenziosamente.
  Un valore vuoto o invariato chiude l'editing senza salvare (comportamento
  di "annulla" preesistente, non cambiato).
- Server: `putSchema` in `correzioni/route.ts` applica la stessa regex a
  `entrata1/uscita1/entrata2/uscita2` (nullable/optional, invariati per il
  resto); una richiesta con formato non valido ora fallisce con `400` invece
  di essere scritta as-is in `TimbraturaCorretta`.

**2026-07-03 (3)** — Input orario "guidato" invece di sola validazione a
posteriori: `mascheraOrario()` filtra ogni cifra digitata (accetta solo
`0-2` come prima cifra dell'ora, `0-3` come seconda se la prima è `2`,
`0-5` come prima cifra dei minuti) e inserisce i due punti in automatico
dopo la seconda cifra, così l'utente non può materialmente digitare un'ora
o un minuto fuori range. L'`Input` della cella è passato da non controllato
(`defaultValue` + lettura da `ref` al commit) a controllato (`value`/
`onChange` con la maschera); il controllo con regex al blur resta come
rete di sicurezza per i valori incompleti (es. `"08:3"`).

**2026-07-03 (4)** — Preset "Orari di lavoro" e fix del disallineamento
(problema 1.6, punto 4 della lista priorità):

- Nuova pagina admin **Orari di lavoro** (`/admin/orari-lavoro`): CRUD dei
  preset di orario (nome + due turni, ciascuno lasciabile vuoto), con tabella
  desktop, card list mobile, dialog di creazione/modifica, conferma di
  eliminazione (`AlertDialog`) e input orario "guidato" (`mascheraOrario`,
  estratta in `lib/timbrature/ora.ts` e condivisa con la pagina Timbrature).
  Modello Prisma `TimbraturaPreset`, service `lib/timbrature/preset.ts`,
  risorsa RBAC dedicata `presets` (`lib/permissions.ts` +
  `lib/timbrature/preset-authz.ts`), route `app/api/admin/presets/**` con
  audit log (`timbrature.preset.create/update/delete`).
- **Orario Standard**: resta la fonte di verità nelle Impostazioni di sistema
  (guida anche il calcolo dei turni); nella pagina Orari di lavoro compare come
  voce di sola lettura, con link alle Impostazioni. Nessuna migrazione del
  setting, nessuna modifica alla logica di calcolo.
- **Pagina Timbrature**: rimosso il preset hardcoded
  (`08:30/12:30/14:30/18:30`); le azioni bulk usano ora un select "Applica
  preset" che elenca l'Orario Standard (dal valore reale delle Impostazioni) e
  i preset personalizzati. I turni vuoti di un preset azzerano la correzione e
  ricadono sul dato reale calcolato.

Verificato con `npm run typecheck` e `npm run lint` puliti (nessun nuovo
errore) e con le route API/pagina che compilano e applicano le guard
(401/redirect senza sessione).

**Prossimo intervento**: audit log sulle correzioni (punto 3 della lista
priorità, problema 1.3).
