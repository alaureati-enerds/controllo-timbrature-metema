import { notFound, ok, parseJson, safeHandler } from "@/lib/api"
import { audit } from "@/lib/audit"
import { getSession } from "@/lib/auth-helpers"
import { deletePreset, getPreset, updatePreset } from "@/lib/timbrature/preset"
import { presetSchema } from "@/lib/timbrature/preset-schema"
import { requirePresetPermission } from "@/lib/timbrature/preset-authz"

type Ctx = { params: Promise<{ id: string }> }

// PUT /api/admin/presets/[id] — aggiorna un preset.
export const PUT = safeHandler(async (request, context) => {
  await requirePresetPermission("update")
  const { id } = await (context as Ctx).params
  const data = await parseJson(request, presetSchema)

  if (!(await getPreset(id))) throw notFound("Preset non trovato")
  const preset = await updatePreset(id, data)

  const session = await getSession()
  await audit({
    action: "timbrature.preset.update",
    actorId: session?.user.id,
    actorEmail: session?.user.email,
    target: { type: "timbratura_preset", id: preset.id, label: preset.nome },
    request,
  })

  return ok(preset)
})

// DELETE /api/admin/presets/[id] — elimina un preset.
export const DELETE = safeHandler(async (request, context) => {
  await requirePresetPermission("delete")
  const { id } = await (context as Ctx).params

  const preset = await getPreset(id)
  if (!preset) throw notFound("Preset non trovato")
  await deletePreset(id)

  const session = await getSession()
  await audit({
    action: "timbrature.preset.delete",
    actorId: session?.user.id,
    actorEmail: session?.user.email,
    target: { type: "timbratura_preset", id: preset.id, label: preset.nome },
    request,
  })

  return ok({ deleted: true })
})
