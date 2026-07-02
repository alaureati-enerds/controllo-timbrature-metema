import { decryptSecret, encryptSecret } from "@/lib/crypto"
import type { ResolvedEmailConfig } from "@/lib/email/driver"
import { env } from "@/lib/env"
import type {
  EmailSettings,
  EmailSettingsAdmin,
  EmailSettingsInput,
} from "@/lib/settings/schema"
import { getSystemSettings, updateSystemSettings } from "@/lib/settings/system"

// Service della config EMAIL di sistema. Vive nel blob del singleton (campo
// `email` di lib/settings/schema.ts), ma è server-only e tiene un segreto (la
// password) in forma cifrata. Regola di precedenza: la GUI (DB) PREVALE, .env fa
// da fallback campo per campo. L'autorizzazione (solo admin) sta a monte nei
// route handler, non qui. Vedi docs/email.md.

async function getPersisted(): Promise<EmailSettings> {
  return (await getSystemSettings()).email
}

// Config RISOLTA e in chiaro, pronta per il driver (lib/email/index.ts): per
// ogni campo "valore da GUI ?? valore da .env", con la password decifrata e il
// driver scelto in base all'ambiente se non impostato da nessuna parte.
export async function getResolvedEmailConfig(): Promise<ResolvedEmailConfig> {
  const db = await getPersisted()
  const driver =
    db.driver ??
    env.EMAIL_DRIVER ??
    (env.NODE_ENV === "production" ? "smtp" : "console")

  return {
    driver,
    from: db.from ?? env.EMAIL_FROM,
    host: db.host ?? env.SMTP_HOST,
    port: db.port ?? env.SMTP_PORT,
    secure: db.secure ?? env.SMTP_SECURE,
    user: db.user ?? env.SMTP_USER,
    password: db.passwordEnc ? decryptSecret(db.passwordEnc) : env.SMTP_PASSWORD,
  }
}

// Vista mascherata per il form admin: rispecchia i valori PERSISTITI (non i
// risolti), così il form modifica esattamente lo strato DB; un campo vuoto vuol
// dire "usa il fallback .env". La password non viene mai restituita.
export async function getEmailSettingsForAdmin(): Promise<EmailSettingsAdmin> {
  const db = await getPersisted()
  return {
    driver: db.driver ?? "default",
    from: db.from ?? "",
    host: db.host ?? "",
    port: db.port ?? null,
    secure: db.secure ?? false,
    user: db.user ?? "",
    passwordSet: Boolean(db.passwordEnc),
  }
}

// Salva la config email dal form admin. Costruisce l'oggetto `email` COMPLETO e
// lo passa a updateSystemSettings (merge shallow): i campi vuoti diventano
// `undefined` (→ fallback .env), la password si tocca solo se richiesto.
export async function updateEmailSettings(
  input: EmailSettingsInput
): Promise<EmailSettingsAdmin> {
  const current = await getPersisted()

  let passwordEnc = current.passwordEnc
  if (input.removePassword) passwordEnc = undefined
  else if (input.password) passwordEnc = encryptSecret(input.password)

  const next: EmailSettings = {
    driver: input.driver === "default" ? undefined : input.driver,
    from: input.from || undefined,
    host: input.host || undefined,
    port: input.port ?? undefined,
    secure: input.secure,
    user: input.user || undefined,
    passwordEnc,
  }

  await updateSystemSettings({ email: next })
  return getEmailSettingsForAdmin()
}
