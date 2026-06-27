import type { Job, JobStatus, Prisma } from "@/lib/generated/prisma/client"
import { ApiError } from "@/lib/api"
import { getBoss, JOBS_QUEUE } from "@/lib/jobs/boss"
import { getHandler } from "@/lib/jobs/registry"
import { JobCancelledError, type JobContext } from "@/lib/jobs/types"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"

// Superficie pubblica delle operazioni in background. Tutto il resto dell'app
// (API, UI, cron) usa SOLO queste funzioni e non sa nulla di pg-boss: l'engine
// resta sostituibile (vedi lib/jobs/boss.ts).

// Forma serializzabile di un job per il client (Date → ISO string).
export type JobView = {
  id: string
  type: string
  status: JobStatus
  progress: number
  message: string | null
  logs: string[]
  error: string | null
  cancelRequested: boolean
  scheduleKey: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

function toView(job: Job): JobView {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    progress: job.progress,
    message: job.message,
    logs: Array.isArray(job.logs) ? (job.logs as string[]) : [],
    error: job.error,
    cancelRequested: job.cancelRequested,
    scheduleKey: job.scheduleKey,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
  }
}

// Stati terminali: un job che li ha raggiunti non viene più eseguito né fermato.
const TERMINAL: JobStatus[] = ["completed", "failed", "cancelled"]

// Accoda una nuova operazione. Valida tipo e payload SUBITO (fail-fast): un
// payload errato viene rifiutato qui, non a metà esecuzione. Crea la riga Job
// (fonte di verità per la UI) e mette il lavoro nella coda pg-boss.
export async function enqueue(
  type: string,
  payload: unknown,
  options: { scheduleKey?: string } = {}
): Promise<JobView> {
  const handler = getHandler(type)
  if (!handler) throw new ApiError(`Tipo di job sconosciuto: ${type}`, 400)
  // parse() lancia ZodError su payload non valido → safeHandler lo traduce in 400.
  const parsed = handler.parse(payload)

  const job = await prisma.job.create({
    data: {
      type,
      payload: parsed as Prisma.InputJsonValue,
      scheduleKey: options.scheduleKey ?? null,
    },
  })

  const boss = await getBoss()
  await boss.send(JOBS_QUEUE, { jobId: job.id })
  logger.info(`Job accodato: ${type}`, { jobId: job.id })
  return toView(job)
}

// Richiede lo STOP di un job (cancellazione cooperativa). Imposta solo il flag:
// se il job è in coda non partirà, se è in esecuzione si fermerà al prossimo
// checkpoint dell'handler. No-op sui job già terminati.
export async function cancel(id: string): Promise<JobView> {
  const job = await prisma.job.findUnique({ where: { id } })
  if (!job) throw new ApiError("Job non trovato", 404)
  if (TERMINAL.includes(job.status)) return toView(job)
  const updated = await prisma.job.update({
    where: { id },
    data: { cancelRequested: true },
  })
  return toView(updated)
}

export async function getJob(id: string): Promise<JobView | null> {
  const job = await prisma.job.findUnique({ where: { id } })
  return job ? toView(job) : null
}

export async function listJobs(
  filter: { status?: JobStatus; type?: string; limit?: number } = {}
): Promise<JobView[]> {
  const jobs = await prisma.job.findMany({
    where: { status: filter.status, type: filter.type },
    orderBy: { createdAt: "desc" },
    take: Math.min(filter.limit ?? 50, 200),
  })
  return jobs.map(toView)
}

// ---------------------------------------------------------------------------
// Esecuzione (usata SOLO dal worker, vedi worker.ts). Carica la riga Job,
// costruisce il contesto, esegue l'handler e traduce l'esito in stato.
// ---------------------------------------------------------------------------

export async function executeJob(jobId: string): Promise<void> {
  const job = await prisma.job.findUnique({ where: { id: jobId } })
  if (!job) {
    logger.warn("Job inesistente ricevuto dalla coda", { jobId })
    return
  }
  // Già finito o ri-consegnato: niente da fare.
  if (TERMINAL.includes(job.status)) return
  // Stop chiesto mentre era ancora in coda: parte già annullato.
  if (job.cancelRequested) {
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "cancelled", finishedAt: new Date() },
    })
    return
  }

  const handler = getHandler(job.type)
  if (!handler) {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "failed",
        error: `Nessun handler per il tipo "${job.type}"`,
        finishedAt: new Date(),
      },
    })
    return
  }

  await prisma.job.update({
    where: { id: jobId },
    data: { status: "running", startedAt: new Date(), progress: 0 },
  })

  // Log accumulato in memoria e riscritto interamente a ogni riga: il job è
  // gestito da un solo worker alla volta (batchSize 1), niente race.
  const logs: string[] = Array.isArray(job.logs) ? [...(job.logs as string[])] : []
  const stamp = (m: string) => `[${new Date().toISOString()}] ${m}`

  const ctx: JobContext = {
    jobId,
    async report(progress, message) {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          progress: Math.max(0, Math.min(100, Math.round(progress))),
          message: message ?? null,
        },
      })
    },
    async log(message) {
      logs.push(stamp(message))
      await prisma.job.update({
        where: { id: jobId },
        data: { logs: logs as Prisma.InputJsonValue },
      })
    },
    async throwIfCancelled() {
      const fresh = await prisma.job.findUnique({
        where: { id: jobId },
        select: { cancelRequested: true },
      })
      if (fresh?.cancelRequested) throw new JobCancelledError()
    },
  }

  try {
    await handler.run(handler.parse(job.payload), ctx)
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "completed", progress: 100, finishedAt: new Date() },
    })
    logger.info(`Job completato: ${job.type}`, { jobId })
  } catch (error) {
    if (error instanceof JobCancelledError) {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "cancelled", finishedAt: new Date() },
      })
      logger.info(`Job annullato: ${job.type}`, { jobId })
      return
    }
    const message = error instanceof Error ? error.message : String(error)
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "failed", error: message, finishedAt: new Date() },
    })
    logger.error(`Job fallito: ${job.type}`, { jobId, error: message })
  }
}
