import { ok, safeHandler, unauthorized } from "@/lib/api"
import { getSession } from "@/lib/auth-helpers"
import { createUserFile, listUserFiles } from "@/lib/files"
import { MAX_USER_FILE_SIZE, readUpload } from "@/lib/upload"

// GET /api/files — elenco dei file dell'utente autenticato
export const GET = safeHandler(async () => {
  const session = await getSession()
  if (!session) throw unauthorized()

  return ok(await listUserFiles(session.user.id))
})

// POST /api/files — upload di un file di proprietà dell'utente (multipart, campo
// "file"). Nessun vincolo di tipo: è uno store generico; solo un limite di
// dimensione.
export const POST = safeHandler(async (request) => {
  const session = await getSession()
  if (!session) throw unauthorized()

  const upload = await readUpload(request, { maxSize: MAX_USER_FILE_SIZE })
  const file = await createUserFile(session.user.id, upload)
  return ok(file, { status: 201 })
})
