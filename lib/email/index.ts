import { ConsoleDriver } from "@/lib/email/console"
import type { EmailDriver } from "@/lib/email/driver"
import { SmtpDriver } from "@/lib/email/smtp"
import { env } from "@/lib/env"

// Punto unico in cui si sceglie il driver email attivo, gemello di
// lib/storage/index.ts. La scelta segue EMAIL_DRIVER se impostato, altrimenti
// il default per ambiente: "console" in sviluppo (le email finiscono nei log),
// "smtp" in produzione. Per passare a un altro provider (Resend/SES/...) basta
// implementare EmailDriver e aggiungerlo qui: nient'altro nel codebase cambia.
function selectDriver(): EmailDriver {
  const driver =
    env.EMAIL_DRIVER ?? (env.NODE_ENV === "production" ? "smtp" : "console")

  switch (driver) {
    case "smtp":
      return new SmtpDriver()
    case "console":
      return new ConsoleDriver()
  }
}

// Istanza creata in modo pigro: il driver SMTP costruisce il transporter e
// valida le credenziali nel costruttore, e non vogliamo che ciò accada (né
// fallisca) al solo import del modulo, ma alla prima vera spedizione.
let instance: EmailDriver | undefined

export const email: EmailDriver = {
  send: (message) => (instance ??= selectDriver()).send(message),
}

export type { EmailDriver, EmailMessage } from "@/lib/email/driver"
