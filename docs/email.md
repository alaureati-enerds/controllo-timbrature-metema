# Invio email (driver e template)

L'app invia email transazionali per i flussi di autenticazione (verifica
indirizzo, reset password, cambio email, eliminazione account). Come per lo
[storage dei file](gestione-file.md), il backend è dietro un'astrazione a
**driver intercambiabile**: il resto del codice non sa _come_ parte una mail.

## Idea in breve

```
lib/email/
  driver.ts            interfaccia EmailDriver { send(message) } + tipo EmailMessage
  console.ts           driver di sviluppo: NON spedisce, logga il messaggio
  smtp.ts              driver di produzione: spedisce via SMTP (Nodemailer)
  index.ts             costruisce il driver dalla config risolta e lo espone come `email`
  render.ts            interpolazione dei segnaposto {{var}} + escape HTML
  auth-emails.ts       ponte tra i flussi di Better Auth e l'invio
  templates/
    layout.ts          guscio HTML brandizzato condiviso (CSS inline)
    types.ts           forma di un EmailTemplate (sorgente + variabili dichiarate)
    index.ts           registry dei template + renderTemplate()
    verify-email.ts, reset-password.ts, change-email.ts, delete-account.ts
```

La **configurazione** (driver e credenziali) sta invece fuori da `lib/email/`,
nelle impostazioni di sistema: [`lib/settings/email.ts`](../lib/settings/email.ts)
risolve GUI + `.env` e [`lib/crypto.ts`](../lib/crypto.ts) cifra la password.

Per spedire si usa sempre l'istanza unica:

```ts
import { email } from "@/lib/email"

await email.send({ to, subject, html, text })
```

## Da dove arriva la configurazione

La config email ha **due sorgenti**, con una regola di precedenza chiara:
**la GUI (Impostazioni di sistema → Email) prevale, `.env` fa da fallback** —
campo per campo. La risoluzione vive in
[`lib/settings/email.ts`](../lib/settings/email.ts) (`getResolvedEmailConfig`):
per ogni valore «quello salvato da GUI ?? quello in `.env`».

Il **driver attivo** si decide così:

1. se è impostato da GUI (`console` | `smtp`), vince quello;
2. altrimenti se è impostato `EMAIL_DRIVER` in `.env`, vince quello;
3. altrimenti il default per ambiente: **`console` in sviluppo**, **`smtp` in
   produzione**.

In sviluppo, di default, le email **non partono**: il loro contenuto (e i link
di verifica/reset) finisce nei log del server. Per l'invio reale imposta il
driver su `smtp` (da GUI o via `EMAIL_DRIVER`) e fornisci host/mittente.

[`lib/email/index.ts`](../lib/email/index.ts) costruisce il driver in modo pigro
e lo **memorizza legandolo a una fingerprint della config**: se la config cambia
(anche da GUI, senza riavvio) il driver viene ricostruito al primo invio
successivo. Niente singleton stale: una modifica delle credenziali si applica
subito.

## Verificare i flussi in locale (Mailpit)

`docker-compose.yml` include **Mailpit**, un server SMTP "trappola" per lo
sviluppo: cattura le email senza spedirle e le mostra in una UI web. Per usarlo:

1. avvia i servizi: `docker compose up -d` (alza anche `mailpit`);
2. nel `.env` punta il driver a Mailpit (vedi `.env.example`):
   ```
   EMAIL_DRIVER="smtp"
   SMTP_HOST="localhost"
   SMTP_PORT=1026
   EMAIL_FROM="shadcn starter <no-reply@example.com>"
   ```
   (niente `SMTP_USER`/`SMTP_PASSWORD`: Mailpit non autentica);
3. riavvia `npm run dev` e fai partire un flusso (es. registra un utente);
4. apri **http://localhost:8026**: la mail catturata è lì, con anteprima HTML e
   testo. Nessun invio reale parte verso l'esterno.

> Le porte host (1026 SMTP, 8026 UI) sono sfasate rispetto a quelle standard di
> Mailpit (1025/8025) per non collidere con altri Mailpit eventualmente già
> attivi in locale, come fa Postgres con la 5433.

## Configurazione SMTP

### Dalla GUI (consigliato)

