# Operazioni in background (job e cron)

L'app può eseguire **operazioni lunghe in background** — fuori dal ciclo di una
richiesta HTTP — seguendone l'avanzamento, fermandole e schedulandole con un
cron. Esempio tipico: ogni notte uno scrape di una pagina aggiorna dei dati.

Come per [storage](gestione-file.md) ed [email](email.md), l'engine della coda è
dietro un'astrazione: il resto del codice parla con una **facade** e non sa
_quale_ coda c'è sotto. Oggi l'engine è [pg-boss](https://github.com/timgit/pg-boss),
che usa **lo stesso Postgres dell'app** (nessuna infrastruttura aggiuntiva).

## Idea in breve

```
worker.ts                  PROCESSO separato: esegue i job e registra i cron
lib/jobs/
  boss.ts                  UNICO punto che conosce pg-boss (code, avvio, opzioni)
  types.ts                 contratto handler: JobContext, JobHandler, JobCancelledError
  registry.ts              registro { type → handler } — il punto di estendibilità
  handlers/
    demo.ts                handler dimostrativo (lavoro simulato a step)
  index.ts                 FACADE: enqueue / cancel / getJob / listJobs / executeJob
app/api/admin/jobs/        API admin protette per RBAC (list, enqueue, get, cancel)
components/admin/jobs-manager.tsx   UI con polling, barra di avanzamento, Stop
```

Il modello [`Job`](../prisma/schema.prisma) è la **fonte di verità** per ciò che
l'utente vede e controlla (tipo, stato, avanzamento, log, esito). La coda vera e
propria — locking, retry, cron — è gestita da pg-boss nel proprio schema
`pgboss.*`; lì viaggia solo `{ jobId }`. Cambiare engine non tocca modello né UI.

## Due processi

| Processo | Comando | Ruolo |
| --- | --- | --- |
| **Web** (Next) | `npm run dev` / `npm start` | _accoda_ i job (`enqueue`) e mostra la UI |
| **Worker** | `npm run worker` | _esegue_ i job e fa scattare i cron |

Il worker è un processo **sempre attivo** accanto all'app. In sviluppo aprilo in
un secondo terminale; in produzione (Docker) è un servizio a sé che condivide lo
stesso `DATABASE_URL` (vedi [In produzione](#in-produzione)). Senza worker
attivo i job restano in stato `queued`.

## Avviare e seguire un'operazione

Dal pannello **Operazioni in background** (`/admin/jobs`, solo admin) scegli un
tipo di operazione e premi **Avvia**. La tabella si aggiorna in **polling**
(~1,5s) mostrando stato, percentuale e messaggio; il pulsante **Log** apre i log
del job, **Stop** ne richiede l'interruzione.

Da codice si usa sempre la facade:

```ts
import { enqueue, cancel, getJob, listJobs } from "@/lib/jobs"

const job = await enqueue("demo", { steps: 10, stepMs: 1000 })
await cancel(job.id)        // richiede lo stop (cooperativo)
await getJob(job.id)        // stato corrente
await listJobs({ status: "running" })
```

## Stati e ciclo di vita

`queued → running → completed | failed | cancelled`

- **queued** — accodato, in attesa del worker.
- **running** — in esecuzione; `progress` (0–100) e `message` si aggiornano.
- **completed** — terminato con successo.
- **failed** — l'handler ha sollevato un'eccezione; il messaggio è in `error`.
- **cancelled** — interrotto su richiesta (vedi sotto).

Lo `status` è uno stato **osservato**, scritto solo dal worker. La richiesta di
stop dell'utente è separata: vive nel flag `cancelRequested`.

## Stop: cancellazione cooperativa

Non si può "uccidere" dall'esterno codice già in esecuzione. Lo stop è
**cooperativo**: `cancel(id)` imposta solo `cancelRequested`; l'handler lo
controlla ai propri **checkpoint** con `ctx.throwIfCancelled()` e, se richiesto,
si ferma in modo pulito (stato → `cancelled`).

Conseguenza pratica: lo stop "morde" solo dove l'handler lo controlla. Un blocco
sincrono e lungo non si interrompe a metà — scrivi i job **a step**, con un
checkpoint a ogni iterazione (vedi `lib/jobs/handlers/demo.ts`).

> Nota: in questo starter non è previsto **pausa/ripresa** (solo stop). Per
> aggiungerli servirebbe un _checkpoint_ persistente da cui riprendere: vedi
> [Estensioni possibili](#estensioni-possibili).

## Aggiungere un nuovo tipo di operazione

Tre passi, nello spirito del [registry della ricerca](ricerca-globale.md):

**1. Crea l'handler** in `lib/jobs/handlers/<nome>.ts`. Valida il payload con Zod,
riporta l'avanzamento e rispetta i checkpoint di stop:

```ts
import { z } from "zod"
import type { JobHandler } from "@/lib/jobs/types"

const payloadSchema = z.object({ url: z.string().url() })
type Payload = z.infer<typeof payloadSchema>

export const scrapeHandler: JobHandler<Payload> = {
  type: "scrape-pagina",
  label: "Scrape di una pagina",
  parse: (raw) => payloadSchema.parse(raw),
  async run({ url }, ctx) {
    await ctx.log(`Scarico ${url}`)
    const pagine = await elencaPagine(url) // esempio
    for (let i = 0; i < pagine.length; i++) {
      await ctx.throwIfCancelled()              // checkpoint di stop
      await elabora(pagine[i])
      await ctx.report(Math.round(((i + 1) / pagine.length) * 100), `Pagina ${i + 1}/${pagine.length}`)
    }
  },
}
```

**2. Registralo** in `lib/jobs/registry.ts`, aggiungendolo all'array `handlers`.
Nient'altro: API e UI lo scoprono da soli (il tipo appare nel menu «Avvia»).

**3. (Facoltativo) Avvialo da codice** con `enqueue("scrape-pagina", { url })`.

Il `ctx` passato a `run` offre:

- `report(progress, message?)` — aggiorna avanzamento e nota in UI;
- `log(message)` — aggiunge una riga al log del job;
- `throwIfCancelled()` — solleva `JobCancelledError` se è stato chiesto lo stop;
- `jobId` — id del job in corso.

## Schedulare con un cron

Le schedulazioni vivono in `worker.ts`, nell'array `schedules`. Una voce, allo
scattare del cron, **non esegue** il lavoro: **accoda** un job del tipo indicato
(cron ed esecuzione restano disaccoppiati, e ogni run schedulato compare nella
lista job con il suo `scheduleKey`).

```ts
// worker.ts
const schedules = [
  { key: "scrape-giornaliero", cron: "0 3 * * *", type: "scrape-pagina",
    payload: { url: "https://esempio.it" } },
]
```

`cron` è la sintassi standard a 5 campi (`min ora giorno mese giorno-settimana`).
Le schedulazioni sono persistite da pg-boss e aggiornate in modo idempotente per
`key` a ogni avvio del worker; rimuovere una voce e riavviare la disattiva.

> Lo starter include come esempio `demo-giornaliero` (ogni giorno alle 03:00):
> rimuovilo da `schedules` quando non ti serve.

## In produzione

- Avvia il **worker** come processo/servizio a sé, sempre attivo, con lo stesso
  `DATABASE_URL` dell'app. In Docker: un secondo servizio dalla stessa immagine
  con comando `npm run worker` (l'app web resta invariata).
- Esegui **un solo** insieme di schedulazioni: il worker è già l'unico processo
  con scheduler e manutenzione attivi (il processo web li ha disattivati, vedi
  `lib/jobs/boss.ts`). Se avvii **più worker** per parallelismo, va benissimo per
  l'esecuzione, ma tieni i cron in uno solo (o accetta che siano idempotenti).
- pg-boss crea da sé lo schema `pgboss.*` al primo avvio: nessuna migrazione
  Prisma per la coda (la migrazione riguarda solo il modello applicativo `Job`).

## Estensioni possibili

- **Retry automatico**: pg-boss lo supporta nativamente; si espone passando
  opzioni di retry in `enqueue`/`boss.send` (oggi non attivo).
- **Pausa/ripresa**: aggiungere un campo _checkpoint_ a `Job` e farlo
  salvare/leggere all'handler per ripartire da dove si era fermato.
- **Avanzamento live (SSE)** al posto del polling, senza toccare modello né API.
- **Concorrenza**: aumentare `batchSize`/avviare più worker in `worker.ts`.
- **Cambiare engine** (es. BullMQ/Redis): riscrivere `lib/jobs/boss.ts`
  mantenendo invariata la firma usata dalla facade.
```
