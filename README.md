# shadcn-starter

Base di partenza per sviluppi web full-stack: **frontend Next.js + shadcn/ui**,
**backend** integrato come Route Handlers e **database PostgreSQL** con **Prisma**.

Lo scaffold è volutamente **leggero ma funzionante end-to-end**: include una slice di
esempio (le "note") che attraversa tutti i livelli, dalla UI al database e ritorno.

## Stack

- [Next.js 16](https://nextjs.org/) (App Router, TypeScript) + [shadcn/ui](https://ui.shadcn.com/) (preset `bcivVPKk`: stile nova, palette zinc, icone Lucide, font Manrope)
- Backend: Route Handlers di Next.js in `app/api/`, logica di dominio isolata in `lib/`
- [Prisma 7](https://www.prisma.io/) + driver adapter `@prisma/adapter-pg`
- PostgreSQL 16 via Docker Compose

## Prerequisiti

- Node.js 20+
- Docker (per il database locale)

## Avvio rapido

```bash
# 1. Installa le dipendenze (FALLO PRIMA di qualunque comando prisma)
npm install

# 2. Variabili d'ambiente
cp .env.example .env

# 3. Avvia PostgreSQL (espone la porta host 5433 -> 5432 del container)
docker compose up -d

# 4. Applica le migration (crea le tabelle nel DB)
npx prisma migrate dev

# 5. Genera il Prisma Client in lib/generated/prisma
#    (migrate dev di solito lo fa già: questo passo è una garanzia)
npx prisma generate

# 6. Crea gli account iniziali, admin e utente (idempotente)
npm run db:seed

# 7. Avvia l'app
npm run dev
```

> **Ordine importante:** `npm install` va eseguito **prima** dei comandi `prisma`.
> Se lanci `migrate dev` senza dipendenze installate, la generazione automatica del
> client non avviene e il seed fallisce con `Cannot find package '@/lib'`.

> Prima del seed imposta `BETTER_AUTH_SECRET` in `.env` (genera con
> `openssl rand -base64 32`). Credenziali admin di default: vedi `SEED_ADMIN_*`
> in `.env.example`. In sviluppo i link di verifica/reset email sono stampati nei
> log del server. Dettagli: [docs/autenticazione-e-ruoli.md](docs/autenticazione-e-ruoli.md).

App su [http://localhost:3000](http://localhost:3000) (se la 3000 è occupata, Next sceglie
automaticamente la porta successiva, es. 3001).

### Workflow quotidiano

Dopo il primo setup, una sessione tipica è:

```bash
docker compose up -d        # 1. avvia PostgreSQL (in background)
npx prisma migrate dev      # 2. allinea il DB allo schema (se ci sono migration nuove)
npm run dev                 # 3. avvia l'app
```

Le tre che userai quasi sempre: `npm run dev`, `docker compose up -d`, `npx prisma migrate dev`.

## Struttura

```
app/
  api/
    health/route.ts    # GET /api/health -> { status: "ok" }
    notes/route.ts      # GET lista note, POST crea nota
  page.tsx              # home: legge le note (Server Component) + form
components/
  note-form.tsx         # form client che chiama /api/notes
  ui/                   # componenti shadcn/ui
lib/
  prisma.ts             # singleton Prisma Client (adapter pg)
  notes.ts              # logica di dominio (listNotes, createNote)
  generated/prisma/     # Prisma Client generato (ignorato da git)
prisma/
  schema.prisma         # modello Note
  migrations/           # storia delle migration
docker-compose.yml      # servizio PostgreSQL
```

## Variabili d'ambiente

Vedi `.env.example`. Necessarie: `DATABASE_URL` (database) e `BETTER_AUTH_SECRET` +
`BETTER_AUTH_URL` (autenticazione). Le `POSTGRES_*` configurano il container di
`docker-compose.yml`; le `SEED_ADMIN_*` e `SEED_USER_*` definiscono gli account creati
da `npm run db:seed`.

## Comandi utili

### App / Next.js

| Comando             | Descrizione                                                                 |
| ------------------- | --------------------------------------------------------------------------- |
| `npm run dev`       | Avvia in sviluppo con hot-reload (porta 3000, o la prima libera)            |
| `npm run build`     | Build di produzione — buon check pre-merge: se passa, l'app compila davvero |
| `npm run start`     | Serve la build di produzione (richiede un `build` precedente)               |
| `npm run typecheck` | Controllo dei tipi TypeScript (veloce, utile prima di committare)           |
| `npm run lint`      | ESLint                                                                      |
| `npm run format`    | Prettier (riformatta i file)                                                |
| `npm run db:seed`   | Crea gli account iniziali, admin e utente (idempotente)                    |

Per fermare il dev server: `Ctrl-C`, oppure `pkill -f "next dev"`.

### Database (Docker)

```bash
docker compose up -d              # avvia Postgres (in background)
docker compose ps                 # stato del container (healthy?)
docker compose logs -f postgres   # log del DB in tempo reale
docker compose down               # ferma (i dati restano nel volume)
docker compose down -v            # ferma E cancella i dati (reset totale)
```

> Il DB è esposto sulla porta **5433** dell'host (non 5432, per non collidere con altri
> Postgres locali). La stringa di connessione è in `.env`.

### Prisma (ORM)

```bash
npx prisma migrate dev --name <nome>   # dopo aver modificato schema.prisma: crea e applica una migration
npx prisma migrate dev                 # applica le migration esistenti / allinea il DB
npx prisma generate                    # rigenera il client (di solito automatico dopo migrate)
npx prisma studio                      # UI web per sfogliare e modificare i dati
npx prisma migrate reset               # azzera il DB e riapplica tutte le migration (cancella i dati)
```

Regola pratica: **ogni volta che tocchi `schema.prisma` → `npx prisma migrate dev`**.

### Componenti shadcn/ui

```bash
npx shadcn@latest add <nome>             # aggiunge un componente (es. switch, tabs, dialog)
npx shadcn@latest search -q "..."        # cerca componenti disponibili
npx shadcn@latest add <nome> --dry-run   # anteprima senza scrivere file
```

I componenti finiscono in `components/ui/`.

### Git (Git Flow — vedi [CLAUDE.md](./CLAUDE.md))

```bash
# Nuova feature (mai lavorare su main):
git checkout develop
git checkout -b feature/<descrizione>

# Lavoro e commit (messaggio in italiano, imperativo, minuscolo):
git add -A
git commit -m "feat(scope): descrizione breve"

# A feature finita: merge in develop e pulizia del branch
git checkout develop
git merge --no-ff feature/<descrizione>
git branch -d feature/<descrizione>
```

### Insidie comuni

- Se dopo aver cambiato/rimosso rotte `npm run typecheck` segnala errori in `.next/types/...`,
  sono **tipi generati stantii**: `rm -rf .next` e rilancia.
- In sviluppo una pagina che va in errore mostra l'**overlay rosso di Next**: è il debugger,
  è normale. La UI di `error.tsx` è ciò che si vede in produzione.

## Non incluso (di proposito)

Lo scaffold resta minimale. Sono volutamente esclusi e si potranno aggiungere quando
serviranno: git hooks (Husky), commitlint, CI, framework di test, deploy.

L'**autenticazione** (email+password, sessioni, RBAC, gestione utenti) è inclusa
tramite Better Auth: vedi [docs/autenticazione-e-ruoli.md](docs/autenticazione-e-ruoli.md).

## Convenzioni

Branching Git Flow e Conventional Commits in italiano: vedi [CLAUDE.md](./CLAUDE.md).
