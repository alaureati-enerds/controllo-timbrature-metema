import nodemailer, { type Transporter } from "nodemailer"

import type {
  EmailDriver,
  EmailMessage,
  ResolvedEmailConfig,
} from "@/lib/email/driver"
import { logger } from "@/lib/logger"

// Driver di PRODUZIONE: spedisce via SMTP con Nodemailer. La config arriva già
// RISOLTA (GUI sopra .env, vedi lib/settings/email.ts): qui si valida solo che
// l'essenziale ci sia e si costruisce il transporter (riusato per più invii,
// pooling implicito di Nodemailer sulla connessione). La password è un segreto
// già in chiaro in memoria: non viene mai loggata.

type SmtpTransport = { transporter: Transporter; from: string }

/**
 * Valida la config risolta per l'SMTP e costruisce il transporter. Lancia un
 * errore chiaro se manca l'essenziale (host o mittente): un invio "smtp" senza
 * è un errore di configurazione, non un caso da gestire. L'autenticazione è
 * OPZIONALE: alcuni server non la richiedono (relay interno, Mailpit in dev). Se
 * `user` e `password` ci sono entrambe le usiamo, altrimenti niente auth.
 *
 * Esportata perché serve anche all'endpoint "email di prova"
 * (app/api/admin/settings/email/test): lì il transporter viene riusato per
 * fare `verify()` e mostrare all'admin l'eventuale errore reale.
 */
export function buildSmtpTransport(config: ResolvedEmailConfig): SmtpTransport {
  const missing: string[] = []
  if (!config.host) missing.push("host SMTP")
  if (!config.from) missing.push("mittente (from)")
  if (missing.length) {
    throw new Error(
      `Configurazione SMTP incompleta: mancano ${missing.join(", ")}. ` +
        `Impostali in Impostazioni di sistema → Email oppure in .env.`
    )
  }

  const auth =
    config.user && config.password
      ? { user: config.user, pass: config.password }
      : undefined

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth,
  })

  return { transporter, from: config.from! }
}

export class SmtpDriver implements EmailDriver {
  private readonly from: string
  private readonly transporter: Transporter

  constructor(config: ResolvedEmailConfig) {
    const { transporter, from } = buildSmtpTransport(config)
    this.transporter = transporter
    this.from = from
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
