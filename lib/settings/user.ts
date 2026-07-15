import { z } from "zod"

import { notificationChannels } from "@/lib/notifications/catalog"
import { prisma } from "@/lib/prisma"

// Service delle PREFERENZE PER-UTENTE. È il gemello di lib/settings/system.ts ma
// con autorizzazione per OWNERSHIP, non per ruolo: ogni funzione riceve lo
// `userId` e opera SOLO su quella riga (come lib/files.ts). Stesso pattern del
// sistema (blob Json + schema Zod come fonte di verità con i `.default()`), ma su
// un modello dedicato (UserPreference, chiave = userId). Vedi
// docs/impostazioni-di-sistema.md.

// Registro delle preferenze per-utente. Ogni preferenza è un campo con il suo
// `.default()`: quello a DB è solo un override parziale fuso sopra i default.
//
// AGGIUNGERE UNA PREFERENZA: aggiungi un campo qui con un `.default()` sensato e
// la UI corrispondente (di norma nel profilo). Nessuna migrazione: il blob `data`
// è schemaless lato DB.
export const userPreferencesSchema = z.object({
  // Scelta dei canali di notifica PER-TIPO. È un override SPARSO: contiene solo i
  // tipi che l'utente ha personalizzato; i tipi assenti usano i `defaultChannels`
  // del catalogo (lib/notifications/catalog.ts). Per un tipo disabilitato del
  // tutto, l'array è vuoto (`[]`); per i tipi obbligatori la facade forza
  // comunque l'in-app. Vedi lib/notifications/index.ts.
  notifications: z
    .object({
      channels: z
        .record(z.string(), z.array(z.enum(notificationChannels)))
        .default({}),
    })
    .default({ channels: {} }),
})

export type UserPreferences = z.infer<typeof userPreferencesSchema>

/**
 * Preferenze dell'utente, sempre complete e tipizzate grazie ai `.default()`
 * dello schema (riga assente o campi mancanti → default). Una sola query su
 * chiave primaria.
 */
export async function getUserPreferences(
  userId: string
): Promise<UserPreferences> {
  const row = await prisma.userPreference.findUnique({ where: { userId } })
  return userPreferencesSchema.parse(row?.data ?? {})
}

/**
 * Applica un aggiornamento parziale alle preferenze dell'utente: il patch viene
 * fuso sopra i valori correnti e ri-validato dallo schema completo, così il blob
 * salvato è sempre coerente. Il merge è SHALLOW di primo livello (come il
 * sistema): chi aggiorna `notifications` passa l'oggetto completo.
 */
export async function updateUserPreferences(
  userId: string,
  patch: Partial<UserPreferences>
): Promise<UserPreferences> {
  const current = await getUserPreferences(userId)
  const next = userPreferencesSchema.parse({ ...current, ...patch })

  await prisma.userPreference.upsert({
    where: { userId },
    create: { userId, data: next },
    update: { data: next },
  })

  return next
}
