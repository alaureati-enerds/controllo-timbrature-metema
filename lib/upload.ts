import { ApiError } from "@/lib/api"

// Lettura e validazione di un upload multipart (campo file di un FormData),
// condivisa tra l'upload del logo (admin) e quello dei file utente. Centralizza
// i limiti e i controlli così le route restano sottili.

export const IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
]

// Limiti di default. Valori prudenti per uno starter; alzali se serve.
export const MAX_LOGO_SIZE = 2 * 1024 * 1024 // 2 MB
export const MAX_USER_FILE_SIZE = 25 * 1024 * 1024 // 25 MB

export type ParsedUpload = {
  buffer: Buffer
  mimeType: string
  originalName: string | null
}

export async function readUpload(
  request: Request,
  opts: { field?: string; maxSize: number; allowedTypes?: readonly string[] }
): Promise<ParsedUpload> {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    throw new ApiError("Richiesta multipart non valida", 400)
  }

  const value = form.get(opts.field ?? "file")
  if (!(value instanceof Blob)) {
    throw new ApiError("Nessun file caricato", 400)
  }
  if (value.size === 0) {
    throw new ApiError("Il file è vuoto", 400)
  }
  if (value.size > opts.maxSize) {
    const mb = Math.round(opts.maxSize / 1024 / 1024)
    throw new ApiError(`File troppo grande (max ${mb} MB)`, 413)
  }

  const mimeType = value.type || "application/octet-stream"
  if (opts.allowedTypes && !opts.allowedTypes.includes(mimeType)) {
    throw new ApiError(`Tipo di file non consentito: ${mimeType}`, 415)
  }

  const buffer = Buffer.from(await value.arrayBuffer())
  // I Blob veri (web File) hanno `name`; alcuni runtime no.
  const originalName =
    "name" in value && typeof value.name === "string" ? value.name : null

  return { buffer, mimeType, originalName }
}
