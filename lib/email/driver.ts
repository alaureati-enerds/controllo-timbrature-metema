// Astrazione dell'invio email. I consumatori (lib/auth.ts e, in generale, ogni
// punto che spedisce una mail) parlano solo con questa interfaccia, mai con un
// SDK o un trasporto specifico: cambiare backend (console -> SMTP -> Resend/SES)
// significa scrivere un nuovo driver e scambiarlo in lib/email/index.ts, senza
// toccare i call site né i template.

/** Un messaggio email già renderizzato e pronto da spedire. */
export interface EmailMessage {
  /** Destinatario (un solo indirizzo: i flussi auth sono sempre 1:1). */
  to: string
  /** Oggetto della mail. */
  subject: string
  /** Corpo HTML. */
  html: string
  /** Corpo testuale alternativo (per client senza HTML e per la deliverability). */
  text: string
}

export interface EmailDriver {
  /** Spedisce il messaggio; lancia se l'invio fallisce. */
  send(message: EmailMessage): Promise<void>
}

// Config email già RISOLTA (GUI sopra .env) e in chiaro, prodotta da
// lib/settings/email.ts e consumata da lib/email/index.ts per costruire il
// driver. I campi opzionali possono mancare: il driver SMTP valida l'essenziale.
export interface ResolvedEmailConfig {
  /** Driver da usare per spedire. */
  driver: "console" | "smtp"
  /** Mittente di default ("Nome <indirizzo>" o solo l'indirizzo). */
  from?: string
  host?: string
  port: number
  /** TLS implicito (465) se true; STARTTLS (587) se false. */
  secure: boolean
  user?: string
  /** Password in chiaro (già decifrata). Mai loggata. */
  password?: string
}
