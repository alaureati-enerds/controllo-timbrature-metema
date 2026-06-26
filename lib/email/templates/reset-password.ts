import { button, layout } from "@/lib/email/templates/layout"
import type { EmailTemplate } from "@/lib/email/templates/types"

// Reset della password (flusso "password dimenticata"). `actionUrl` è il link
// di reset generato da Better Auth (vedi sendResetPassword in lib/auth.ts).
export const resetPasswordTemplate: EmailTemplate = {
  id: "reset-password",
  subject: "Reimposta la tua password · {{appName}}",
  html: layout({
    bodyHtml: `
      <p>Ciao {{userName}},</p>
      <p>abbiamo ricevuto una richiesta di reimpostazione della password del tuo account {{appName}}.</p>
      <p style="margin:24px 0;">${button("Reimposta password", "{{actionUrl}}")}</p>
      <p style="font-size:13px;color:#71717a;">Se il bottone non funziona, copia e incolla questo link nel browser:<br>{{actionUrl}}</p>
      <p style="font-size:13px;color:#71717a;">Se non hai richiesto tu il reset, ignora questa email: la password non verrà cambiata.</p>`,
  }),
  text: `Ciao {{userName}},

abbiamo ricevuto una richiesta di reimpostazione della password del tuo account {{appName}}. Apri questo link per scegliere una nuova password:

{{actionUrl}}

Se non hai richiesto tu il reset, ignora questa email: la password non verrà cambiata.`,
  variables: ["appName", "userName", "actionUrl"],
}
