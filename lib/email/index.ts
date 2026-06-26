import { ConsoleDriver } from "@/lib/email/console"
import type { EmailDriver, ResolvedEmailConfig } from "@/lib/email/driver"
import { SmtpDriver } from "@/lib/email/smtp"
import { getResolvedEmailConfig } from "@/lib/settings/email"

// Punto unico in cui si sceglie e si costruisce il driver email attivo. La
// config è RISOLTA da lib/settings/email.ts (GUI sopra .env): "console" logga il
// messaggio, "smtp" spedisce davvero. Per aggiungere un provider (Resend/SES/...)
// basta implementare EmailDriver e aggiungerlo a questo switch.
function createDriver(config: ResolvedEmailConfig): EmailDriver {
  switch (config.driver) {
    case "smtp":
      return new SmtpDriver(config)
    case "console":
      return new ConsoleDriver()
  }
}

// Il driver è costruito in modo pigro e memorizzato, ma legato a una
// "fingerprint" della config: se la config cambia (anche da GUI, senza riavvio)
// la fingerprint cambia e il driver viene ricostruito al primo invio successivo.
// Così una modifica delle credenziali si applica subito senza un singleton
// stale. La chiave resta in memoria di processo e non viene mai loggata.
let cached: { key: string; driver: EmailDriver } | undefined

async function getDriver(): Promise<EmailDriver> {
  const config = await getResolvedEmailConfig()
  const key = JSON.stringify(config)
  if (cached?.key !== key) {
    cached = { key, driver: createDriver(config) }
  }
  return cached.driver
}

export const email: EmailDriver = {
  send: async (message) => (await getDriver()).send(message),
}

export type { EmailDriver, EmailMessage } from "@/lib/email/driver"
