import { button, layout } from "@/lib/email/templates/layout"
import type { EmailTemplate } from "@/lib/email/templates/types"

// Verifica dell'indirizzo email dopo la registrazione. `actionUrl` è il link di
// conferma generato da Better Auth (vedi emailVerification in lib/auth.ts).
export const verifyEmailTemplate: EmailTemplate = {
  id: "verify-email",
  subject: "Conferma il tuo indirizzo email · {{appName}}",
  html: layout({
    bodyHtml: `
      <p>Ciao {{userName}},</p>
      <p>per completare la registrazione su {{appName}}, conferma il tuo indirizzo email.</p>
      <p style="margin:24px 0;">${button("Conferma indirizzo", "{{actionUrl}}")}</p>
      <p style="font-size:13px;color:#71717a;">Se il bottone non funziona, copia e incolla questo link nel browser:<br>{{actionUrl}}</p>`,
  }),
  text: `Ciao {{userName}},

per completare la registrazione su {{appName}}, conferma il tuo indirizzo email aprendo questo link:

{{actionUrl}}

Se non hai creato tu un account, ignora questa email.`,
  variables: ["appName", "userName", "actionUrl"],
}
