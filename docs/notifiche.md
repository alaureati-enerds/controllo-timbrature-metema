# Notifiche

Il sistema di notifiche avvisa l'utente di ciò che accade sul suo account. Oggi
recapita **in app** (la campanella in topbar) e via **email**, ma è progettato
perché aggiungere un canale (push per PWA, realtime via toast/SSE) non tocchi né
il modello né i punti di chiamata.

In breve:

- **Tre concetti separati**: un **evento** (`notify()`) genera una **notifica**
  (record per-utente) recapitata su uno o più **canali**. Disaccoppiarli è ciò
  che rende solida la base per metodi futuri.
- **Asincrono dove conta**: l'email NON parte nella richiesta. La notifica in-app
  è immediata; l'email viene **accodata come job** ed eseguita dal
  [worker](operazioni-in-background.md) (niente latenza SMTP, retry gratis).
- **Configurabile dall'admin**: interruttore generale, quali azioni notificano,
  giorni di retention, dalla pagina **Notifiche** (`/admin/notifications`).
- **Scelta per-utente**: ognuno decide su quali canali ricevere ogni tipo, dal
  proprio **profilo**. Alcuni tipi sono **obbligatori** (sicurezza): l'in-app non
  si disattiva, l'email resta facoltativa.
- **Fail-open**: un errore di notifica non fa mai fallire l'operazione di
  business (un cambio password non si rompe perché il DB notifiche è giù).

---

## Dove vive

| Pezzo | File |
| --- | --- |
| Modelli (`notification`, `user_preference`) | [`prisma/schema.prisma`](../prisma/schema.prisma) |
| Catalogo dei tipi (estensibilità) | [`lib/notifications/catalog.ts`](../lib/notifications/catalog.ts) |
| Facade: `notify`, lettura, mark-read, pruning | [`lib/notifications/index.ts`](../lib/notifications/index.ts) |
| Canali (sink) | [`lib/notifications/channels/`](../lib/notifications/channels/) |
| Cattura eventi Better Auth (hook) | [`lib/notifications/auth-hooks.ts`](../lib/notifications/auth-hooks.ts) |
| Config admin (nel singleton settings) | [`lib/settings/notifications.ts`](../lib/settings/notifications.ts), [`lib/settings/schema.ts`](../lib/settings/schema.ts) |
| Preferenze per-utente (ownership) | [`lib/settings/user.ts`](../lib/settings/user.ts) |
| Template email generico | [`lib/email/templates/notification.ts`](../lib/email/templates/notification.ts) |
| Job: invio email e retention | [`lib/jobs/handlers/notification-email.ts`](../lib/jobs/handlers/notification-email.ts), [`lib/jobs/handlers/notification-prune.ts`](../lib/jobs/handlers/notification-prune.ts), [`worker.ts`](../worker.ts) |
| API utente (ownership) | [`app/api/notifications/`](../app/api/notifications/), [`app/api/me/preferences/`](../app/api/me/preferences/) |
| API admin (RBAC `settings`) | [`app/api/admin/settings/notifications/`](../app/api/admin/settings/notifications/) |
| UI: campanella, pagina, form | [`components/notifications-bell.tsx`](../components/notifications-bell.tsx), [`components/notifications-view.tsx`](../components/notifications-view.tsx), [`components/admin/notification-settings-form.tsx`](../components/admin/notification-settings-form.tsx), [`components/profile/notification-preferences-form.tsx`](../components/profile/notification-preferences-form.tsx) |

---

## I tre concetti

1. **Evento** — qualcosa è accaduto. Una sola chiamata `notify(...)` nel punto in
   cui succede, come [`audit()`](audit-logging.md). Il contenuto (titolo, corpo,
   link) lo fornisce il call site, dove vive il contesto.
2. **Notifica** — un record **per-utente** (modello `Notification`), fonte di
   verità del canale in-app, esattamente come `Job` lo è per le operazioni.
3. **Canale** — il *come* arriva. Ogni canale è un **sink** dietro l'interfaccia
   `NotificationChannelSink`: l'in-app scrive la riga, l'email accoda un job.
   Domani push/realtime sono altri sink, **senza toccare i call site**.

```
notify(evento) ──▶ risolve i canali (catalogo + preferenze utente)
                     ├─ "in-app"  ─▶ scrive Notification  (campanella)
                     └─ "email"   ─▶ accoda job notification-email ─▶ worker ─▶ SMTP
```

---

## Configurazione (lato admin)

Pagina **Notifiche** (`/admin/notifications`, solo admin):

- **Notifiche attive**: interruttore generale. Se spento, non viene creata alcuna
  notifica **tranne quelle obbligatorie** di sicurezza.
- **Giorni di retention**: la pulizia giornaliera del worker elimina **solo le
  notifiche già lette** più vecchie di N giorni. Le **non lette non scadono mai**
  per età, così un utente assente a lungo non perde avvisi mai visti. `0` =
  conserva per sempre.
