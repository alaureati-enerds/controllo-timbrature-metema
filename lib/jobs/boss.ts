import { PgBoss, type ConstructorOptions } from "pg-boss"

import { logger } from "@/lib/logger"

// Engine della coda dei job. È l'UNICO punto che conosce pg-boss: facade
// (lib/jobs/index.ts), worker e UI parlano con le funzioni qui sotto, mai con
// pg-boss direttamente. Sostituire engine (pg-boss → BullMQ/...) significa
// riscrivere questo file e tenere invariata la firma di getBoss()/le code.
//
// pg-boss usa lo STESSO database dell'app (DATABASE_URL) creandosi uno schema
// dedicato `pgboss.*` al primo avvio: nessuna infrastruttura aggiuntiva.

// Nomi delle code (uno spazio dei nomi interno a pg-boss, distinto dal modello
// Job applicativo):
//  - JOBS_QUEUE: esecuzione vera e propria. Trasporta solo { jobId }; lo stato
//    ricco vive nella riga Job (vedi lib/jobs/index.ts).
//  - SCHEDULE_QUEUE: bersaglio dei cron. Non esegue il lavoro: accoda un Job.
//    Tiene cron ed esecuzione disaccoppiati (vedi worker.ts).
export const JOBS_QUEUE = "jobs"
export const SCHEDULE_QUEUE = "schedule"

// Un'istanza di pg-boss apre connessioni e timer: come per Prisma, in sviluppo
// Next ricarica i moduli a ogni modifica, quindi riusiamo un'unica istanza
// salvata su globalThis per non accumulare connessioni e scheduler.
const globalForBoss = globalThis as unknown as {
  bossStart: Promise<PgBoss> | undefined
}

async function start(options: ConstructorOptions): Promise<PgBoss> {
  const boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    ...options,
  })
  // pg-boss emette "error" per problemi di fondo (es. connessione persa): va
  // ascoltato, altrimenti diventa un'eccezione non gestita che termina il
  // processo. Lo logghiamo e lasciamo che pg-boss riprovi.
  boss.on("error", (error: Error) => logger.error("Errore pg-boss", error))
  await boss.start()
  // Le code vanno create esplicitamente prima di send()/work() (pg-boss v10+).
  // È idempotente: si può chiamare a ogni avvio.
  await boss.createQueue(JOBS_QUEUE)
  await boss.createQueue(SCHEDULE_QUEUE)
  return boss
}

// Istanza per il PROCESSO WEB (Next.js): solo invio. Niente manutenzione
// (`supervise`) né scheduler (`schedule`): di quelli si occupa il worker, così
// i cron non vengono valutati due volte e il processo web resta leggero.
export function getBoss(): Promise<PgBoss> {
  if (!globalForBoss.bossStart) {
    globalForBoss.bossStart = start({ supervise: false, schedule: false })
  }
  return globalForBoss.bossStart
}

// Istanza per il PROCESSO WORKER (worker.ts): manutenzione e scheduler attivi.
// Popola lo stesso slot singleton, così le chiamate a enqueue() fatte dentro il
// worker (es. dal gestore dei cron) riusano questa istanza invece di aprirne
// un'altra.
export function startWorkerBoss(): Promise<PgBoss> {
  if (!globalForBoss.bossStart) {
    globalForBoss.bossStart = start({ supervise: true, schedule: true })
  }
  return globalForBoss.bossStart
}
