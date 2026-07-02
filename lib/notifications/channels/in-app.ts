import type { Prisma } from "@/lib/generated/prisma/client"
import type {
  DeliverInput,
  NotificationChannelSink,
} from "@/lib/notifications/channels/types"
import { prisma } from "@/lib/prisma"

// Canale IN-APP: scrive la riga Notification, fonte di verità della campanella in
// topbar. È l'unico canale persistito nel nostro DB; gli altri (email, …) sono
// recapiti paralleli. Vedi docs/notifiche.md.
export const inAppChannel: NotificationChannelSink = {
  channel: "in-app",
  async deliver(input: DeliverInput) {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        category: input.category,
        title: input.title,
        body: input.body,
        // L'URL del click vive nel blob `data` insieme al resto del contesto.
        data: {
          ...(input.url ? { url: input.url } : {}),
          ...(input.data ?? {}),
        } as Prisma.InputJsonValue,
      },
    })
  },
}
