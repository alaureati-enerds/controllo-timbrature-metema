# Impostazioni del sistema (e preferenze per-utente)

Questa guida spiega come funzionano le impostazioni nel progetto, come
aggiungerne di nuove e — punto importante — la **distinzione tra impostazioni
di sistema e preferenze per-utente**, che sono due concetti diversi con due
modelli di autorizzazione diversi.

---

## I due assi: sistema vs utente

Non confondere queste due cose: non sono due livelli della stessa
impostazione, sono **due concetti separati**.

|                     | Impostazioni di **sistema**                  | Preferenze **per-utente**                       |
| ------------------- | -------------------------------------------- | ----------------------------------------------- |
| Esempi              | nome del software, sottotitolo, tema di default | notifiche on/off, lingua, tema scelto         |
| Ambito              | una sola riga globale (singleton)            | una riga per ciascun utente                     |
| Chi le modifica     | **solo gli admin**                           | **ogni utente le proprie** (admin compreso)     |
| Autorizzazione      | **RBAC** — permesso `settings` (admin)       | **ownership** — `userId === session.user.id`    |
| Dove nella UI       | `/admin/settings`                            | `/settings` o `/profile`                        |

La conseguenza pratica: il permesso RBAC `settings` (vedi
[`lib/permissions.ts`](../lib/permissions.ts)) vale **solo** per le impostazioni
globali. Quando l'admin regola le *sue* notifiche non lo fa "da admin": lo fa da
utente come tutti gli altri, e l'autorizzazione è per ownership — esattamente
come per i file (vedi [`lib/files.ts`](../lib/files.ts)).

> **Stato attuale:** l'asse **di sistema** copre il branding (nome, sottotitolo,
> icona). Le *preferenze per-utente* non esistono ancora come impostazioni
> (questa pagina descrive il pattern con cui andranno aggiunte); l'asse ownership
> è però già dimostrato dai file utente — vedi [`gestione-file.md`](gestione-file.md).

---

## Come sono fatte le impostazioni di sistema

L'idea centrale è la stessa di [`lib/env.ts`](../lib/env.ts): **uno schema Zod è
la fonte di verità**, con un `.default()` per ogni campo. Quello che sta nel
database è solo un override parziale che viene **fuso sopra i default**.

Pezzi coinvolti:

- **Database** — modello `SystemSetting` in
  [`prisma/schema.prisma`](../prisma/schema.prisma): un *singleton* (al più una
  riga, `id = 1`) con un unico campo `data` di tipo `Json`. Il blob è
  *schemaless* lato DB: aggiungere un'impostazione **non richiede una
  migrazione**.
- **Schema** — [`lib/settings/schema.ts`](../lib/settings/schema.ts): il
  `systemSettingsSchema` Zod con i campi e i loro default, più la distinzione
  tra dati pubblici (inviabili al client) e privati.
- **Service** — [`lib/settings/system.ts`](../lib/settings/system.ts):
  `getSystemSettings()` (lettura) e `updateSystemSettings()` (scrittura).
  L'autorizzazione **non** sta qui: il service si fida, il controllo è a monte.
- **API** — [`app/api/admin/settings/route.ts`](../app/api/admin/settings/route.ts):
  `GET`/`PUT` protette dal permesso `settings`.
- **UI admin** — pagina
  [`app/(dashboard)/admin/settings/page.tsx`](<../app/(dashboard)/admin/settings/page.tsx>)
  + form client
  [`components/admin/system-settings-form.tsx`](../components/admin/system-settings-form.tsx).

### Lettura: default sempre completi

`getSystemSettings()` legge la riga e fa
`systemSettingsSchema.parse(row?.data ?? {})`. Grazie ai `.default()` ottieni
sempre un oggetto **completo e tipizzato**, anche se la riga non esiste o se è
stato salvato solo un sottoinsieme dei campi.

### Lettura, dedup e propagazione globale

Nome e icona si leggono in più punti dello stesso render (header della sidebar e
`generateMetadata` per il `<title>`). `getSystemSettings()` è avvolta in
`cache()` di React: nello **stesso render** la lettura avviene una sola volta,
non N — la query al DB è deduplicata per-richiesta.

Tra richieste diverse **non si conserva nulla**: ogni richiesta rilegge dal DB.
Questo è voluto e risolve in radice il requisito «se cambio il nome deve valere
per tutti»: non esistendo una cache stale da invalidare, una modifica è subito
visibile a chiunque, **lato server e in modo globale** (non c'entra il browser
del singolo utente). Il costo è un `SELECT` su una singola riga indicizzata a
ogni render: trascurabile.

