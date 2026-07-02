import type { AuditSettings } from "@/lib/settings/schema"
import { getSystemSettings, updateSystemSettings } from "@/lib/settings/system"

// Service della config dell'AUDIT LOG. Vive nel blob del singleton (campo
// `audit` di lib/settings/schema.ts), server-only. Gemello di
// lib/settings/email.ts: tiene fuori dai route handler e dal service di audit
// la lettura/scrittura della configurazione. L'autorizzazione (solo admin) sta
// a monte nei route handler, non qui. Vedi docs/audit-logging.md.

/**
 * Config audit corrente. La legge `audit()` a ogni evento per decidere se
 * registrare: è un SELECT su singola riga indicizzata (il singleton), con dedup
 * per-richiesta via il `cache()` di getSystemSettings. Trascurabile.
 */
export async function getAuditSettings(): Promise<AuditSettings> {
  return (await getSystemSettings()).audit
}

/**
 * Salva la config audit (merge shallow sul blob: l'oggetto `audit` viene
 * passato completo, così non si azzerano campi). La modifica è immediatamente
 * efficace al prossimo evento (nessuna cache cross-request da invalidare).
 */
export async function updateAuditSettings(
  next: AuditSettings
): Promise<AuditSettings> {
  const saved = await updateSystemSettings({ audit: next })
  return saved.audit
}
