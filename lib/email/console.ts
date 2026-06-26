import type { EmailDriver, EmailMessage } from "@/lib/email/driver"
import { logger } from "@/lib/logger"

// Driver di SVILUPPO: non spedisce nulla, scrive il messaggio nei log del
// server. Replica il comportamento storico (i link di verifica/reset finivano
// nei log) ma passando dalla stessa interfaccia del driver reale, così il
// percorso del codice è identico in dev e in produzione: cambia solo il
// trasporto. Estrae i link dal corpo per renderli subito cliccabili nei log.
export class ConsoleDriver implements EmailDriver {
  async send(message: EmailMessage): Promise<void> {
    const links = extractLinks(message.text + " " + message.html)
    logger.info(
      `[email] (console) a=${message.to} oggetto="${message.subject}"` +
        (links.length ? ` link=${links.join(" ")}` : "")
    )
  }
}

/** Estrae gli URL http(s) da un testo, deduplicati e nell'ordine d'apparizione. */
function extractLinks(content: string): string[] {
  const matches = content.match(/https?:\/\/[^\s"'<>]+/g) ?? []
  return [...new Set(matches)]
}
