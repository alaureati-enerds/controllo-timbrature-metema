import type { EmailMessage } from "@/lib/email/driver"
import { escapeHtml, render, type TemplateVars } from "@/lib/email/render"
import { changeEmailTemplate } from "@/lib/email/templates/change-email"
import { deleteAccountTemplate } from "@/lib/email/templates/delete-account"
import { notificationTemplate } from "@/lib/email/templates/notification"
import { resetPasswordTemplate } from "@/lib/email/templates/reset-password"
import type { EmailTemplate } from "@/lib/email/templates/types"
import { verifyEmailTemplate } from "@/lib/email/templates/verify-email"

// Registry dei template email di sistema. La chiave è l'id del template; il
// valore è la sua sorgente di default (versionata in git). Aggiungere un
// template: crea il file in questa cartella e registralo qui.
const TEMPLATES = {
  [verifyEmailTemplate.id]: verifyEmailTemplate,
  [resetPasswordTemplate.id]: resetPasswordTemplate,
  [changeEmailTemplate.id]: changeEmailTemplate,
  [deleteAccountTemplate.id]: deleteAccountTemplate,
  [notificationTemplate.id]: notificationTemplate,
} satisfies Record<string, EmailTemplate>

export type EmailTemplateId = keyof typeof TEMPLATES

/**
 * Risolve la SORGENTE di un template per id. Oggi ritorna sempre il default in
 * codice; è il punto di estensione per gli override: quando esisterà un editor
 * frontend che salva versioni personalizzate a DB, qui si cercherà prima
 * l'override e si ricadrà sul default. La firma è già `async` apposta, così
 * introdurre la lettura dal DB non toccherà i call site.
 */
async function resolveTemplate(id: EmailTemplateId): Promise<EmailTemplate> {
  return TEMPLATES[id]
}

/**
 * Renderizza un template auth in un messaggio pronto da spedire (senza `to`).
 * Riceve i valori GREZZI: per il corpo HTML vengono escapati (così un nome con
 * `<` o `&` non rompe né inietta markup), mentre oggetto e corpo testuale usano
 * i valori così come sono (lì l'escape corromperebbe gli URL). `render()` lancia
 * se manca un segnaposto, quindi un contesto incompleto fallisce subito invece
 * di spedire una mail con un buco visibile.
 */
export async function renderTemplate(
  id: EmailTemplateId,
  vars: TemplateVars
): Promise<Omit<EmailMessage, "to">> {
  const template = await resolveTemplate(id)
  const htmlVars: TemplateVars = Object.fromEntries(
    Object.entries(vars).map(([key, value]) => [key, escapeHtml(value)])
  )
  return {
    subject: render(template.subject, vars),
    html: render(template.html, htmlVars),
    text: render(template.text, vars),
  }
}
