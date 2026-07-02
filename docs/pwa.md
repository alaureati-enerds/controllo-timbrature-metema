# PWA (Progressive Web App)

L'applicazione è installabile come PWA: l'utente può aggiungerla alla Home
screen del dispositivo (o al desktop) e avviarla in una finestra standalone,
senza barra del browser, come fosse un'app nativa. L'implementazione è
costruita su funzionalità native di Next.js 16, senza librerie esterne.

In breve:

- **Manifest dinamico** (`app/manifest.ts`): nome, icone e colori sono
  dichiarati nel web app manifest. Il nome viene letto dal singleton
  `SystemSetting`, come il `<title>`, quindi cambia subito se l'admin lo
  modifica.
- **Service worker minimale** (`public/sw.js`): registra un SW con un
  handler `fetch` no-op. Non fa caching offline, serve solo a soddisfare il
  criterio di installabilità di Chromium e a predisporre i listener per
  future notifiche push.
- **Icone generate** (`app/icon.tsx`, `app/apple-icon.tsx`): favicon e Apple
  touch icon sono generate al build con `ImageResponse` di `next/og`,
  coerenti con i colori del tema. Le icone del manifest (192/512/maskable)
  sono file statici in `public/`.

L'installazione avviene tramite la **UI nativa del browser** (icona di
installazione nella barra di Chrome, banner o menu "Aggiungi al Dock /
a Home screen" su Safari): non serve un componente personalizzato, ogni
browser offre già il proprio prompt ottimale.

---

## Dove vive

| Pezzo | File |
| --- | --- |
| Web app manifest (dinamico) | [`app/manifest.ts`](../app/manifest.ts) |
| Favicon (generata) | [`app/icon.tsx`](../app/icon.tsx) |
| Apple touch icon (generata) | [`app/apple-icon.tsx`](../app/apple-icon.tsx) |
| Service worker | [`public/sw.js`](../public/sw.js) |
| Icone manifest (192/512/maskable) | `public/icon-*.png` |
| Header di sicurezza | [`next.config.ts`](../next.config.ts) (funzione `headers`) |

---

## Come funziona l'installabilità

Un browser considera installabile un sito quando:

1. È servito su **HTTPS** (Vercel lo fa automaticamente; in dev vedi sotto).
2. Ha un **web app manifest** valido con `name`, `icons`, `start_url` e
   `display`.
3. Ha un **service worker** registrato con almeno un handler `fetch`.

Quando i criteri sono soddisfatti, Chromium mostra automaticamente il prompt
di installazione (icona nella barra o `beforeinstallprompt`). iOS non
supporta `beforeinstallprompt`: l'utente deve aggiungere manualmente l'app
alla Home screen dal pulsante Condividi di Safari.

---

## Il manifest

Il file `app/manifest.ts` è un route handler speciale di Next.js: esporta
una funzione che ritorna un `MetadataRoute.Manifest`. Next.js lo serve su
`/manifest.webmanifest` e aggiunge automaticamente il `<link rel="manifest">`
all'`<head>`.

Il manifest è **dinamico** (legge `getSystemSettings()`): non è staticamente
ottimizzato a build time, ma rigenerato a runtime, così il `name` e lo
`short_name` seguono l'impostazione admin esattamente come il `<title>`.

### Token del tema

`theme_color` e `background_color` sono hardcoded sui valori del tema chiaro
di default (`:root` in `app/globals.css`):

- `background_color: "#ffffff"` (uguale a `--background` light)
- `theme_color: "#1f1f24"` (approssimazione esadecimale di `--primary` light)

Il web manifest supporta un solo colore per chiave (niente varianti dark).
`theme_color` influisce solo sulla UI di sistema della PWA (status bar,
splash screen), non sul contenuto dell'app, che continua a rispettare
`next-themes` e il selettore tema in topbar.

---

## Le icone

Ci sono due sistemi di icone, distinti:

1. **Favicon e Apple touch icon** — generate dinamicamente al build con
   `ImageResponse` da `next/og` nei file convention `app/icon.tsx` e
   `app/apple-icon.tsx`. Sono segnaposto (sfondo `#1f1f24` + lettera "S"),
   sostituibili con file statici o con logica personalizzata.
2. **Icone del manifest** — file PNG statici in `public/`:
   `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`. Anch'esse
   segnaposto, generate con sharp.

Per sostituire le icone con un logo reale:

