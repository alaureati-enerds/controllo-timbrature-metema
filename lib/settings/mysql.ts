import { decryptSecret, encryptSecret } from "@/lib/crypto"
import type {
  MySqlSettings,
  MySqlSettingsAdmin,
  MySqlSettingsInput,
} from "@/lib/settings/schema"
import { getSystemSettings, updateSystemSettings } from "@/lib/settings/system"

async function getPersisted(): Promise<MySqlSettings> {
  return (await getSystemSettings()).mysql
}

export async function getMySqlSettingsForAdmin(): Promise<MySqlSettingsAdmin> {
  const db = await getPersisted()
  return {
    host: db.host ?? "",
    port: db.port ?? null,
    user: db.user ?? "",
    passwordSet: Boolean(db.passwordEnc),
    database: db.database ?? "",
  }
}

export async function updateMySqlSettings(
  input: MySqlSettingsInput
): Promise<MySqlSettingsAdmin> {
  const current = await getPersisted()

  let passwordEnc = current.passwordEnc
  if (input.removePassword) passwordEnc = undefined
  else if (input.password) passwordEnc = encryptSecret(input.password)

  const next: MySqlSettings = {
    host: input.host || undefined,
    port: input.port ?? undefined,
    user: input.user || undefined,
    passwordEnc,
    database: input.database || undefined,
  }

  await updateSystemSettings({ mysql: next })
  return getMySqlSettingsForAdmin()
}

export async function getResolvedMySqlConfig(): Promise<{
  host: string
  port: number
  user: string
  password: string
  database: string
}> {
  const db = await getPersisted()
  return {
    host: db.host ?? "127.0.0.1",
    port: db.port ?? 3306,
    user: db.user ?? "root",
    password: db.passwordEnc ? decryptSecret(db.passwordEnc) : "",
    database: db.database ?? "",
  }
}
