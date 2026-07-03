import { z } from "zod"

import { ok, safeHandler } from "@/lib/api"
import { requireTimbraturePermission } from "@/lib/timbrature/authz"
import { prisma } from "@/lib/prisma"

const getSchema = z.object({
  dipendente: z.string().min(1),
  mese: z.coerce.number().int().min(1).max(12),
  anno: z.coerce.number().int().min(2000).max(2100),
})

const oraSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato orario non valido, usa HH:MM")
  .nullable()
  .optional()

const putSchema = z.object({
  dipendente: z.string().min(1),
  giorno: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entrata1: oraSchema,
  uscita1: oraSchema,
  entrata2: oraSchema,
  uscita2: oraSchema,
})

const deleteSchema = z.object({
  dipendente: z.string().min(1),
  giorno: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mese: z.coerce.number().int().min(1).max(12).optional(),
  anno: z.coerce.number().int().min(2000).max(2100).optional(),
})

// GET /api/admin/timbrature/correzioni?dipendente=X&mese=5&anno=2026
// Restituisce tutte le correzioni per il dipendente nel mese
export const GET = safeHandler(async (request) => {
  await requireTimbraturePermission("read")

  const params = Object.fromEntries(new URL(request.url).searchParams)
  const { dipendente, mese, anno } = getSchema.parse(params)

  const dal = `${anno}-${String(mese).padStart(2, "0")}-01`
  const al = `${anno}-${String(mese).padStart(2, "0")}-31`

  const righe = await prisma.timbraturaCorretta.findMany({
    where: {
      dipendente,
      giorno: { gte: dal, lte: al },
    },
    select: {
      giorno: true,
      entrata1: true,
      uscita1: true,
      entrata2: true,
      uscita2: true,
    },
  })

  return ok(righe)
})

// PUT /api/admin/timbrature/correzioni
// Crea o aggiorna una correzione per un giorno specifico
export const PUT = safeHandler(async (request) => {
  await requireTimbraturePermission("update")

  const body = await request.json()
  const { dipendente, giorno, ...campi } = putSchema.parse(body)

  await prisma.timbraturaCorretta.upsert({
    where: { dipendente_giorno: { dipendente, giorno } },
    create: { dipendente, giorno, ...campi },
    update: campi,
  })

  return ok({ saved: true })
})

// DELETE /api/admin/timbrature/correzioni
// Elimina correzioni: ?dipendente=X&giorno=2026-05-06 (singolo giorno)
// oppure ?dipendente=X&mese=5&anno=2026 (tutto il mese)
export const DELETE = safeHandler(async (request) => {
  await requireTimbraturePermission("update")

  const params = Object.fromEntries(new URL(request.url).searchParams)
  const { dipendente, giorno, mese, anno } = deleteSchema.parse(params)

  if (giorno) {
    await prisma.timbraturaCorretta.deleteMany({
      where: { dipendente, giorno },
    })
  } else if (mese && anno) {
    const dal = `${anno}-${String(mese).padStart(2, "0")}-01`
    const al = `${anno}-${String(mese).padStart(2, "0")}-31`

    await prisma.timbraturaCorretta.deleteMany({
      where: { dipendente, giorno: { gte: dal, lte: al } },
    })
  }

  return ok({ deleted: true })
})
