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
# 1. Variabili d'ambiente
cp .env.example .env

# 2. Avvia PostgreSQL (espone la porta host 5433 -> 5432 del container)
docker compose up -d

# 3. Applica le migration e genera il Prisma Client
npx prisma migrate dev

# 4. Avvia l'app
npm run dev
```

App su [http://localhost:3000](http://localhost:3000) (se la 3000 è occupata, Next sceglie
automaticamente la porta successiva, es. 3001).

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

Vedi `.env.example`. La sola variabile necessaria è `DATABASE_URL`; le `POSTGRES_*`
configurano il container di `docker-compose.yml`.

## Script

| Comando             | Descrizione                          |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Avvia l'app in sviluppo (Turbopack)  |
| `npm run build`     | Build di produzione                  |
| `npm run start`     | Avvia la build di produzione         |
| `npm run lint`      | ESLint                               |
| `npm run typecheck` | Controllo dei tipi TypeScript        |
| `npm run format`    | Prettier                             |
| `npx prisma studio` | UI per ispezionare il database       |

## Comandi database utili

```bash
docker compose up -d        # avvia Postgres
docker compose down         # ferma Postgres (i dati restano nel volume)
docker compose down -v      # ferma e cancella anche i dati
npx prisma migrate dev      # crea/applica le migration in sviluppo
npx prisma generate         # rigenera il Prisma Client
```

## Non incluso (di proposito)

Lo scaffold resta minimale. Sono volutamente esclusi e si potranno aggiungere quando
serviranno: git hooks (Husky), commitlint, CI, framework di test, autenticazione, deploy.

## Convenzioni

Branching Git Flow e Conventional Commits in italiano: vedi [CLAUDE.md](./CLAUDE.md).
