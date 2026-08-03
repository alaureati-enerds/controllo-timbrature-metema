import { z } from "zod"

import { ApiError, ok, safeHandler } from "@/lib/api"
import { requireTimbraturePermission } from "@/lib/timbrature/authz"
import { GIUSTIFICATIVO_CODICE_MAX } from "@/lib/timbrature/giustificativo-schema"
import { prisma } from "@/lib/prisma"

const getSchema = z.object({
  dipendente: z.string().min(1),
  mese: z.coerce.number().int().min(1).max(12),
  anno: z.coerce.number().int().min(2000).max(2100),
})

// Accetta HH:MM oppure "" (turno azzerato esplicitamente dalla correzione).
const oraSchema = z
  .string()
  .regex(/^(([01]\d|2[0-3]):[0-5]\d)?$/, "Formato orario non valido, usa HH:MM")
  .nullable()
  .optional()

const putSchema = z.object({
  dipendente: z.string().min(1),
  giorno: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entrata1: oraSchema,
  uscita1: oraSchema,
  entrata2: oraSchema,
  uscita2: oraSchema,
  // Segna il giorno come rivisto, a prescindere dalle anomalie (vedi schema.prisma).
  // Omesso: non tocca il flag esistente (bulk preset non deve resettarlo).
  revisionata: z.boolean().optional(),
  // Sigla del giustificativo di assenza (denormalizzata, vedi schema.prisma).
  // `null` lo rimuove, omesso NON lo tocca: stesso patto di `revisionata`.
  giustificativo: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(GIUSTIFICATIVO_CODICE_MAX)
    .nullable()
    .optional(),
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
      revisionata: true,
      giustificativo: true,
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

  // La sigla è denormalizzata (nessuna FK verso Giustificativo): questo è
  // l'unico presidio contro un codice inesistente, che resterebbe poi per
  // sempre nel badge e nella stampa. La UI manda solo codici dal dropdown, ma
  // l'API è raggiungibile da chiunque abbia `timbrature.update`.
  if (campi.giustificativo) {
    const esiste = await prisma.giustificativo.findUnique({
      where: { codice: campi.giustificativo },
      select: { id: true },
    })
    if (!esiste) throw new ApiError("Giustificativo non riconosciuto", 400)
  }

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
