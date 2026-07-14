import { ok, parseJson, safeHandler } from "@/lib/api"
import { audit } from "@/lib/audit"
import { getSession } from "@/lib/auth-helpers"
import {
  getCalcoloSettingsForAdmin,
  updateCalcoloSettings,
} from "@/lib/settings/calcolo"
import { requireSettingsPermission } from "@/lib/settings/authz"
import { calcoloSettingsInputSchema } from "@/lib/settings/schema"

export const GET = safeHandler(async () => {
  await requireSettingsPermission("read")
  return ok(await getCalcoloSettingsForAdmin())
})

export const PUT = safeHandler(async (request) => {
  await requireSettingsPermission("update")
  const input = await parseJson(request, calcoloSettingsInputSchema)
  const result = await updateCalcoloSettings(input)

  const session = await getSession()
  await audit({
    action: "system.calcolo.update",
    actorId: session?.user.id,
    actorEmail: session?.user.email,
    request,
  })

  return ok(result)
})
