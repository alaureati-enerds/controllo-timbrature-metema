import { z } from "zod"

// Schema di validazione di un giustificativo di assenza, condiviso tra POST e
// PUT. Il `codice` è la sigla che finisce denormalizzata sulle giornate
// (TimbraturaCorretta.giustificativo) e stampata nel badge: normalizzata
// MAIUSCOLA e senza spazi, così «f» e «F» non diventano due codici diversi.

export const GIUSTIFICATIVO_CODICE_MAX = 10

export const giustificativoSchema = z.object({
  codice: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Il codice è obbligatorio")
    .max(
      GIUSTIFICATIVO_CODICE_MAX,
      `Il codice non può superare ${GIUSTIFICATIVO_CODICE_MAX} caratteri`
    )
    .regex(/^[A-Z0-9-]+$/, "Usa solo lettere, cifre e trattini"),
  descrizione: z.string().trim().min(1, "La descrizione è obbligatoria"),
})

export type GiustificativoSchemaInput = z.input<typeof giustificativoSchema>
export type GiustificativoSchemaOutput = z.output<typeof giustificativoSchema>
