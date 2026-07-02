import { createMySqlConnection } from "@/lib/mysql/client"
import { ApiError, ok, safeHandler } from "@/lib/api"
import { requireSettingsPermission } from "@/lib/settings/authz"

export const POST = safeHandler(async () => {
  await requireSettingsPermission("update")

  let connection: Awaited<ReturnType<typeof createMySqlConnection>> | undefined
  try {
    connection = await createMySqlConnection()
    await connection.execute("SELECT 1")
    return ok({ success: true })
  } catch (error) {
    const detail = error instanceof Error ? error.message : "errore sconosciuto"
    throw new ApiError(`Connessione fallita: ${detail}`, 502)
  } finally {
    if (connection) await connection.end().catch(() => {})
  }
})
