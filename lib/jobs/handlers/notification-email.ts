import { z } from "zod"

import { email } from "@/lib/email"
import { renderTemplate } from "@/lib/email/templates"
import { env } from "@/lib/env"
import type { JobHandler } from "@/lib/jobs/types"
import { prisma } from "@/lib/prisma"
import { getSystemSettings } from "@/lib/settings/system"

// Invio EMAIL di una notifica, eseguito dal worker FUORI dalla richiesta che l'ha
// generata. Lo accoda il canale email (lib/notifications/channels/email.ts): così
// la latenza SMTP non pesa sull'azione dell'utente e la coda offre i retry.
// L'indirizzo del destinatario si risolve qui dallo `userId`, così è sempre
// quello corrente. Vedi docs/notifiche.md.
//
// Non ha `fields`: non è un'operazione che l'utente avvia a mano dal pannello,
// nasce solo come effetto di una notifica. Resta comunque visibile in /admin/jobs
// (storico/diagnostica) come tutti i job.
const payloadSchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(1),
  body: z.string(),
  url: z.string().optional(),
})

type Payload = z.infer<typeof payloadSchema>

export const notificationEmailHandler: JobHandler<Payload> = {
  type: "notification-email",
  label: "Invio email di notifica",
  fields: [],
  parse: (raw) => payloadSchema.parse(raw),
  async run({ userId, title, body, url }, ctx) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    })
    if (!user?.email) {
      await ctx.log(`Utente ${userId} senza email: invio saltato.`)
      return
    }

    const { appName } = await getSystemSettings()
    // Link assoluto per l'email: base configurata + path della notifica (o la
    // pagina notifiche come fallback). In dev la base può mancare (driver
    // console): il link resta relativo, ma la mail non parte davvero.
    const base = env.BETTER_AUTH_URL ?? ""
    const actionUrl = `${base}${url ?? "/notifications"}`
    const actionLabel = url ? "Apri" : "Vai alle notifiche"

    const message = await renderTemplate("notification", {
      appName,
      userName: user.name,
      title,
      body,
      actionUrl,
      actionLabel,
    })

    await ctx.log(`Invio email di notifica a ${user.email}`)
    await email.send({ to: user.email, ...message })
    await ctx.report(100, "Email inviata")
  },
}
