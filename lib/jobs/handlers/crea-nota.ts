import { z } from "zod"

import { createNote } from "@/lib/notes"
import type { JobHandler } from "@/lib/jobs/types"

// Handler d'esempio REALE: crea una nota usando la stessa logica di dominio
// dell'app (lib/notes.createNote). Mostra il punto chiave dell'architettura:
// l'handler gira nel worker ma riusa i service condivisi e scrive nelle stesse
// tabelle, con la stessa ownership del resto del programma.
//
// `userId` NON arriva dal client: lo inietta la route API dalla sessione
// (vedi app/api/admin/jobs/route.ts e schedules/route.ts), così la nota è di
// proprietà di chi ha avviato/schedulato il job — esattamente come una nota
// creata dalla UI normale.
const payloadSchema = z.object({
  userId: z.string().min(1),
  text: z.string().min(1, "Il testo della nota è obbligatorio"),
})

export type CreaNotaPayload = z.infer<typeof payloadSchema>

export const creaNotaHandler: JobHandler<CreaNotaPayload> = {
  type: "crea-nota",
  label: "Crea una nota",
  // `userId` NON è un campo: lo inietta il server dalla sessione.
  fields: [
    {
      name: "text",
      label: "Testo della nota",
      type: "textarea",
      required: true,
      placeholder: "Contenuto della nota…",
    },
  ],
  parse: (raw) => payloadSchema.parse(raw),
  async run({ userId, text }, ctx) {
    await ctx.log(`Creo una nota per l'utente ${userId}`)
    const nota = await createNote(userId, text)
    await ctx.report(100, "Nota creata")
    await ctx.log(`Nota creata: ${nota.id}`)
  },
}
