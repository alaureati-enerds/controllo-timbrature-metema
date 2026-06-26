import { email } from "@/lib/email"
import { renderTemplate, type EmailTemplateId } from "@/lib/email/templates"
import { getSystemSettings } from "@/lib/settings/system"

// Ponte tra i flussi di Better Auth (lib/auth.ts) e l'invio email: prende l'id
// del template e il contesto, ci aggiunge il nome del software dalle
// impostazioni di sistema (branding), renderizza e spedisce. Tiene i callback
// in lib/auth.ts a una riga e centralizza qui il branding.
async function send(
  id: EmailTemplateId,
  to: string,
  vars: Record<string, string>
): Promise<void> {
  const { appName } = await getSystemSettings()
  const message = await renderTemplate(id, { appName, ...vars })
  await email.send({ to, ...message })
}

/** Email di verifica indirizzo dopo la registrazione. */
export function sendVerificationEmail(args: {
  to: string
  userName: string
  url: string
}): Promise<void> {
  return send("verify-email", args.to, {
    userName: args.userName,
    actionUrl: args.url,
  })
}

/** Email con il link per reimpostare la password (password dimenticata). */
export function sendResetPasswordEmail(args: {
  to: string
  userName: string
  url: string
}): Promise<void> {
  return send("reset-password", args.to, {
    userName: args.userName,
    actionUrl: args.url,
  })
}

/** Conferma del cambio email, inviata alla NUOVA email. */
export function sendChangeEmailConfirmation(args: {
  to: string
  userName: string
  newEmail: string
  url: string
}): Promise<void> {
  return send("change-email", args.to, {
    userName: args.userName,
    newEmail: args.newEmail,
    actionUrl: args.url,
  })
}

/** Conferma dell'eliminazione account (operazione irreversibile). */
export function sendDeleteAccountVerification(args: {
  to: string
  userName: string
  url: string
}): Promise<void> {
  return send("delete-account", args.to, {
    userName: args.userName,
    actionUrl: args.url,
  })
}
