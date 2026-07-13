import { ok, parseJson, safeHandler } from "@/lib/api"
import { audit } from "@/lib/audit"
import { getSession } from "@/lib/auth-helpers"
import { requireSettingsPermission } from "@/lib/settings/authz"
import { stampaSettingsInputSchema } from "@/lib/settings/schema"
import { getStampaSettings, updateStampaSettings } from "@/lib/settings/stampa"

export const GET = safeHandler(async () => {
  await requireSettingsPermission("read")
  return ok(await getStampaSettings())
})

export const PUT = safeHandler(async (request) => {
  await requireSettingsPermission("update")
  const input = await parseJson(request, stampaSettingsInputSchema)
  const result = await updateStampaSettings(input)

  const session = await getSession()
  await audit({
    action: "system.stampa.update",
    actorId: session?.user.id,
    actorEmail: session?.user.email,
    metadata: { templateId: result.templateId },
    request,
  })

  return ok(result)
})