- **Toggle per tipo**: ogni tipo del catalogo si può spegnere (logica **opt-out**:
  `disabledTypes` contiene gli spenti, un tipo nuovo è attivo di default). I tipi
  **obbligatori** non sono spegnibili.

La config vive nel blob del singleton `SystemSetting` (campo `notifications`),
come quella di audit ed email: nessuna tabella né migrazione. Vedi
[impostazioni di sistema](impostazioni-di-sistema.md).

## Preferenze (lato utente)

Nel **profilo** (`/profile`), sezione *Notifiche*: per ogni tipo, l'utente sceglie
i canali (**in app** / **email**). Default: solo in-app, così l'email è sempre
**opt-in** (niente mail a sorpresa). Le preferenze vivono nel modello
`UserPreference` (un blob `Json` per utente, autorizzazione per **ownership**):
sono un override **sparso**, i tipi non personalizzati usano i `defaultChannels`
del catalogo.

I tipi **obbligatori** (sicurezza) hanno l'in-app forzato e non disattivabile;
l'email resta facoltativa anche per loro.

---

## Cosa viene notificato

Gli eventi di **Better Auth** sono mappati in
[`lib/notifications/auth-hooks.ts`](../lib/notifications/auth-hooks.ts), in
parallelo all'[audit log](audit-logging.md) (stessi punti, scopi diversi). Oggi:

- **Accesso da un nuovo dispositivo** — euristica senza tabelle aggiuntive: è
  "nuovo" se l'utente non ha altre sessioni con lo stesso user-agent.
- **Password modificata**, **email modificata**, **2FA attivata/disattivata**.

Tutti **obbligatori**. Di proposito **non** notifichiamo eventi tecnici (job
interni, ecc.): solo ciò che è rilevante per l'utente.

> Le notifiche scattano solo sui **successi** (un'azione fallita non è accaduta).
> I login falliti restano un segnale per l'[audit log](audit-logging.md), non una
> notifica all'utente.

---

## La pagina completa (solo dalla campanella)

La campanella in topbar mostra il numero di non lette (badge, in **polling** ~45s)
e un popover con le ultime notifiche. Da lì si apre la pagina **Tutte le
notifiche** (`/notifications`): tab *Tutte*/*Non lette*, paginazione, "segna come
lette". Questa pagina **non è una voce di sidebar**: ci si arriva **solo** dalla
campanella.

> Il polling è volutamente rado: la consegna è in-app, non realtime, e una COUNT
> su indice è trascurabile. Il realtime (SSE/toast) sarà un **canale** futuro
> senza modifiche a questa UI.

---

## Estendere

### Aggiungere un tipo di notifica

1. **Registra il tipo** nel catalogo
   ([`lib/notifications/catalog.ts`](../lib/notifications/catalog.ts)), con una
   `type` `"categoria.soggetto.verbo"`, `label`, `description`, `mandatory` e
   `defaultChannels`:

   ```ts
   {
     type: "jobs.run.completed",
     category: "system",
     label: "Operazione completata",
     description: "Quando un'operazione che hai avviato termina.",
     mandatory: false,
     defaultChannels: ["in-app"],
   }
   ```

2. **Chiama `notify()`** dove l'evento accade:

   ```ts
   import { notify } from "@/lib/notifications"

   await notify({
     type: "jobs.run.completed",
     userId: ownerId,
     title: "Operazione completata",
     body: `«${job.label}» è terminata con successo.`,
     url: "/admin/jobs",
   })
   ```

`notify()` è **fail-open** (non lancia mai), rispetta config admin e preferenze
utente, e per i tipi obbligatori forza l'in-app. Per gli eventi rivolti a più
persone (es. tutti gli admin), il chiamante itera e chiama `notify()` una volta
per destinatario.

### Aggiungere un canale (push, realtime, …)

1. aggiungi la voce a `notificationChannels` in
   [`catalog.ts`](../lib/notifications/catalog.ts);
2. crea il sink in [`channels/`](../lib/notifications/channels/) che implementa
   `NotificationChannelSink`;
3. registralo nella mappa `sinks` di
   [`index.ts`](../lib/notifications/index.ts).

Nessun call site cambia: chi chiama `notify()` non sa quali canali esistono.

### Evoluzione: digest email

Oggi l'email è immediata (un job per notifica). Per un **riepilogo** (giornaliero,
"immediata / digest / off" per-tipo) si aggiunge un'opzione alle preferenze e un
cron nel [worker](operazioni-in-background.md) che aggrega le notifiche del
periodo: l'infrastruttura (coda + cron) c'è già.

---

## Retention (pruning)

L'handler
[`notification-prune`](../lib/jobs/handlers/notification-prune.ts) elimina le
notifiche **lette** più vecchie di `retentionDays`. È schedulato ogni giorno alle
03:45 in [`worker.ts`](../worker.ts) e compare tra le operazioni in
`/admin/jobs` (eseguibile anche a mano). È l'**unico** punto che cancella
notifiche. Vedi [operazioni in background](operazioni-in-background.md).
