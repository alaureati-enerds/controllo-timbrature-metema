import { z } from "zod"

import { ORARIO_REGEX } from "@/lib/timbrature/ora"

// Schema di validazione di un preset di orario, condiviso tra POST e PUT.
// Le stringhe vuote sono normalizzate a null (turno lasciato vuoto).

const oraSchema = z
  .string()
  .transform((v) => (v.trim() === "" ? null : v.trim()))
  .nullable()
  .refine((v) => v === null || ORARIO_REGEX.test(v), {
    message: "Formato orario non valido, usa HH:MM",
  })

export const presetSchema = z
  .object({
    nome: z.string().trim().min(1, "Il nome è obbligatorio"),
    entrata1: oraSchema.default(null),
    uscita1: oraSchema.default(null),
    entrata2: oraSchema.default(null),
    uscita2: oraSchema.default(null),
  })
  .superRefine((data, ctx) => {
    // Ogni turno: entrata e uscita insieme, o nessuna delle due.
    for (const [entrata, uscita, turno] of [
      ["entrata1", "uscita1", "primo"],
      ["entrata2", "uscita2", "secondo"],
    ] as const) {
      const e = data[entrata]
      const u = data[uscita]
      if ((e === null) !== (u === null)) {
        ctx.addIssue({
          code: "custom",
          path: [e === null ? entrata : uscita],
          message: `Il ${turno} turno richiede sia l'entrata sia l'uscita`,
        })
      }
    }
    // Almeno un turno valorizzato.
    if (
      data.entrata1 === null &&
      data.uscita1 === null &&
      data.entrata2 === null &&
      data.uscita2 === null
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["entrata1"],
        message: "Compila almeno un turno",
      })
    }
  })

export type PresetSchemaInput = z.input<typeof presetSchema>
export type PresetSchemaOutput = z.output<typeof presetSchema>