> **Se un giorno servisse una cache cross-request** (volumi di lettura molto
> alti), si abilita `cacheComponents` in `next.config` e si passa al direttivo
> `"use cache"` con `cacheTag("system-settings")` + `updateTag(...)` nello
> `updateSystemSettings()`. In Next 16 `revalidateTag` richiede un secondo
> argomento (profilo) e l'API è ancora in evoluzione: meglio non introdurla
> finché non serve davvero.

---

## Aggiungere una nuova impostazione di sistema

Esempio: aggiungere un tema di default.

1. **Aggiungi il campo allo schema** in
   [`lib/settings/schema.ts`](../lib/settings/schema.ts), **sempre con un
   `.default()`**:

   ```ts
   export const systemSettingsSchema = z.object({
     appName: z.string().trim().min(1).default("shadcn starter"),
     appSubtitle: z.string().trim().default("Dashboard"),
     iconName: z.enum(BRANDING_ICON_NAMES).default(DEFAULT_BRANDING_ICON),
     defaultTheme: z.enum(["light", "dark", "system"]).default("system"), // nuovo
   })
   ```

2. **Se è un dato pubblico** (visibile al client, come nome/icona/tema),
   aggiungilo a `PublicSystemSettings` e a `toPublicSettings()` nello stesso
   file. Se è un dato server-only, lascialo fuori dalla parte pubblica.

3. **Esponilo nel form** in
   [`components/admin/system-settings-form.tsx`](../components/admin/system-settings-form.tsx).

Nessuna migrazione: il blob `data` accoglie il nuovo campo così com'è.

### Segreti: cifrati e server-only, mai nel blob pubblico

Il rischio coi segreti è che la parte **pubblica** dello schema viene inviata al
browser. La regola quindi è: un segreto non deve **mai** finire né in
`toPublicSettings()` né, in chiaro, nel `data` del singleton.

Il pattern, dimostrato dalla **config email** (la password SMTP), è:

1. **server-only** — il campo (`email`) sta nello schema ma **fuori** da
   `toPublicSettings()`, così non raggiunge il client;
2. **cifratura a riposo** — il segreto è salvato cifrato
   (`passwordEnc`, AES-256-GCM in [`lib/crypto.ts`](../lib/crypto.ts), chiave
   derivata da `SETTINGS_SECRET`), mai in chiaro nel blob;
3. **write-only verso il client** — l'endpoint admin non restituisce mai il
   segreto, solo un flag «impostato sì/no»; in scrittura lo aggiorna solo se ne
   arriva uno nuovo. Serve perciò un **endpoint dedicato**
   ([`/api/admin/settings/email`](<../app/api/admin/settings/email/route.ts>)),
   distinto da quello generico del branding.

In alternativa (o come fallback) i segreti possono stare in `.env`: la config
email accetta entrambe le sorgenti, con la GUI che prevale — vedi
[`lib/settings/email.ts`](../lib/settings/email.ts) e [email.md](email.md).

---

## Branding della sidebar

L'header della sidebar mostra un'**icona** + `appName` + `appSubtitle` (il
sottotitolo si nasconde se vuoto). L'icona si sceglie da un set curato e
ricercabile ([`lib/settings/icons.ts`](../lib/settings/icons.ts)).

Per ampliare le icone disponibili: aggiungi il nome in `icons.ts` e la coppia
nome→componente in [`components/branding-icon.tsx`](../components/branding-icon.tsx).
La mappa è tipata su quei nomi, quindi aggiungerne uno senza l'altra (o viceversa)
è un errore a compile time.

---

## Quando servirà: preferenze per-utente

Riusa lo **stesso pattern** (blob `Json` + registro Zod), ma con un modello e un
service distinti, e autorizzazione per **ownership**:

```prisma
model UserPreference {
  userId String @id
  data   Json   @default("{}")
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("user_preference")
}
```

- `lib/settings/user.ts`: `getUserPreferences(userId)` /
  `updateUserPreferences(userId, patch)` — ogni funzione riceve lo `userId` e
  opera **solo** su quella riga, come [`lib/files.ts`](../lib/files.ts).
- Niente RBAC `settings`: il controllo è `userId === session.user.id`.
- La UI sta sotto `/settings` (o `/profile`), non sotto `/admin`.
- **Già in uso** con questo pattern: i canali di notifica per-tipo
  ([notifiche.md](notifiche.md)) e il **template di stampa predefinito**
  (`stampa.templateId`, card «Stampa» in `/settings` — vedi
  [stampa-timbrature.md](stampa-timbrature.md)).

Per la precedenza del tema: la preferenza dell'utente, quando esisterà, batte il
`defaultTheme` di sistema; `next-themes` legge comunque il `localStorage` del
browser, quindi il default di sistema è il fallback al primo accesso.

---

## Riferimenti

- Autenticazione, ruoli e RBAC: [`autenticazione-e-ruoli.md`](autenticazione-e-ruoli.md)
- Creare un tema: [`creare-un-tema.md`](creare-un-tema.md)
