import { Prisma } from "@/lib/generated/prisma/client"

import { ApiError } from "@/lib/api"
import { prisma } from "@/lib/prisma"

// Logica di dominio per l'anagrafica dei giustificativi di assenza (F = Ferie,
// M = Malattia, L104, DONA, ...). Gemella di lib/timbrature/preset.ts:
// separata da route handler e UI, senza autorizzazione (vedi
// giustificativo-authz.ts).
//
// Le giornate conservano la sola SIGLA, denormalizzata in
// TimbraturaCorretta.giustificativo: nessuna FK, così una giornata archiviata
// resta leggibile anche se il codice viene eliminato da qui.

export type Giustificativo = {
  id: string
  codice: string
  descrizione: string
  createdAt: Date
  updatedAt: Date
}

export type GiustificativoInput = {
  codice: string
  descrizione: string
}

export function listGiustificativi(): Promise<Giustificativo[]> {
  return prisma.giustificativo.findMany({ orderBy: { codice: "asc" } })
}

export function getGiustificativo(id: string): Promise<Giustificativo | null> {
  return prisma.giustificativo.findUnique({ where: { id } })
}

// Traduce la violazione di unicità sul `codice` (P2002) in un errore 409 con un
// messaggio chiaro, invece del 500 generico di safeHandler.
function conflittoCodice(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new ApiError("Esiste già un giustificativo con questo codice", 409)
  }
  throw error
}

export function createGiustificativo(
  data: GiustificativoInput
): Promise<Giustificativo> {
  return prisma.giustificativo.create({ data }).catch(conflittoCodice)
}

/**
 * Aggiorna un giustificativo. Se cambia la SIGLA, riscrive in transazione anche
 * le giornate che la usavano: senza questo passaggio resterebbero legate a un
 * codice non più in anagrafica, orfane e senza descrizione. È il senso di una
 * rinomina — il prezzo di aver denormalizzato la sigla, pagato qui una volta
 * sola invece che con una FK che impedirebbe di cancellare i codici storici.
 */
export function updateGiustificativo(
  id: string,
  data: GiustificativoInput,
  codicePrecedente: string
): Promise<Giustificativo> {
  return prisma
    .$transaction(async (tx) => {
      const aggiornato = await tx.giustificativo.update({ where: { id }, data })
      if (data.codice !== codicePrecedente) {
        await tx.timbraturaCorretta.updateMany({
          where: { giustificativo: codicePrecedente },
          data: { giustificativo: data.codice },
        })
      }
      return aggiornato
    })
    .catch(conflittoCodice)
}

/**
 * Elimina un giustificativo dall'anagrafica. Le giornate che lo usavano NON
 * vengono toccate: continuano a valere zero ore e a mostrare la sigla, perdendo
 * solo la descrizione per esteso (badge e stampa ricadono sul codice nudo). È
 * esattamente il motivo per cui la sigla è denormalizzata: eliminare un codice
 * dall'anagrafica non deve poter riscrivere la storia delle presenze.
 */
export function deleteGiustificativo(id: string): Promise<Giustificativo> {
  return prisma.giustificativo.delete({ where: { id } })
}

/** Quante giornate usano una sigla: serve solo a informare prima di eliminare. */
export function contaGiornateGiustificate(codice: string): Promise<number> {
  return prisma.timbraturaCorretta.count({ where: { giustificativo: codice } })
}
