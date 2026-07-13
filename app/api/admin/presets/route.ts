import { ok, parseJson, safeHandler } from "@/lib/api"
import { audit } from "@/lib/audit"
import { getSession } from "@/lib/auth-helpers"
import { createPreset, listPresets } from "@/lib/timbrature/preset"
import { presetSchema } from "@/lib/timbrature/preset-schema"
import { requirePresetPermission } from "@/lib/timbrature/preset-authz"

// GET /api/admin/presets — elenco dei preset di orario.
export const GET = safeHandler(async () => {
  await requirePresetPermission("read")
  return ok(await listPresets())
})

// POST /api/admin/presets — crea un preset.
export const POST = safeHandler(async (request) => {
  await requirePresetPermission("create")
  const data = await parseJson(request, presetSchema)
  const preset = await createPreset(data)

  const session = await getSession()
  await audit({
    action: "timbrature.preset.create",
    actorId: session?.user.id,
    actorEmail: session?.user.email,
    target: { type: "timbratura_preset", id: preset.id, label: preset.nome },
    request,
  })

  return ok(preset, { status: 201 })
})
