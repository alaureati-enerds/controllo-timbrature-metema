// Catalogo dei tipi di notifica. È la FONTE DI VERITÀ del sistema di notifiche:
// lo usano sia la facade `notify()` (per sapere categoria, canali di default e se
// un tipo è obbligatorio) sia la UI (config admin e preferenze utente, per
// generare i toggle raggruppati per categoria). È il gemello di
// lib/audit/catalog.ts e lib/jobs/registry.ts.
//
// Questo modulo è importato anche da componenti CLIENT (form preferenze e
// config): contiene SOLO metadati serializzabili (stringhe/booleani), niente
// funzioni di render né dipendenze server. Il CONTENUTO della notifica (titolo,
// corpo, link) lo fornisce chi chiama `notify()`, dove vive il contesto — come
// fa `audit()` con target/metadata.
//
// AGGIUNGERE UN TIPO DI NOTIFICA:
//   1. aggiungi una voce qui sotto con una `type` univoca ("categoria.soggetto.
//      verbo") e le sue proprietà;
//   2. chiama `notify({ type: "...", userId, title, body, ... })` nel punto in
//      cui l'evento accade (per gli eventi di Better Auth, in lib/notifications/
//      auth-hooks.ts; per gli eventi di dominio, nel tuo route handler/service).
// Nessuna migrazione: la tabella notification è schemaless su `data`.
// Vedi docs/notifiche.md per la guida completa.

// I canali di recapito disponibili. Aggiungere un canale (es. "push", "realtime")
// = una voce qui + un sink in lib/notifications/channels/. Il modello in-app e le
// preferenze utente non cambiano. Vedi docs/notifiche.md.
export const notificationChannels = ["in-app", "email"] as const

export type NotificationChannel = (typeof notificationChannels)[number]

// Categorie note. Servono solo a RAGGRUPPARE i tipi nella UI; un tipo con una
// categoria non elencata qui finisce nel gruppo "Altro" (vedi categoryLabel).
export const notificationCategories = ["security", "account"] as const

export type NotificationCategory =
  | (typeof notificationCategories)[number]
  | (string & {})

export type NotificationEventDef = {
  // Chiave univoca del tipo: "categoria.soggetto.verbo".
  type: string
  // Categoria di appartenenza (per il raggruppamento nella UI).
  category: NotificationCategory
  // Etichetta leggibile (config admin, preferenze utente, raggruppamenti).
  label: string
  // Descrizione mostrata sotto l'etichetta nelle preferenze utente.
  description: string
  // OBBLIGATORIA: l'utente non può disattivare il canale in-app (e l'admin non
  // può spegnerla globalmente). Pensata per gli eventi di sicurezza. L'email
  // resta comunque facoltativa, anche per le obbligatorie.
  mandatory: boolean
  // Canali attivi PRIMA che l'utente scelga. Convenzione: solo ["in-app"], così
  // l'email è sempre opt-in per-tipo (niente mail a sorpresa al primo avvio).
  defaultChannels: NotificationChannel[]
}

// Il catalogo. L'ordine qui determina l'ordine nella UI. Per ora solo gli eventi
// di SICUREZZA/ACCOUNT, tutti obbligatori (in-app non disattivabile). Aggiungere
// altre famiglie (gestione utenti agli admin, esito dei job, eventi di dominio)
// è una voce in più qui + la chiamata `notify()` corrispondente.
export const notificationCatalog = [
  // --- Sicurezza (obbligatorie) --------------------------------------------
  {
    type: "auth.login.new_device",
    category: "security",
    label: "Accesso da un nuovo dispositivo",
    description:
      "Quando il tuo account viene usato per accedere da un dispositivo o browser non riconosciuto.",
    mandatory: true,
    defaultChannels: ["in-app"],
  },
  {
    type: "account.password.change",
    category: "account",
    label: "Password modificata",
    description: "Quando la password del tuo account viene cambiata.",
    mandatory: true,
    defaultChannels: ["in-app"],
  },
  {
    type: "account.email.change",
    category: "account",
    label: "Email modificata",
    description: "Quando l'indirizzo email del tuo account viene cambiato.",
    mandatory: true,
    defaultChannels: ["in-app"],
  },
  {
    type: "account.2fa.enable",
    category: "account",
    label: "Autenticazione a due fattori attivata",
    description: "Quando attivi la verifica in due passaggi (2FA).",
    mandatory: true,
    defaultChannels: ["in-app"],
  },
  {
    type: "account.2fa.disable",
    category: "account",
    label: "Autenticazione a due fattori disattivata",
    description: "Quando disattivi la verifica in due passaggi (2FA).",
    mandatory: true,
    defaultChannels: ["in-app"],
  },
] as const satisfies readonly NotificationEventDef[]

// Tutte le `type` conosciute come tipo stretto: autocompletamento e niente refusi
// nelle chiamate a `notify()`. Tipi non in catalogo restano scrivibili (vedi
// lib/notifications/index.ts), solo senza questa garanzia.
export type NotificationType = (typeof notificationCatalog)[number]["type"]

const byType = new Map<string, NotificationEventDef>(
  notificationCatalog.map((e) => [e.type, e])
)

/** Definizione di un tipo dal catalogo, o undefined se non registrato. */
export function getNotificationEvent(
  type: string
): NotificationEventDef | undefined {
  return byType.get(type)
}

/**
 * Categoria di un tipo: dal catalogo se registrato, altrimenti il primo segmento
 * della `type` (es. "billing.invoice.paid" → "billing"). Così un tipo nuovo è
 * categorizzato in modo sensato anche prima di essere aggiunto al catalogo.
 */
export function categoryOf(type: string): NotificationCategory {
  return byType.get(type)?.category ?? type.split(".")[0] ?? "other"
}

/** Etichetta leggibile di un tipo: dal catalogo, o la `type` grezza. */
export function typeLabel(type: string): string {
  return byType.get(type)?.label ?? type
}

/** True se il tipo è obbligatorio (in-app non disattivabile). */
export function isMandatory(type: string): boolean {
  return byType.get(type)?.mandatory ?? false
}

/** Canali di default di un tipo (prima della scelta utente). */
export function defaultChannelsOf(type: string): NotificationChannel[] {
  return byType.get(type)?.defaultChannels ?? ["in-app"]
}

const CATEGORY_LABELS: Record<string, string> = {
  security: "Sicurezza",
  account: "Account",
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? "Altro"
}

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  "in-app": "In app",
  email: "Email",
}

export function channelLabel(channel: NotificationChannel): string {
  return CHANNEL_LABELS[channel] ?? channel
}
