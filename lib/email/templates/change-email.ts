import { button, layout } from "@/lib/email/templates/layout"
import type { EmailTemplate } from "@/lib/email/templates/types"

// Conferma del cambio email. La mail va alla NUOVA email: `newEmail` è il nuovo
// indirizzo, `actionUrl` il link che applica il cambiamento (vedi
// user.changeEmail in lib/auth.ts).
export const changeEmailTemplate: EmailTemplate = {
  id: "change-email",
  subject: "Conferma il tuo nuovo indirizzo email · {{appName}}",
  html: layout({
    bodyHtml: `
      <p>Ciao {{userName}},</p>
      <p>hai chiesto di usare <strong>{{newEmail}}</strong> come nuovo indirizzo email per il tuo account {{appName}}. Conferma per applicare il cambiamento.</p>
      <p style="margin:24px 0;">${button("Conferma nuovo indirizzo", "{{actionUrl}}")}</p>
      <p style="font-size:13px;color:#71717a;">Se il bottone non funziona, copia e incolla questo link nel browser:<br>{{actionUrl}}</p>
      <p style="font-size:13px;color:#71717a;">Se non hai richiesto tu il cambio, ignora questa email.</p>`,
  }),
  text: `Ciao {{userName}},

hai chiesto di usare {{newEmail}} come nuovo indirizzo email per il tuo account {{appName}}. Apri questo link per confermare il cambiamento:

{{actionUrl}}

Se non hai richiesto tu il cambio, ignora questa email.`,
  variables: ["appName", "userName", "newEmail", "actionUrl"],
}
