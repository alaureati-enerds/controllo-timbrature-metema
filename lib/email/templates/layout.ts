// Guscio HTML condiviso dei template email, con CSS inline (i client di posta
// ignorano i <style> esterni e gran parte di quelli interni). Compone header
// brandizzato + corpo + footer in un documento completo. È usato a build-time
// per costruire le sorgenti di default in templates/*.ts: il risultato è una
// stringa HTML autosufficiente, ancora ricca di segnaposto `{{...}}`, pronta sia
// per il render all'invio sia — domani — per essere salvata/editata da un editor.

const COLORS = {
  bg: "#f4f4f5", // zinc-100
  card: "#ffffff",
  text: "#18181b", // zinc-900
  muted: "#71717a", // zinc-500
  border: "#e4e4e7", // zinc-200
  accent: "#18181b",
  accentText: "#ffffff",
}

/** Bottone d'azione principale (call-to-action). `href` può contenere segnaposto. */
export function button(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:${COLORS.accent};color:${COLORS.accentText};text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:8px;">${label}</a>`
}

/** Avvolge `bodyHtml` (che può contenere segnaposto) nel guscio brandizzato. */
export function layout(opts: { bodyHtml: string }): string {
  return `<!doctype html>
<html lang="it">
  <body style="margin:0;padding:0;background:${COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLORS.text};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:24px 32px 0;font-size:18px;font-weight:700;">{{appName}}</td>
            </tr>
            <tr>
              <td style="padding:16px 32px 32px;font-size:15px;line-height:1.6;">
                ${opts.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid ${COLORS.border};font-size:12px;color:${COLORS.muted};">
                Hai ricevuto questa email da {{appName}}. Se non hai richiesto tu questa operazione, puoi ignorarla.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}