La pagina **Impostazioni di sistema → Email** (`/admin/settings`, solo admin)
configura driver, mittente, host, porta, TLS, utente e password senza toccare il
deploy. La config si salva nel blob del singleton `SystemSetting` (campo
`email`), che è **server-only**: non finisce mai in `toPublicSettings()` e quindi
non viene inviato al browser.

La **password è un segreto**: viene salvata **cifrata** (AES-256-GCM,
[`lib/crypto.ts`](../lib/crypto.ts)) con una chiave derivata da `SETTINGS_SECRET`.
Non viene mai restituita al client: il form riceve solo un flag `passwordSet` e in
scrittura la password si aggiorna **solo se** ne digiti una nuova (oppure la
rimuovi esplicitamente). Per usarla devi avere `SETTINGS_SECRET` nel `.env`
(genera con `openssl rand -base64 32`).

Il pulsante **«Invia email di prova»** spedisce una mail alla tua casella usando
la config **salvata**: serve a validare le credenziali subito. A differenza
dell'invio normale, qui l'eventuale errore SMTP viene mostrato per intero, così
sai cosa correggere.

### Da `.env` (fallback)

Le stesse variabili restano disponibili come fallback (utili in CI/Docker o per
il bootstrap). I campi non impostati da GUI ricadono qui:

| Variabile        | Note                                                       |
| ---------------- | ---------------------------------------------------------- |
| `SETTINGS_SECRET`| chiave per cifrare la password SMTP salvata da GUI         |
| `EMAIL_FROM`     | mittente, es. `App <no-reply@dominio.it>` — obbligatorio   |
| `SMTP_HOST`      | host del server SMTP                                        |
| `SMTP_PORT`      | porta (default `587`)                                      |
| `SMTP_USER`      | utente (opzionale)                                          |
| `SMTP_PASSWORD`  | password / API key (in chiaro nel `.env`; opzionale)       |
| `SMTP_SECURE`    | `true` = TLS implicito (465); `false` = STARTTLS (587)     |

Se il driver è `smtp` ma, una volta risolta la config (GUI + `.env`), manca
l'essenziale (host o mittente), l'invio fallisce con un errore chiaro.

## Template: stringhe con segnaposto (editor-ready)

Un template è una **sorgente stringa** (oggetto + HTML + testo) con segnaposto
`{{nome}}`, più l'elenco delle variabili attese. La scelta di tenere la sorgente
come **stringa** — e non come componente React — è deliberata: rende i template
editabili da un eventuale **editor frontend** (WYSIWYG/MJML), che produce HTML e
lo salva, mentre un componente React non sarebbe generabile da un editor.

Il rendering ([`render.ts`](../lib/email/render.ts)) sostituisce i segnaposto e
**lancia se uno è privo di valore**: meglio un errore in fase di invio che una
mail con un buco `{{...}}` visibile. I valori finiscono nel corpo HTML **con
escape** (un nome con `<` o `&` non rompe né inietta markup), mentre oggetto e
corpo testuale restano grezzi (lì l'escape corromperebbe gli URL).

Il branding (nome del software) è iniettato automaticamente da
[`auth-emails.ts`](../lib/email/auth-emails.ts) leggendo le impostazioni di
sistema, così tutte le mail mostrano il nome corrente dell'app.

### Aggiungere un template

1. crea `lib/email/templates/<nome>.ts` esportando un `EmailTemplate` (usa
   `layout()` per il guscio brandizzato);
2. registralo in [`templates/index.ts`](../lib/email/templates/index.ts);
3. spediscilo con `renderTemplate("<id>", vars)` + `email.send({ to, ...msg })`,
   o aggiungi una funzione dedicata in `auth-emails.ts`.

### Evoluzione: override da editor frontend

`resolveTemplate()` in `templates/index.ts` oggi ritorna sempre la sorgente di
default versionata in git. È il **punto di estensione** per un editor: quando
servirà, qui si cercherà prima una versione personalizzata salvata a DB e si
ricadrà sul default. La funzione è già `async` apposta, così introdurre la
lettura dal DB non toccherà i call site.

## Cambiare provider (Resend, SES, ...)

Implementa un nuovo driver che soddisfa `EmailDriver` (un solo metodo `send`) e
istanzialo in [`lib/email/index.ts`](../lib/email/index.ts). Nient'altro nel
codebase cambia: né i call site, né i template.
