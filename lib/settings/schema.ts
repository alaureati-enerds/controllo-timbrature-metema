import { z } from "zod"

import { BRANDING_ICON_NAMES, DEFAULT_BRANDING_ICON } from "@/lib/settings/icons"

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
  // Sottotitolo sotto il nome (modalità "icona"). Vuoto = riga nascosta.
  appSubtitle: z.string().trim().default("Dashboard"),
  // Modalità di branding dell'header della sidebar:
  //  - "icon": icona scelta + nome + sottotitolo
  //  - "logo": logo personalizzato a tutta larghezza (da collassata torna l'icona)
  brandingMode: z.enum(["icon", "logo"]).default("icon"),
  // Icona scelta in modalità "icon" (vedi lib/settings/icons.ts).
  iconName: z.enum(BRANDING_ICON_NAMES).default(DEFAULT_BRANDING_ICON),
  // Id del File (ownerType "system") usato come logo in modalità "logo".
  // Null = nessun logo caricato (ricade sull'icona). Vedi lib/files.ts.
  logoFileId: z.string().nullable().default(null),
})

export type SystemSettings = z.infer<typeof systemSettingsSchema>

// Sottoinsieme di impostazioni sicuro da inviare al client. Oggi tutti i campi
// sono pubblici (servono a renderizzare l'header); quando aggiungeremo campi
// server-only (es. configurazione SMTP) questo tipo li escluderà.
export type PublicSystemSettings = SystemSettings

export function toPublicSettings(s: SystemSettings): PublicSystemSettings {
  return {
    appName: s.appName,
    appSubtitle: s.appSubtitle,
    brandingMode: s.brandingMode,
    iconName: s.iconName,
    logoFileId: s.logoFileId,
  }
}

// Schema per gli aggiornamenti dal form admin: tutti i campi opzionali (patch
// parziale). I default dello schema completo riempiono comunque ogni buco al
// momento del merge in updateSystemSettings().
export const systemSettingsPatchSchema = systemSettingsSchema.partial()

export type SystemSettingsPatch = z.infer<typeof systemSettingsPatchSchema>
