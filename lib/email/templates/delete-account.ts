import { button, layout } from "@/lib/email/templates/layout"
import type { EmailTemplate } from "@/lib/email/templates/types"

// Conferma dell'eliminazione dell'account. `actionUrl` è il link che conferma e
// avvia la cancellazione (vedi user.deleteUser in lib/auth.ts). Operazione
// irreversibile: il tono è esplicito.
export const deleteAccountTemplate: EmailTemplate = {
  id: "delete-account",
  subject: "Conferma l'eliminazione del tuo account · {{appName}}",
  html: layout({
    bodyHtml: `
      <p>Ciao {{userName}},</p>
      <p>hai chiesto di eliminare il tuo account {{appName}}. Questa operazione è <strong>irreversibile</strong>: tutti i tuoi dati verranno rimossi.</p>
      <p style="margin:24px 0;">${button("Conferma eliminazione", "{{actionUrl}}")}</p>
      <p style="font-size:13px;color:#71717a;">Se il bottone non funziona, copia e incolla questo link nel browser:<br>{{actionUrl}}</p>
      <p style="font-size:13px;color:#71717a;">Se non hai richiesto tu l'eliminazione, ignora questa email e il tuo account resterà attivo.</p>`,
  }),
  text: `Ciao {{userName}},

hai chiesto di eliminare il tuo account {{appName}}. Questa operazione è IRREVERSIBILE: tutti i tuoi dati verranno rimossi. Apri questo link per confermare:

{{actionUrl}}

Se non hai richiesto tu l'eliminazione, ignora questa email e il tuo account resterà attivo.`,
  variables: ["appName", "userName", "actionUrl"],
}
