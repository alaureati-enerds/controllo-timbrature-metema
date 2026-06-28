import { enqueue } from "@/lib/jobs"
import type {
  DeliverInput,
  NotificationChannelSink,
} from "@/lib/notifications/channels/types"

// Canale EMAIL: NON spedisce qui. Accoda un job `notification-email` (lib/jobs/
// handlers/notification-email.ts) che il worker esegue fuori dalla richiesta —
// niente latenza SMTP sul percorso dell'azione, e retry gestiti dalla coda. È il
// vero motivo per cui le notifiche si appoggiano al worker. L'indirizzo del
// destinatario lo risolve il job dallo `userId` (così è sempre quello corrente).
// Vedi docs/notifiche.md e docs/operazioni-in-background.md.
export const emailChannel: NotificationChannelSink = {
  channel: "email",
  async deliver(input: DeliverInput) {
    await enqueue("notification-email", {
      userId: input.userId,
      title: input.title,
      body: input.body,
      url: input.url,
    })
  },
}
