# CLAUDE.md

Linee guida per il lavoro su questo progetto. Questo file è rivolto sia a Claude
Code sia agli altri sviluppatori del team.

---

## Documentazione

Guide di riferimento del progetto (cartella [`docs/`](docs/)):

- [Come creare un nuovo tema](docs/creare-un-tema.md) — aggiungere una palette
  selezionabile dall'utente (token CSS, `next-themes`, selettore).
- [Come creare una voce di menu della sidebar](docs/creare-voce-menu-sidebar.md) —
  aggiungere voci semplici o con sotto-voci, funzionanti anche da collassata.
- [Ricerca globale (topbar)](docs/ricerca-globale.md) — la palette ⌘K con
  scorciatoie ai menu e ai record; come registrare una nuova fonte di ricerca.
- [Autenticazione, ruoli e gestione utenti](docs/autenticazione-e-ruoli.md) —
  Better Auth: proteggere pagine/API, aggiungere ruoli e permessi (RBAC), admin.
- [Impostazioni di sistema e preferenze per-utente](docs/impostazioni-di-sistema.md) —
  configurazione globale (nome, icona) vs preferenze personali; come aggiungerne.
- [Gestione dei file (storage e accesso)](docs/gestione-file.md) — come si
  salvano/servono i file (driver intercambiabile), file di sistema vs utente.
- [Invio email (driver e template)](docs/email.md) — backend email
  intercambiabile (console/SMTP), template come stringhe editor-ready.
- [Operazioni in background (job e cron)](docs/operazioni-in-background.md) —
  job lunghi con avanzamento e stop, worker dedicato (`npm run worker`),
  schedulazioni cron; come aggiungere un nuovo tipo di operazione.

---

## Linee guida UI

Convenzioni vincolanti per ogni interfaccia del progetto. Servono a mantenere
coerenza e a non ripetere errori già corretti.

### Componenti

- **Usa sempre i componenti shadcn** in [`components/ui/`](components/ui/). Non
  introdurre input, bottoni, dialog o tabelle "a mano": se manca un componente,
  aggiungilo via shadcn invece di reinventarlo.
- I bottoni icona usano le size dedicate (`icon`, `icon-sm`, `icon-xs`), non un
  bottone normale con dentro solo un'icona.

### Layout delle pagine

- Le **pagine di impostazioni/configurazione** usano un layout **a larghezza
  piena**: card impilate in colonna singola, ciascuna `w-full`. Niente card
  strette (`max-w-*`) né griglie di card affiancate, che creano colonne di
  altezze diverse e spazio vuoto sgradevole a destra.
- Dentro una card, **raggruppa i campi correlati** invece di accodarli in una
  lista piatta: usa `FieldSet` + `FieldLegend` per i gruppi e `FieldSeparator`
  per separarli. Campi brevi e affini (es. host+porta, utente+password) stanno
  su una **griglia** (`grid sm:grid-cols-2`) per sfruttare la larghezza.

### Azioni e bottoni

- I bottoni con **label di testo** hanno **sempre anche un'icona** (lucide) a
  sinistra del testo. Durante un'operazione asincrona l'icona è sostituita dallo
  `Spinner` (`{busy ? <Spinner /> : <Icon />}`), così il bottone non «salta».
- Le **azioni a fondo form** vanno in un `CardFooter`, **allineate a destra**
  (`justify-end`); l'azione primaria è la più a destra. Per tenere il submit nel
  footer ma dentro il `<form>`, avvolgi con `<form className="contents">`.
- **Niente bottoni con label di testo dentro le righe di tabella.** Le azioni di
  riga sono **bottoni solo-icona** (`size="icon-sm"`, `variant="ghost"`) con
  `aria-label` **e** un `Tooltip` che ripete l'etichetta. Evita di ripetere la
  stessa parola (es. «Log», «Elimina») su ogni riga: occupa spazio inutile.
- Le **azioni a livello di card** (aggiorna, ecc.) vanno come bottone solo-icona
  dentro `CardAction`, in alto a destra nell'header della card.
- Ogni bottone solo-icona **deve** avere un nome accessibile (`aria-label` o
  `sr-only`): il tooltip da solo non basta per gli screen reader.
- Il `TooltipProvider` è già montato nel layout della dashboard: usa `Tooltip`
  direttamente, senza riavvolgerlo.

### Conferme

- Le azioni con effetti reali o distruttive (eliminare, fermare, «esegui ora»,
  ecc.) **devono** chiedere conferma con un `AlertDialog`. Quelle distruttive
  usano `variant="destructive"` sull'azione di conferma.
- Le azioni di compilazione deliberata (es. avviare un'operazione da un form già
  riempito) non richiedono conferma.

### Stile e dettagli

- **Non tagliare mai il focus ring.** I componenti usano un anello di `3px`
  (`focus-visible:ring-3`): i contenitori con `overflow-hidden` (accordion,
  carosello, ecc.) devono avere abbastanza padding perché il glow non venga
  tagliato ai bordi. Caso tipico: input a larghezza piena dentro un
  `AccordionContent` — serve un padding orizzontale sul contenuto.
- Usa `tabular-nums` per date, orari, percentuali e contatori nelle tabelle, così
  le cifre restano allineate in verticale.
- Copy in **italiano**, voce attiva, sentence case: il bottone dice cosa succede
  («Ferma», «Elimina») e il toast conferma con lo stesso verbo.

