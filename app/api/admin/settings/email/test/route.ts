import { ApiError, ok, safeHandler } from "@/lib/api"
import { getSession } from "@/lib/auth-helpers"
import { buildSmtpTransport } from "@/lib/email/smtp"
import { logger } from "@/lib/logger"
import { requireSettingsPermission } from "@/lib/settings/authz"
import { getResolvedEmailConfig } from "@/lib/settings/email"
import { getSystemSettings } from "@/lib/settings/system"

// Invia un'email di PROVA con la configurazione SALVATA, all'indirizzo
// dell'admin che la richiede. Serve a validare le credenziali SMTP dalla GUI
// senza innescare un flusso reale (signup/reset). Usa la config corrente: va
// quindi salvata prima di provare. A differenza dell'invio normale, qui gli
// errori SMTP vengono ESPOSTI: è proprio ciò che serve per correggere la config.

// POST /api/admin/settings/email/test — invia una mail di prova (solo admin)
export const POST = safeHandler(async () => {
  await requireSettingsPermission("update")
  const session = await getSession()
  if (!session) throw new ApiError("Non autenticato", 401)

  const config = await getResolvedEmailConfig()
  if (config.driver !== "smtp") {
    throw new ApiError(
      'Il driver email attivo è "console": l\'email finirebbe nei log, non ' +
        'verrebbe spedita. Imposta il driver su "SMTP", salva e riprova.',
      400
    )
  }

  let transport: ReturnType<typeof buildSmtpTransport>
  try {
    transport = buildSmtpTransport(config)
  } catch (error) {
    const detail = error instanceof Error ? error.message : "config non valida"
    throw new ApiError(detail, 400)
  }

  const to = session.user.email
  const { appName } = await getSystemSettings()
  const text =
    `Questa è un'email di prova inviata da ${appName}. ` +
    `Se la stai leggendo, la configurazione SMTP funziona.`

  try {
    // verify() controlla connessione e credenziali prima dell'invio: separa un
    // problema di config da un problema di consegna, con errori più chiari.
    await transport.transporter.verify()
    await transport.transporter.sendMail({
      from: transport.from,
      to,
      subject: `Email di prova — ${appName}`,
      text,
      html: `<p>${text}</p>`,
    })
  } catch (error) {
    logger.error("[email] test SMTP fallito", error)
    const detail = error instanceof Error ? error.message : "errore sconosciuto"
    throw new ApiError(`Invio non riuscito: ${detail}`, 502)
  }

  return ok({ sent: true, to })
})
