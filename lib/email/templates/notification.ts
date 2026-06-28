import { button, layout } from "@/lib/email/templates/layout"
import type { EmailTemplate } from "@/lib/email/templates/types"

// Template UNICO e generico per le notifiche recapitate via email (canale
// "email" delle notifiche, vedi lib/notifications/). A differenza dei template
// auth — uno per flusso — qui basta un guscio parametrico: titolo + corpo +
// bottone d'azione. Il contenuto specifico arriva da chi chiama `notify()`. Così
// aggiungere un tipo di notifica non richiede un nuovo template.
export const notificationTemplate: EmailTemplate = {
  id: "notification",
  subject: "{{title}} · {{appName}}",
  html: layout({
    bodyHtml: `
      <p>Ciao {{userName}},</p>
      <p style="font-weight:600;font-size:16px;margin:16px 0 8px;">{{title}}</p>
      <p style="margin:0 0 8px;">{{body}}</p>
      <p style="margin:24px 0;">${button("{{actionLabel}}", "{{actionUrl}}")}</p>
      <p style="font-size:13px;color:#71717a;">Puoi gestire quali notifiche ricevere via email dal tuo profilo.</p>`,
  }),
  text: `Ciao {{userName}},

{{title}}

{{body}}

{{actionLabel}}: {{actionUrl}}

Puoi gestire quali notifiche ricevere via email dal tuo profilo.`,
  variables: ["appName", "userName", "title", "body", "actionUrl", "actionLabel"],
}