---

## Linee guida per il versionamento

Il progetto usa **Git Flow** come strategia di branching e
**Conventional Commits** come convenzione per i messaggi di commit.
Tutta la documentazione e i messaggi di commit sono in **italiano**.

### Regole operative di lavoro

Regole vincolanti su come si lavora nel repository:

- **È vietato lavorare su `main`.** Nessuna modifica diretta, in nessun caso.
- Si lavora **sempre** su `develop` oppure su un branch dedicato.
- Se viene richiesta esplicitamente una modifica che ricade in una categoria
  di branch (feature / fix / release / hotfix), si **crea automaticamente** il
  branch corrispondente con la convenzione di nome corretta.
- Se ci si trova su `develop` e arriva una richiesta generica senza indicare il
  branch, si **chiede** se creare un branch dedicato o se si tratta di una
  modifica "lampo".
- **`merge` e `push` solo dietro conferma esplicita** di chi richiede la
  modifica: mai di propria iniziativa.

### Strategia di branching: Git Flow

Branch principali (permanenti):

- **`main`** — contiene solo codice rilasciato e stabile. Ogni commit su `main`
  corrisponde a una release ed è taggato (vedi *Tag e release*). Non si committa
  mai direttamente: ci si arriva solo tramite merge di `release/*` o `hotfix/*`.
- **`develop`** — branch di integrazione. Raccoglie le feature completate in
  attesa della prossima release. È la base da cui nascono i branch di feature.

Branch di supporto (temporanei, da cancellare dopo il merge):

| Tipo        | Nasce da   | Confluisce in        | Convenzione nome        |
| ----------- | ---------- | -------------------- | ----------------------- |
| Feature     | `develop`  | `develop`            | `feature/<descrizione>` |
| Release     | `develop`  | `main` **e** `develop` | `release/<versione>`  |
| Hotfix      | `main`     | `main` **e** `develop` | `hotfix/<versione>`   |

Esempi di nomi branch:

```
feature/login-google
feature/sidebar-collassabile
release/1.2.0
hotfix/1.2.1
```

Note operative:

- I branch di feature sono **short-lived**: meglio piccoli e frequenti che
  grandi e longevi. Riallinea spesso con `develop` (`git merge develop` o rebase).
- Ogni feature entra in `develop` tramite **Pull Request** con revisione.
- Un branch `release/*` serve solo a stabilizzare: bugfix, bump di versione,
  aggiornamento changelog. Niente nuove feature.
- Un `hotfix/*` corregge un bug critico in produzione partendo da `main` e va
  riportato anche su `develop`.

### Messaggi di commit: Conventional Commits

Formato:

```
<tipo>(<scope opzionale>): <descrizione breve>

<corpo opzionale: cosa e perché, non come>

<footer opzionale: BREAKING CHANGE, riferimenti a issue>
```

Tipi ammessi:

- **`feat`** — nuova funzionalità
- **`fix`** — correzione di un bug
- **`docs`** — modifiche alla sola documentazione
- **`style`** — formattazione, spazi, punto e virgola (nessun cambio di logica)
- **`refactor`** — modifica al codice che non aggiunge feature né corregge bug
- **`perf`** — miglioramento delle prestazioni
- **`test`** — aggiunta o modifica di test
- **`build`** — modifiche al sistema di build o alle dipendenze
- **`ci`** — modifiche alla configurazione di CI
- **`chore`** — attività di manutenzione varie
- **`revert`** — annulla un commit precedente

Regole:

- La descrizione è in **italiano**, in **modo imperativo** e **minuscolo**, senza
  punto finale: «aggiungi…», «correggi…», non «aggiunto…» o «Aggiunge…».
- Riga di intestazione **≤ 72 caratteri**.
- Lo **scope** è opzionale ma consigliato: indica l'area toccata (es. `auth`,
  `ui`, `deps`).
- Un **breaking change** si segnala con `!` dopo il tipo/scope **oppure** con un
  footer `BREAKING CHANGE: <spiegazione>`.

Esempi:

```
feat(auth): aggiungi login con Google
fix(ui): correggi overflow del sidebar su mobile
docs: aggiorna istruzioni di setup nel README
refactor(api): estrai client HTTP in un modulo dedicato
chore(deps): aggiorna shadcn all'ultima versione
feat(api)!: rimuovi endpoint /v1/users deprecato

BREAKING CHANGE: l'endpoint /v1/users non è più disponibile, usare /v2/users
```

### Tag e release: Versionamento Semantico (SemVer)

Le release seguono lo schema **`MAJOR.MINOR.PATCH`**:

- **MAJOR** — cambiamenti incompatibili (breaking change).
- **MINOR** — nuove funzionalità retrocompatibili.
- **PATCH** — correzioni di bug retrocompatibili.

Ogni release su `main` è taggata con prefisso `v` (es. `v1.2.0`), preferibilmente
con tag annotato:

```
git tag -a v1.2.0 -m "Release 1.2.0"
```

### Pull Request

- Titolo della PR nello stesso formato dei commit (Conventional Commits).
- Descrizione che spiega **cosa** cambia e **perché**, con riferimento alle issue
  collegate (es. `Closes #42`).
- Merge su `develop`/`main` solo dopo revisione e con CI verde.
