import { z } from "zod"

import { logger } from "@/lib/logger"

// Helper per risposte API coerenti dai Route Handlers. Unificano la forma del
// JSON (successo vs errore) e centralizzano la gestione delle eccezioni, così
// ogni endpoint resta sottile e prevedibile.

/** Risposta di successo: il payload è serializzato così com'è. */
export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, init)
}

/** Risposta di errore uniforme: `{ error, details? }` con lo status indicato. */
export function fail(
  message: string,
  status = 400,
  details?: unknown
): Response {
  return Response.json({ error: message, details }, { status })
}

/** Errore applicativo con status HTTP esplicito, gestito da `safeHandler`. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
    public details?: unknown
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export const unauthorized = (msg = "Non autenticato") => new ApiError(msg, 401)
export const forbidden = (msg = "Permesso negato") => new ApiError(msg, 403)
export const notFound = (msg = "Risorsa non trovata") => new ApiError(msg, 404)

type Handler = (request: Request, context: unknown) => Promise<Response>

/**
 * Avvolge un Route Handler: traduce ZodError → 400 con dettagli, ApiError →
 * status dedicato, e qualsiasi altra eccezione → 500 (loggata), evitando di
 * esporre stack trace al client.
 */
export function safeHandler(handler: Handler): Handler {
  return async (request, context) => {
    try {
      return await handler(request, context)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return fail("Dati non validi", 400, z.treeifyError(error))
      }
      if (error instanceof ApiError) {
        return fail(error.message, error.status, error.details)
      }
      logger.error("Errore non gestito in un route handler", error)
      return fail("Errore interno del server", 500)
    }
  }
}

/** Legge e valida il body JSON con uno schema Zod; lancia su body o dati errati. */
export async function parseJson<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<T> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new ApiError("Corpo JSON non valido", 400)
  }
  return schema.parse(body)
}
