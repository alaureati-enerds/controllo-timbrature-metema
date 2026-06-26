import { z } from "zod"

// Registro delle impostazioni di SISTEMA (globali). È la fonte di verità: ogni
// impostazione è un campo di questo schema Zod, con il suo `.default()`. Lo
// stesso approccio di lib/env.ts — quello che sta a DB (il blob `data` di
// SystemSetting) è solo un override parziale che viene fuso sopra i default.
//
// AGGIUNGERE UNA NUOVA IMPOSTAZIONE DI SISTEMA:
//   1. aggiungi un campo qui sotto, sempre con un `.default()` sensato;
//   2. se è un dato visibile al client (come nome/logo), aggiungilo anche a
//      `toPublicSettings()` più in basso;
//   3. esponi il campo nel form admin (components/admin/system-settings-form.tsx).
// Nessuna migrazione necessaria: il blob `data` è schemaless lato DB.
//
// SEGRETI (es. password SMTP): NON metterli qui. Questo schema viene letto e,
// nella parte pubblica, inviato al browser. Le credenziali vanno in .env o in un
// campo cifrato dedicato. Vedi docs/impostazioni-di-sistema.md.
export const systemSettingsSchema = z.object({
  // Nome del software, mostrato nell'header della sidebar e nel <title>.
  appName: z.string().trim().min(1).default("shadcn starter"),
  // URL del logo (assoluto o relativo a /public). Null = usa l'icona di default.
  logoUrl: z.string().url().nullable().default(null),
})

export type SystemSettings = z.infer<typeof systemSettingsSchema>

// Sottoinsieme di impostazioni sicuro da inviare al client. Per ora coincide con
// tutto (nome e logo sono pubblici), ma è il punto in cui filtrare i campi
// server-only quando ne aggiungeremo (es. configurazione SMTP).
export type PublicSystemSettings = Pick<SystemSettings, "appName" | "logoUrl">

export function toPublicSettings(s: SystemSettings): PublicSystemSettings {
  return { appName: s.appName, logoUrl: s.logoUrl }
}

// Schema per gli aggiornamenti dal form admin: tutti i campi opzionali (patch
// parziale). I default dello schema completo riempiono comunque ogni buco al
// momento del merge in updateSystemSettings().
export const systemSettingsPatchSchema = systemSettingsSchema.partial()

export type SystemSettingsPatch = z.infer<typeof systemSettingsPatchSchema>
