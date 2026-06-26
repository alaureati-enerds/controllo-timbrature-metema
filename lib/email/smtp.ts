import nodemailer, { type Transporter } from "nodemailer"

import type { EmailDriver, EmailMessage } from "@/lib/email/driver"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"

// Driver di PRODUZIONE: spedisce via SMTP con Nodemailer. Le credenziali sono
// segreti e vivono solo in .env (vedi lib/env.ts), mai nelle impostazioni di
// sistema. Il transporter è creato una sola volta e riusato (pooling implicito
// di Nodemailer sulla connessione).

/**
 * Verifica che le variabili SMTP necessarie siano presenti e ritorna una
 * configurazione tipata. Lancia un errore chiaro se manca l'essenziale: l'invio
 * "smtp" senza host o mittente è un errore di configurazione, non un caso da
 * gestire. L'autenticazione è OPZIONALE: alcuni server non la richiedono (es. un
 * relay interno o Mailpit in sviluppo). Se SMTP_USER e SMTP_PASSWORD ci sono
 * entrambe le usiamo, altrimenti si connette senza auth.
 */
function requireSmtpConfig() {
  const missing: string[] = []
  if (!env.SMTP_HOST) missing.push("SMTP_HOST")
  if (!env.EMAIL_FROM) missing.push("EMAIL_FROM")
  if (missing.length) {
    throw new Error(
      `Driver email "smtp" attivo ma mancano: ${missing.join(", ")}. ` +
        `Configurale in .env (vedi .env.example) o usa EMAIL_DRIVER="console".`
    )
  }
  const auth =
    env.SMTP_USER && env.SMTP_PASSWORD
      ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
      : undefined
  return {
    host: env.SMTP_HOST!,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth,
    from: env.EMAIL_FROM!,
  }
}

export class SmtpDriver implements EmailDriver {
  private readonly from: string
  private readonly transporter: Transporter

  constructor() {
    const config = requireSmtpConfig()
    this.from = config.from
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    })
  }

  async send(message: EmailMessage): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      })
    } catch (error) {
      // Logghiamo e rilanciamo: chi ha avviato il flusso (es. un signup) deve
      // sapere che l'email non è partita, ma senza esporre dettagli SMTP.
      logger.error(`[email] invio SMTP fallito a=${message.to}`, error)
      throw new Error("Invio email fallito")
    }
  }
}
