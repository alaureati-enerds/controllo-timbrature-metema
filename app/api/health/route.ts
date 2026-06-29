import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

// Health check: verifica che il backend risponda E che il database sia
// raggiungibile. È usato dall'healthcheck di Docker (vedi docs/deploy-docker.md),
// quindi deve FALLIRE (503) quando il DB è giù — non limitarsi a dire "ok",
// altrimenti l'orchestratore terrebbe in vita un container di fatto inservibile.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return Response.json({ status: "ok", database: "up" })
  } catch (error) {
    logger.error("Health check fallito: database non raggiungibile", error)
    return Response.json({ status: "error", database: "down" }, { status: 503 })
  }
}
