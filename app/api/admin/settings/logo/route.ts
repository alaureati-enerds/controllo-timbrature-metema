import { ok, safeHandler } from "@/lib/api"
import { createSystemFile, deleteFile, findFile } from "@/lib/files"
import { requireSettingsPermission } from "@/lib/settings/authz"
import { getSystemSettings, updateSystemSettings } from "@/lib/settings/system"
import { IMAGE_MIME_TYPES, MAX_LOGO_SIZE, readUpload } from "@/lib/upload"

// Gestione del logo come FILE DI SISTEMA (admin scrive, tutti leggono). Tenuto
// separato dal PUT JSON delle altre impostazioni perché è un upload multipart.
// Il riferimento (logoFileId) vive nelle impostazioni; i byte nel modello File.

// POST /api/admin/settings/logo — carica un nuovo logo e lo collega; rimuove il
// file del logo precedente, se c'era, per non lasciare orfani.
export const POST = safeHandler(async (request) => {
  await requireSettingsPermission("update")

  const upload = await readUpload(request, {
    maxSize: MAX_LOGO_SIZE,
    allowedTypes: IMAGE_MIME_TYPES,
  })

  const previous = (await getSystemSettings()).logoFileId
  const file = await createSystemFile(upload)
  await updateSystemSettings({ logoFileId: file.id })

  if (previous && previous !== file.id) {
    const old = await findFile(previous)
    if (old) await deleteFile(old)
  }

  return ok({ logoFileId: file.id }, { status: 201 })
})

// DELETE /api/admin/settings/logo — rimuove il logo corrente (torna all'icona).
export const DELETE = safeHandler(async () => {
  await requireSettingsPermission("update")

  const previous = (await getSystemSettings()).logoFileId
  if (previous) {
    await updateSystemSettings({ logoFileId: null })
    const old = await findFile(previous)
    if (old) await deleteFile(old)
  }

  return ok({ logoFileId: null })
})
