// Catalogo degli eventi tracciabili dall'audit log. È la FONTE DI VERITÀ del
// sistema di audit: lo usano sia il service di scrittura (per derivare la
// categoria di un evento e validare che sia "conosciuto") sia la UI di
// configurazione admin (per generare i toggle on/off, raggruppati per
// categoria). È il gemello di lib/jobs/registry.ts e lib/search/sources.ts.
//
// AGGIUNGERE UN EVENTO DA TRACCIARE:
//   1. aggiungi una voce qui sotto con una `action` univoca (schema
//      "categoria.soggetto.verbo") e una `label` in italiano;
//   2. chiama `audit({ action: "...", ... })` nel punto in cui l'evento accade
//      (per gli eventi di Better Auth basta mapparlo in lib/audit/auth-hooks.ts;
//      per gli eventi di dominio chiama `audit()` nel tuo route handler).
// Nessuna migrazione: la tabella audit_log è schemaless su `target`/`metadata`.
// Vedi docs/audit-logging.md per la guida completa.

// Categorie note. Servono solo a RAGGRUPPARE gli eventi nella UI di
// configurazione; un evento con una categoria non elencata qui finisce nel
// gruppo "Altro" (vedi categoryLabel). Aggiungerne una è facoltativo.
export const auditCategories = [
  "auth",
  "account",
  "users",
  "system",
] as const

export type AuditCategory = (typeof auditCategories)[number] | (string & {})

export type AuditEventDef = {
  // Chiave univoca dell'evento: "categoria.soggetto.verbo".
  action: string
  // Categoria di appartenenza (per il raggruppamento nella UI).
  category: AuditCategory
  // Etichetta leggibile mostrata nel registro e nei toggle di configurazione.
  label: string
}

// Il catalogo. L'ordine qui determina l'ordine nella UI di configurazione.
export const auditCatalog = [
  // --- Autenticazione -------------------------------------------------------
  { action: "auth.login.success", category: "auth", label: "Login riuscito" },
  { action: "auth.login.failure", category: "auth", label: "Login fallito" },
  { action: "auth.logout", category: "auth", label: "Logout" },

  // --- Account (self-service) ----------------------------------------------
  { action: "account.password.change", category: "account", label: "Cambio password" },
  { action: "account.email.change", category: "account", label: "Cambio email" },
  { action: "account.2fa.enable", category: "account", label: "2FA attivata" },
  { action: "account.2fa.disable", category: "account", label: "2FA disattivata" },
  { action: "account.delete", category: "account", label: "Eliminazione account" },

  // --- Gestione utenti (admin) ---------------------------------------------
  { action: "users.create", category: "users", label: "Utente creato" },
  { action: "users.remove", category: "users", label: "Utente eliminato" },
  { action: "users.ban", category: "users", label: "Utente bannato" },
  { action: "users.unban", category: "users", label: "Ban rimosso" },
  { action: "users.role.change", category: "users", label: "Ruolo modificato" },
  { action: "users.2fa.reset", category: "users", label: "Reset 2FA" },
  { action: "users.impersonate", category: "users", label: "Impersonation" },

  // --- Configurazione di sistema -------------------------------------------
  { action: "system.settings.update", category: "system", label: "Impostazioni modificate" },
  { action: "system.email.update", category: "system", label: "Config email modificata" },
  { action: "system.notifications.update", category: "system", label: "Config notifiche modificata" },
] as const satisfies readonly AuditEventDef[]

// Tutte le `action` conosciute, come tipo stretto: dà autocompletamento e
// previene refusi nelle chiamate ad `audit()`. Eventi non in catalogo restano
// comunque scrivibili (vedi lib/audit/index.ts), solo senza questa garanzia.
export type AuditAction = (typeof auditCatalog)[number]["action"]

const byAction = new Map<string, AuditEventDef>(
  auditCatalog.map((e) => [e.action, e])
)

/** Definizione di un evento dal catalogo, o undefined se non registrato. */
export function getAuditEvent(action: string): AuditEventDef | undefined {
  return byAction.get(action)
}

/**
 * Categoria di un evento: dal catalogo se registrato, altrimenti il primo
 * segmento della `action` (es. "billing.invoice.paid" → "billing"). Così un
 * evento nuovo è comunque categorizzato in modo sensato anche prima di essere
 * aggiunto al catalogo.
 */
export function categoryOf(action: string): AuditCategory {
  return byAction.get(action)?.category ?? action.split(".")[0] ?? "other"
}

/** Etichetta leggibile di un evento: dal catalogo, o la `action` grezza. */
export function actionLabel(action: string): string {
  return byAction.get(action)?.label ?? action
}

const CATEGORY_LABELS: Record<string, string> = {
  auth: "Autenticazione",
  account: "Account",
  users: "Gestione utenti",
  system: "Configurazione di sistema",
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? "Altro"
}
