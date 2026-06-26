import { z } from "zod"

import { BRANDING_ICON_NAMES, DEFAULT_BRANDING_ICON } from "@/lib/settings/icons"

// Registro delle impostazioni di SISTEMA (globali). È la fonte di verità: ogni
// impostazione è un campo di questo schema Zod, con il suo `.default()`. Lo
// stesso approccio di lib/env.ts — quello che sta a DB (il blob `data` di
// SystemSetting) è solo un override parziale che viene fuso sopra i default.
//
// AGGIUNGERE UNA NUOVA IMPOSTAZIONE DI SISTEMA:
//   1. aggiungi un campo qui sotto, sempre con un `.default()` sensato;
//   2. se è un dato visibile al client (come il nome), aggiungilo anche a
//      `toPublicSettings()` più in basso;
//   3. esponi il campo nel form admin (components/admin/system-settings-form.tsx).
// Nessuna migrazione necessaria: il blob `data` è schemaless lato DB.
//
// SEGRETI: di norma non vanno qui, perché la parte pubblica di questo schema
// viene inviata al browser. L'ECCEZIONE è la config email (`email`), che è
// server-only (mai in `toPublicSettings`) e tiene l'unico segreto in forma
// CIFRATA (`passwordEnc`, vedi lib/crypto.ts), mai in chiaro. Vedi
// docs/impostazioni-di-sistema.md e docs/email.md.

// Config EMAIL persistita nel blob del singleton. Tutti i campi sono opzionali:
// ciò che manca ricade su .env (regola "GUI prevale, env fallback", risolta in
// lib/settings/email.ts). `passwordEnc` è la password SMTP cifrata: l'unico
// segreto del blob, server-only e mai restituito al client (vedi il DTO admin).
export const emailSettingsSchema = z.object({
  // Driver attivo; assente = scelta automatica per ambiente (vedi env/email.ts).
  driver: z.enum(["console", "smtp"]).optional(),
  // Mittente di default ("Nome <indirizzo>" o solo l'indirizzo).
  from: z.string().trim().min(1).optional(),
  host: z.string().trim().min(1).optional(),
  port: z.coerce.number().int().positive().optional(),
  // TLS implicito (porta 465) vs STARTTLS (587).
  secure: z.boolean().optional(),
  user: z.string().trim().min(1).optional(),
  // Password SMTP CIFRATA (lib/crypto.ts). Mai in chiaro, mai inviata al client.
  passwordEnc: z.string().min(1).optional(),
})

export type EmailSettings = z.infer<typeof emailSettingsSchema>

export const systemSettingsSchema = z.object({
  // Nome del software, mostrato nell'header della sidebar e nel <title>.
  appName: z.string().trim().min(1).default("shadcn starter"),
  // Sottotitolo sotto il nome. Vuoto = riga nascosta.
  appSubtitle: z.string().trim().default("Dashboard"),
  // Icona dell'header della sidebar (vedi lib/settings/icons.ts).
  iconName: z.enum(BRANDING_ICON_NAMES).default(DEFAULT_BRANDING_ICON),
  // Config email (server-only, vedi sopra). Default {}: ogni campo ricade su env.
  email: emailSettingsSchema.default({}),
})

export type SystemSettings = z.infer<typeof systemSettingsSchema>

// Sottoinsieme di impostazioni sicuro da inviare al client: solo il branding.
// La config `email` resta server-only e NON compare qui (contiene un segreto).
export type PublicSystemSettings = Pick<
  SystemSettings,
  "appName" | "appSubtitle" | "iconName"
>

export function toPublicSettings(s: SystemSettings): PublicSystemSettings {
  return {
    appName: s.appName,
    appSubtitle: s.appSubtitle,
    iconName: s.iconName,
  }
}

// Schema per gli aggiornamenti dal form admin del BRANDING: tutti i campi
// opzionali (patch parziale). `email` è escluso di proposito — si aggiorna solo
// dall'endpoint dedicato (gestione del segreto), mai da qui.
export const systemSettingsPatchSchema = systemSettingsSchema
  .omit({ email: true })
  .partial()

export type SystemSettingsPatch = z.infer<typeof systemSettingsPatchSchema>

// Input del form EMAIL (admin → server). Distinto dallo schema persistito:
//   - la password arriva in CHIARO (write-only) e qui viene poi cifrata;
//   - "driver: default" e i campi stringa VUOTI hanno semantica di "azzera /
//     usa il fallback .env", risolta in lib/settings/email.ts.
// Non contiene mai `passwordEnc`.
export const emailSettingsInputSchema = z.object({
  driver: z.enum(["default", "console", "smtp"]),
  from: z.string().trim(),
  host: z.string().trim(),
  port: z.coerce.number().int().positive().nullable(),
  secure: z.boolean(),
  user: z.string().trim(),
  // Presente solo se l'admin ha digitato una nuova password.
  password: z.string().min(1).optional(),
  // true per cancellare la password salvata (tornando al fallback .env).
  removePassword: z.boolean().optional(),
})

export type EmailSettingsInput = z.infer<typeof emailSettingsInputSchema>

// Vista MASCHERATA della config email (server → admin): rispecchia i valori
// persistiti per popolare il form, ma non espone mai la password — solo se è
// impostata (`passwordSet`).
export type EmailSettingsAdmin = {
  driver: "default" | "console" | "smtp"
  from: string
  host: string
  port: number | null
  secure: boolean
  user: string
  passwordSet: boolean
}
