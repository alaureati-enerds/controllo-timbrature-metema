import { ok, parseJson, safeHandler } from "@/lib/api"
import { audit } from "@/lib/audit"
import { getSession } from "@/lib/auth-helpers"
import {
  getMySqlSettingsForAdmin,
  updateMySqlSettings,
} from "@/lib/settings/mysql"
import { requireSettingsPermission } from "@/lib/settings/authz"
import { mysqlSettingsInputSchema } from "@/lib/settings/schema"

export const GET = safeHandler(async () => {
  await requireSettingsPermission("read")
  return ok(await getMySqlSettingsForAdmin())
})

export const PUT = safeHandler(async (request) => {
  await requireSettingsPermission("update")
  const input = await parseJson(request, mysqlSettingsInputSchema)
  const result = await updateMySqlSettings(input)

  const session = await getSession()
  await audit({
    action: "system.mysql.update",
    actorId: session?.user.id,
    actorEmail: session?.user.email,
    metadata: { host: input.host || undefined },
    request,
  })

  return ok(result)
})