- Sostituisci i file `public/icon-*.png` con le versioni definitive.
- Per favicon/apple-icon, o sostituisci i file `app/icon.tsx` /
  `app/apple-icon.tsx` con i file statici `app/icon.png` /
  `app/apple-icon.png`, oppure modifica la JSX di `ImageResponse`.
- Aggiorna gli `icons` nel manifest se cambi i nomi dei file.

---

## Il service worker

`public/sw.js` è un SW minimale:

- `install` con `skipWaiting()` e `activate` con `clients.claim()`: prende
  il controllo subito, senza aspettare il reload.
- Handler `fetch` **passthrough** (`event.respondWith(fetch(event.request))`):
  niente caching, il SW esiste solo per soddisfare il criterio di
  installabilità di Chromium.
- Listener `push` e `notificationclick` predisposti per future notifiche
  web push (vedi [Estensioni future](#estensioni-future)).

L'header `Cache-Control: no-cache, no-store, must-revalidate` su `/sw.js`
(vedi `next.config.ts`) garantisce che il browser scarichi sempre la versione
più recente del SW.

---

## Registrazione del service worker

Il service worker `public/sw.js` viene registrato da uno **script inline**
in `app/layout.tsx`: allo scatenarsi dell'evento `load`, chiama
`navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })`.
L'approccio inline (anziché un componente React client) evita overhead di
hydration per una singola riga di codice imperativo.

L'header `Cache-Control: no-cache, no-store, must-revalidate` su `/sw.js`
(vedi `next.config.ts`) garantisce che il browser scarichi sempre la versione
più recente del SW.

---

## Header di sicurezza

La funzione `headers()` in `next.config.ts` aggiunge:

- **Globali** su `/(.*)`:
  - `X-Content-Type-Options: nosniff` (anti MIME-sniffing)
  - `X-Frame-Options: DENY` (anti clickjacking)
  - `Referrer-Policy: strict-origin-when-cross-origin`
- **Specifici** per `/sw.js`:
  - `Content-Type: application/javascript; charset=utf-8`
  - `Cache-Control: no-cache, no-store, must-revalidate`
  - `Content-Security-Policy: default-src 'self'; script-src 'self'`

---

## Test in sviluppo

L'installabilità richiede HTTPS. Per testare in locale:

```bash
npm run dev -- --experimental-https
```

Questo genera un certificato self-signed e serve il dev server su HTTPS. A
questo punto:

- Su desktop Chromium: l'icona di installazione appare nella barra.
- Su mobile: connettiti al PC via IP LAN (gli `allowedDevOrigins` in
  `next.config.ts` coprono già le reti locali più comuni) e usa "Aggiungi
  a Home screen" dal menu del browser.

Per testare solo l'aspetto installabile senza HTTPS (es. su desktop), puoi
ignorare l'errore di certificato: il manifest e lo SW funzionano comunque
su `localhost`, che Chromium tratta come origin sicura.

---

## Estensioni future

### Notifiche web push

Il service worker ha già i listener `push` e `notificationclick`. Per
attivare le notifiche push:

1. Installa `web-push` (`npm i web-push`).
2. Genera le chiavi VAPID con `web-push generate-vapid-keys`.
3. Aggiungi `NEXT_PUBLIC_VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` a `.env`.
4. Crea un modello Prisma `PushSubscription` per persistere le subscription
   per-utente.
5. Crea server actions `subscribeUser` / `unsubscribeUser` /
   `sendNotification` (es. in `app/actions.ts`).
6. Integra l'invio con il worker `pg-boss` esistente: invece di inviare
   subito, accoda un job che chiama `webpush.sendNotification`. Vedi
   [Operazioni in background](operazioni-in-background.md).
7. Il canale push può diventare un nuovo `NotificationChannelSink` nel
   sistema di notifiche (vedi [Notifiche](notifiche.md)): così ogni tipo
   di notifica esistente può recapitare anche via push, senza toccare i
   call site.

### Supporto offline (caching)

Il SW attuale non fa caching. Per aggiungere il supporto offline, l'opzione
raccomandata dalla guida ufficiale Next.js è
[Serwist](https://github.com/serwist/serwist). Nota: la guida avverte che
richiede configurazione webpack, mentre il progetto usa Turbopack: verificare
la compatibilità prima di procedere.

### `theme_color` dinamica

Il manifest ha un solo `theme_color`. Per adattarlo al tema chiaro/scuro si
può aggiungere un `<meta name="theme-color">` con media query in
`app/layout.tsx`:

```html
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#1f1f24" media="(prefers-color-scheme: dark)" />
```

Questo non sostituisce il `theme_color` del manifest, ma lo integra per i
browser che supportano la media query.
