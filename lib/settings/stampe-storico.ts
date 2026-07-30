import type { StampeSettings } from "@/lib/settings/schema"
import { getSystemSettings, updateSystemSettings } from "@/lib/settings/system"

// Service della config dello STORICO STAMPE. Vive nel blob del singleton
// (campo `stampe` di lib/settings/schema.ts), server-only. Gemello di
// lib/settings/audit.ts: tiene fuori dal job di pruning e dai route handler la
// lettura/scrittura della configurazione. L'autorizzazione (solo admin) sta a
// monte nei route handler, non qui.

/** Config storico stampe corrente (oggi solo la retention). */
export async function getStampeStoricoSettings(): Promise<StampeSettings> {
  return (await getSystemSettings()).stampe
}

/** Salva la config (merge shallow sul blob, come per l'audit). */
export async function updateStampeStoricoSettings(
  next: StampeSettings
): Promise<StampeSettings> {
  const saved = await updateSystemSettings({ stampe: next })
  return saved.stampe
}
