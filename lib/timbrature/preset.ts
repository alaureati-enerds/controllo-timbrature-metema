import { Prisma } from "@/lib/generated/prisma/client"

import { ApiError } from "@/lib/api"
import { prisma } from "@/lib/prisma"

// Logica di dominio per i preset di orario applicabili alle correzioni
// timbrature. Separata da route handler e UI, così è riusabile da Server
// Components o Route Handlers. Nessuna autorizzazione qui (vedi preset-authz.ts).
//
// NB: l'"Orario Standard" non è un preset salvato qui: resta nelle impostazioni
// di sistema (lib/settings/orario.ts) perché guida anche il calcolo dei turni.

export type TimbraturaPreset = {
  id: string
  nome: string
  entrata1: string | null
  uscita1: string | null
  entrata2: string | null
  uscita2: string | null
  createdAt: Date
  updatedAt: Date
}

export type PresetInput = {
  nome: string
  entrata1: string | null
  uscita1: string | null
  entrata2: string | null
  uscita2: string | null
}

export function listPresets(): Promise<TimbraturaPreset[]> {
  return prisma.timbraturaPreset.findMany({
    orderBy: { nome: "asc" },
  })
}

export function getPreset(id: string): Promise<TimbraturaPreset | null> {
  return prisma.timbraturaPreset.findUnique({ where: { id } })
}

// Traduce la violazione di unicità sul `nome` (P2002) in un errore 409 con un
// messaggio chiaro, invece del 500 generico di safeHandler.
function conflittoNome(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new ApiError("Esiste già un preset con questo nome", 409)
  }
  throw error
}

export function createPreset(data: PresetInput): Promise<TimbraturaPreset> {
  return prisma.timbraturaPreset.create({ data }).catch(conflittoNome)
}

export function updatePreset(
  id: string,
  data: PresetInput
): Promise<TimbraturaPreset> {
  return prisma.timbraturaPreset.update({ where: { id }, data }).catch(conflittoNome)
}

export function deletePreset(id: string): Promise<TimbraturaPreset> {
  return prisma.timbraturaPreset.delete({ where: { id } })
}
