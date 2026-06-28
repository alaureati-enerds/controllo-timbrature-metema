import type { NotificationChannel } from "@/lib/notifications/catalog"

// Contratto di un CANALE di recapito. Ogni canale è un "sink" che sa consegnare
// una notifica già risolta (destinatario + contenuto) sul proprio mezzo: l'in-app
// scrive la riga Notification, l'email accoda un job di invio, e domani push o
// realtime faranno altro. La facade `notify()` (lib/notifications/index.ts)
// decide QUALI canali usare (catalogo + preferenze utente) e delega a loro il
// COME. Aggiungere un canale = un file qui + una voce in `notificationChannels`
// (catalog.ts) e nella mappa dei sink. Vedi docs/notifiche.md.

// Una notifica già risolta, pronta da consegnare su un canale qualsiasi.
export type DeliverInput = {
  // Destinatario.
  userId: string
  // Tipo del catalogo (lib/notifications/catalog.ts).
  type: string
  // Categoria derivata dal tipo (per il raggruppamento/visualizzazione).
  category: string
  // Contenuto: titolo breve + corpo. Forniti da chi chiama `notify()`.
  title: string
  body: string
  // Link facoltativo a cui porta la notifica (in-app: al click; email: bottone).
  url?: string
  // Contesto extra serializzabile, salvato sulla riga in-app (`data`).
  data?: Record<string, unknown>
}

export interface NotificationChannelSink {
  // Identità del canale (coincide con la voce in `notificationChannels`).
  channel: NotificationChannel
  // Consegna la notifica sul proprio mezzo. Può lanciare: la facade isola ogni
  // canale così il fallimento di uno non impedisce gli altri.
  deliver(input: DeliverInput): Promise<void>
}
