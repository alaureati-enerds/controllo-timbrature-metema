import { cache } from "react"

import { prisma } from "@/lib/prisma"
import { systemSettingsSchema, type SystemSettings } from "@/lib/settings/schema"

// Service delle impostazioni di SISTEMA (globali, singleton id=1). Tiene fuori
// dalle pagine e dai route handler la logica di lettura/scrittura, come fa
// lib/files.ts per il dominio. L'autorizzazione (solo admin) NON sta qui ma a
// monte, nei route handler (requireRole/hasPermission): questo modulo si fida.

// Lettura sempre fresca dal DB, con dedup PER-RICHIESTA via `cache()` di React.
// In un singolo render le impostazioni si leggono in più punti (header della
// sidebar e generateMetadata per il <title>): `cache()` fa sì che ciò comporti
// una sola query, non N. Tra richieste diverse NON si conserva nulla, quindi una
// modifica (es. il nome) è subito visibile a tutti senza invalidazioni: è un
// SELECT su singola riga indicizzata, trascurabile sul percorso di ogni render.
//
// Se in futuro il volume di letture lo giustificasse, si può passare a una cache
// cross-request con invalidazione a tag abilitando `cacheComponents` in
// next.config e usando il direttivo "use cache" + cacheTag/updateTag.
export const getSystemSettings = cache(async (): Promise<SystemSettings> => {
  const row = await prisma.systemSetting.findUnique({ where: { id: 1 } })
  // I default dello schema riempiono ogni buco: riga assente o campi mancanti
  // → valori di default completi e tipati.
  return systemSettingsSchema.parse(row?.data ?? {})
})

// Applica un aggiornamento parziale: il patch viene fuso sopra i valori correnti
// e ri-validato dallo schema completo, così il blob salvato è sempre coerente e
// tipato. La modifica è immediatamente visibile a tutti (nessuna cache da
// invalidare, vedi sopra).
//
// Il merge è SHALLOW: chi aggiorna la config email (lib/settings/email.ts) passa
// l'oggetto `email` già completo, così non rischia di azzerarne dei campi; il
// form branding non tocca `email` e viceversa. Il tipo è `Partial<SystemSettings>`
// (non lo schema branding-only) proprio per accettare anche la chiave `email`.
export async function updateSystemSettings(
  patch: Partial<SystemSettings>
): Promise<SystemSettings> {
  const current = await getSystemSettings()
  const next = systemSettingsSchema.parse({ ...current, ...patch })

  await prisma.systemSetting.upsert({
    where: { id: 1 },
    create: { id: 1, data: next },
    update: { data: next },
  })

  return next
}
