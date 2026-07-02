import { ok, safeHandler, unauthorized } from "@/lib/api"
import { getSession } from "@/lib/auth-helpers"
import { createUserFile, deleteUserFile } from "@/lib/files"
import { IMAGE_MIME_TYPES, readUpload } from "@/lib/upload"

// Limite dedicato all'avatar: più stretto dei file generici (un'immagine di
// profilo non ha motivo di pesare decine di MB).
const MAX_AVATAR_SIZE = 5 * 1024 * 1024 // 5 MB

// Estrae l'id di un file servito da /api/files/:id, per ripulire il vecchio
// avatar quando ne viene caricato uno nuovo. Restituisce null se l'URL non è
// uno dei nostri file (es. un avatar esterno impostato altrove).
function fileIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const match = /^\/api\/files\/([^/?#]+)$/.exec(url)
  return match ? match[1] : null
}

// POST /api/me/avatar — carica l'immagine del profilo (solo immagini, max 5 MB).
// Salva un file di proprietà dell'utente e rimuove il precedente avatar, se era
// un file caricato da noi. Non scrive `user.image`: lo fa il client via
// `authClient.updateUser`, così la sessione resta sincronizzata.
export const POST = safeHandler(async (request) => {
  const session = await getSession()
  if (!session) throw unauthorized()

  const upload = await readUpload(request, {
    maxSize: MAX_AVATAR_SIZE,
    allowedTypes: IMAGE_MIME_TYPES,
  })
  const file = await createUserFile(session.user.id, upload)

  // Pulizia best-effort del vecchio avatar: non deve far fallire l'upload.
  const previousId = fileIdFromUrl(session.user.image)
  if (previousId) {
    await deleteUserFile(session.user.id, previousId).catch(() => {})
  }

  return ok({ id: file.id, url: `/api/files/${file.id}` }, { status: 201 })
})
