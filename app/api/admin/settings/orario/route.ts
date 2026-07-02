import { ok, parseJson, safeHandler } from "@/lib/api"
import { audit } from "@/lib/audit"
import { getSession } from "@/lib/auth-helpers"
import {
  getOrarioSettingsForAdmin,
  updateOrarioSettings,
} from "@/lib/settings/orario"
import { requireSettingsPermission } from "@/lib/settings/authz"
import { orarioLavoroSettingsInputSchema } from "@/lib/settings/schema"

export const GET = safeHandler(async () => {
  await requireSettingsPermission("read")
  return ok(await getOrarioSettingsForAdmin())
})

export const PUT = safeHandler(async (request) => {
  await requireSettingsPermission("update")
  const input = await parseJson(request, orarioLavoroSettingsInputSchema)
  const result = await updateOrarioSettings(input)

  const session = await getSession()
  await audit({
    action: "system.orario.update",
    actorId: session?.user.id,
    actorEmail: session?.user.email,
    request,
  })

  return ok(result)
})
