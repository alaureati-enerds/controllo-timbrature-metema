import "dotenv/config" // carica .env: il worker gira via tsx, fuori da Next
import "@/lib/env" // valida le variabili d'ambiente all'avvio (fail-fast)

import { type Job } from "pg-boss"

import { JOBS_QUEUE, SCHEDULE_QUEUE, startWorkerBoss } from "@/lib/jobs/boss"
import { enqueue, executeJob } from "@/lib/jobs"
import { logger } from "@/lib/logger"

// Processo WORKER delle operazioni in background. Va eseguito ACCANTO all'app
// Next (`npm run worker`), come processo separato e sempre attivo: l'app web
// accoda i job, il worker li esegue. In produzione (Docker) è un servizio a sé
// che condivide lo stesso DATABASE_URL.
//
// Responsabilità:
//  - consuma la coda JOBS_QUEUE → esegue il job (lib/jobs/executeJob);
//  - consuma la coda SCHEDULE_QUEUE → accoda un job (bridge dei cron);
//  - registra le SCHEDULAZIONI cron (vedi schedules qui sotto).

// Schedulazioni cron. Ogni voce, all'orario indicato, NON esegue il lavoro ma
// accoda un job del tipo dato: cron ed esecuzione restano disaccoppiati e ogni
// run schedulato compare nella stessa lista job (con il suo scheduleKey).
// Sintassi cron standard a 5 campi (min ora giorno mese giorno-settimana).
// Per aggiungere uno scrape giornaliero: { key, cron, type, payload }.
const schedules: {
  key: string
  cron: string
  type: string
  payload: unknown
}[] = [
  // ESEMPIO (rimuovibile): ogni giorno alle 03:00 accoda l'operazione demo.
  {
    key: "demo-giornaliero",
    cron: "0 3 * * *",
    type: "demo",
    payload: { steps: 5, stepMs: 1000 },
  },
]

async function main() {
  const boss = await startWorkerBoss()

  // Coda di esecuzione: un job alla volta per worker (batchSize 1), così
  // l'avanzamento e lo stop restano semplici da ragionare. Per più parallelismo
  // si aumenta batchSize o si avviano più worker.
  await boss.work(
    JOBS_QUEUE,
    { batchSize: 1 },
    async (jobs: Job<{ jobId: string }>[]) => {
      for (const job of jobs) await executeJob(job.data.jobId)
    }
  )

  // Bridge dei cron: ciò che le schedulazioni inseriscono qui viene trasformato
  // in un vero Job tramite la facade (crea la riga + accoda su JOBS_QUEUE).
  await boss.work(
    SCHEDULE_QUEUE,
    { batchSize: 1 },
    async (
      jobs: Job<{ type: string; payload: unknown; scheduleKey: string }>[]
    ) => {
      for (const job of jobs) {
        const { type, payload, scheduleKey } = job.data
        await enqueue(type, payload, { scheduleKey })
      }
    }
  )

  // Registra/aggiorna le schedulazioni cron DEFINITE NEL CODICE (idempotente per
  // chiave). Convivono con quelle create da UI (lib/jobs.scheduleJob), che
  // vivono solo nel DB: qui la `key` le tiene distinte. NB: una schedulazione da
  // codice viene ri-applicata a ogni avvio del worker (il codice è la sua fonte
  // di verità); se la elimini da UI, riapparirà al riavvio finché resta qui.
  for (const s of schedules) {
    await boss.schedule(
      SCHEDULE_QUEUE,
      s.cron,
      { type: s.type, payload: s.payload, scheduleKey: s.key },
      { key: s.key }
    )
  }

  logger.info("Worker job avviato", {
    queues: [JOBS_QUEUE, SCHEDULE_QUEUE],
    schedules: schedules.map((s) => `${s.key} (${s.cron})`),
  })

  // Spegnimento ordinato: pg-boss finisce i job in corso prima di chiudere.
  const shutdown = async (signal: string) => {
    logger.info(`Ricevuto ${signal}, arresto del worker…`)
    await boss.stop({ graceful: true })
    process.exit(0)
  }
  process.on("SIGINT", () => void shutdown("SIGINT"))
  process.on("SIGTERM", () => void shutdown("SIGTERM"))
}

main().catch((error) => {
  logger.error("Avvio del worker fallito", error)
  process.exit(1)
})
