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
