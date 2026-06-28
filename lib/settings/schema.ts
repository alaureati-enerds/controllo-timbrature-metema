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

// Config dell'AUDIT LOG persistita nel blob del singleton. È server-only (mai in
// toPublicSettings) e segue lo stile opt-out: di default il logging è attivo e
// nessun evento è disabilitato, così un evento nuovo viene tracciato senza
// dover toccare la config. Vedi lib/audit/ e docs/audit-logging.md.
export const auditSettingsSchema = z.object({
  // Interruttore generale: false = nessun evento viene registrato.
  enabled: z.boolean().default(true),
  // `action` (vedi catalogo) che l'admin ha spento esplicitamente.
  disabledActions: z.array(z.string()).default([]),
  // Giorni di conservazione prima del pruning automatico. 0 = conserva sempre.
  retentionDays: z.coerce.number().int().min(0).max(3650).default(90),
})

export type AuditSettings = z.infer<typeof auditSettingsSchema>

// Config delle NOTIFICHE persistita nel blob del singleton. Server-only (mai in
// toPublicSettings), stile opt-out come l'audit: di default il sistema è attivo e
// nessun tipo è disabilitato, così un tipo nuovo notifica senza toccare la
// config. NB: i tipi OBBLIGATORI (catalogo, `mandatory`) ignorano sia
// l'interruttore generale sia `disabledTypes` — la sicurezza non si spegne.
// Vedi lib/notifications/ e docs/notifiche.md.
export const notificationSettingsSchema = z.object({
  // Interruttore generale: false = nessuna notifica NON obbligatoria viene creata.
  enabled: z.boolean().default(true),
  // `type` (vedi catalogo) che l'admin ha spento esplicitamente. Ignorato per i
  // tipi obbligatori.
  disabledTypes: z.array(z.string()).default([]),
  // Giorni di conservazione prima del pruning automatico. Si applica SOLO alle
  // notifiche già lette; le non lette non scadono mai per età. 0 = conserva
  // sempre.
  retentionDays: z.coerce.number().int().min(0).max(3650).default(90),
})

export type NotificationSettings = z.infer<typeof notificationSettingsSchema>

export const systemSettingsSchema = z.object({
  // Nome del software, mostrato nell'header della sidebar e nel <title>.
  appName: z.string().trim().min(1).default("shadcn starter"),
  // Sottotitolo sotto il nome. Vuoto = riga nascosta.
  appSubtitle: z.string().trim().default("Dashboard"),
  // Icona dell'header della sidebar (vedi lib/settings/icons.ts).
  iconName: z.enum(BRANDING_ICON_NAMES).default(DEFAULT_BRANDING_ICON),
  // Config email (server-only, vedi sopra). Default {}: ogni campo ricade su env.
  email: emailSettingsSchema.default({}),
  // Config audit log (server-only). Default = i default dello schema (logging
  // attivo, nessun evento spento, retention 90gg).
  audit: auditSettingsSchema.default(auditSettingsSchema.parse({})),
  // Config notifiche (server-only). Default = i default dello schema (attive,
  // nessun tipo spento, retention 90gg).
  notifications: notificationSettingsSchema.default(
    notificationSettingsSchema.parse({})
  ),
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
// opzionali (patch parziale). `email` e `audit` sono esclusi di proposito — si
// aggiornano solo dai rispettivi endpoint dedicati, mai da qui.
export const systemSettingsPatchSchema = systemSettingsSchema
  .omit({ email: true, audit: true, notifications: true })
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
