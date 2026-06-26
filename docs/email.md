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
  index.ts             sceglie il driver attivo e lo espone come `email`
  render.ts            interpolazione dei segnaposto {{var}} + escape HTML
  auth-emails.ts       ponte tra i flussi di Better Auth e l'invio
  templates/
    layout.ts          guscio HTML brandizzato condiviso (CSS inline)
    types.ts           forma di un EmailTemplate (sorgente + variabili dichiarate)
    index.ts           registry dei template + renderTemplate()
    verify-email.ts, reset-password.ts, change-email.ts, delete-account.ts
```

Per spedire si usa sempre l'istanza unica:

```ts
import { email } from "@/lib/email"

await email.send({ to, subject, html, text })
```

## Scelta del driver

Il driver attivo lo decide [`lib/email/index.ts`](../lib/email/index.ts):

1. se `EMAIL_DRIVER` è impostato (`console` | `smtp`), vince quello;
2. altrimenti il default per ambiente: **`console` in sviluppo**, **`smtp` in
   produzione**.

In sviluppo, quindi, le email **non partono**: il loro contenuto (e i link di
verifica/reset) finisce nei log del server, come prima. Per provare l'invio reale
anche in locale imposta `EMAIL_DRIVER="smtp"` e le variabili SMTP in `.env`.

L'istanza è creata in modo **pigro**: il driver SMTP valida le credenziali e apre
il transporter alla prima vera spedizione, non al solo import del modulo.

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

Le credenziali SMTP sono **segreti**: stanno solo in `.env`, mai nelle
[impostazioni di sistema](impostazioni-di-sistema.md) (il loro blob viene in
parte inviato al browser). Variabili (vedi `.env.example`):

| Variabile       | Note                                                       |
| --------------- | ---------------------------------------------------------- |
| `EMAIL_FROM`    | mittente, es. `App <no-reply@dominio.it>` — obbligatorio   |
| `SMTP_HOST`     | host del server SMTP                                        |
| `SMTP_PORT`     | porta (default `587`)                                      |
| `SMTP_USER`     | utente                                                      |
| `SMTP_PASSWORD` | password / API key                                         |
| `SMTP_SECURE`   | `true` = TLS implicito (465); `false` = STARTTLS (587)     |

Se il driver è `smtp` ma manca una di queste, l'invio fallisce con un errore
chiaro che elenca cosa manca.

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
