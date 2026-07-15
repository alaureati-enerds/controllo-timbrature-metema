# Deploy in produzione con Docker

Questa guida porta l'applicazione in produzione con Docker, dietro un **NGINX
reverse proxy esterno** che gestisce TLS e routing. L'app viene esposta su una
porta dell'host; al resto pensa il proxy. Lo stesso setup si prova **in locale**
identico alla produzione, senza bisogno di un server di test.

In breve:

- **Un'unica immagine** Docker (sorgente + dipendenze + build Next + client
  Prisma) fa girare i tre processi dell'app cambiando solo il comando.
- **Tre processi** a runtime: `web` (Next.js), `worker` (job e cron in
  background) e `migrate` (one-shot: applica migration + seed). Più Postgres.
- **Stato persistente** in due volumi: `pgdata` (database) e `storage` (file
  caricati dagli utenti).

I file coinvolti: [`Dockerfile`](../Dockerfile),
[`.dockerignore`](../.dockerignore),
[`docker-compose.prod.yml`](../docker-compose.prod.yml) e
[`.env.production.example`](../.env.production.example).

---

## Architettura

L'app non è un singolo processo. Il compose di produzione avvia quattro servizi:

| Servizio   | Comando                         | Ruolo                                                                 |
| ---------- | ------------------------------- | --------------------------------------------------------------------- |
| `postgres` | —                               | PostgreSQL 16. Solo rete interna, dati nel volume `pgdata`.            |
| `migrate`  | `db:deploy` + `db:seed`         | One-shot: applica le migration pendenti e il seed (idempotenti).      |
| `web`      | `npm run start`                 | Server Next.js, ascolta sulla 3000 (esposta come `WEB_PORT` sull'host). |
| `worker`   | `npm run worker`                | Coda job + schedulazioni cron (pg-boss). Sempre attivo.               |

`web` e `worker` partono **solo dopo** che `migrate` è terminato con successo:
così ad ogni avvio il database è già allineato. Il `worker` è indispensabile —
senza, le [operazioni in background](operazioni-in-background.md) e le
[notifiche email](notifiche.md) non vengono elaborate.

Perché un'immagine "piena" e non l'output `standalone` di Next: il worker gira
sul sorgente TypeScript via `tsx`, quindi servono comunque `node_modules`
completo e i file sorgente. Un'unica immagine condivisa è la soluzione più
semplice e robusta.

---

## Configurazione (`.env.production`)

Copia il template e compila i valori:

```bash
cp .env.production.example .env.production
```

Genera i segreti con `openssl rand -base64 32`.

> **Non mettere le virgolette attorno ai valori.** Il file è caricato dai
> container via `env_file:`. Con **docker-compose v1** (il vecchio comando col
> trattino) i valori di `env_file` arrivano al container *letterali, virgolette
> comprese*: `DATABASE_URL="postgresql://…"` fa vedere a Prisma lo schema come
> `"postgresql` e fallisce con `P1013` (vedi *Risoluzione problemi*). Scrivi i
> valori nudi — `VAR=valore` — anche se contengono spazi o caratteri speciali.
> Se la **password del DB** contiene caratteri speciali di URL (`@ : / ? #` o
> spazi) vanno codificati percent nella `DATABASE_URL` (es. `/` → `%2F`); il modo
> più semplice per evitarlo è usare una password senza quei caratteri
> (es. `openssl rand -hex 24`).

Le variabili da non sbagliare:

- **`DATABASE_URL`** — in Docker punta all'host interno `postgres:5432` (non
  `localhost:5433`, che è solo lo sviluppo sull'host). Utente, password e nome
  DB devono combaciare con i `POSTGRES_*`.
- **`WEB_PORT`** — la porta dell'host su cui esporre l'app al tuo NGINX.
- **`BETTER_AUTH_SECRET`** e **`SETTINGS_SECRET`** — segreti robusti.
  `SETTINGS_SECRET` cifra i segreti salvati a DB (es. password SMTP da GUI): non
  cambiarlo dopo l'uso, invaliderebbe i dati già cifrati.
- **`BETTER_AUTH_URL`** — l'URL pubblico dell'app. È **obbligatorio** in
  produzione: serve a Better Auth per costruire i link nelle email, per le
  origini ammesse (login/CSRF) e per decidere se i cookie sono `Secure`.
  - **In produzione** (dietro proxy con TLS): `https://<dominio>`. I cookie
    saranno `Secure`, quindi l'NGINX **deve** inoltrare `X-Forwarded-Proto: https`.
  - **In test locale** (senza TLS): `http://localhost:<WEB_PORT>`, così i cookie
    non sono `Secure` e il login funziona su http. È l'unica differenza tra il
    file env locale e quello reale.
- **`EMAIL_DRIVER`** — al primo avvio tienilo su `console` (vedi nota sul seed
  più sotto). L'SMTP reale si configura poi da Impostazioni → Email (ha la
  precedenza) o impostando `EMAIL_DRIVER=smtp` con i parametri `SMTP_*`.
- **`SEED_ADMIN_*`** — l'admin iniziale creato al primo avvio. Imposta una
  password forte: è l'account del primo login.

> **Perché `EMAIL_DRIVER=console` al primo avvio.** Il seed crea l'admin
> passando dalla registrazione di Better Auth, che tenta di inviare una mail di
> verifica. Con il driver `smtp` ma senza SMTP configurato, l'invio fallirebbe e
> il seed si interromperebbe. Con `console` la mail viene solo loggata; l'admin
> è comunque marcato come verificato e può accedere subito. Configura l'SMTP
> reale dopo il primo login.

---

## Provare in locale (senza server)

Stesso setup della produzione, sulla tua macchina:

1. Crea `.env.production` (vedi sopra) con:
   - `BETTER_AUTH_URL=http://localhost:<WEB_PORT>` (http, così il login funziona),
   - `EMAIL_DRIVER=console`,
   - `SEED_ADMIN_PASSWORD` a tua scelta.
 2. Avvia (il flag `--env-file` serve anche all'interpolazione di `WEB_PORT`):

   ```bash
   # docker compose v2 (nuovo)
   docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build

   # docker-compose v1 (vecchio): aggiungi -p per isolare lo stack di produzione
   docker-compose --env-file .env.production -p controllo-timbrature-metema-prod -f docker-compose.prod.yml up -d --build
   ```

3. Verifica lo stato:

   ```bash
   # v2
   docker compose -f docker-compose.prod.yml ps
   docker compose -f docker-compose.prod.yml logs -f web
   docker compose -f docker-compose.prod.yml logs -f worker

   # v1 (usa sempre -p con lo stesso project name dell'avvio)
   docker-compose -p controllo-timbrature-metema-prod -f docker-compose.prod.yml ps
   docker-compose -p controllo-timbrature-metema-prod -f docker-compose.prod.yml logs -f web
   docker-compose -p controllo-timbrature-metema-prod -f docker-compose.prod.yml logs -f worker
   ```

4. Apri `http://localhost:<WEB_PORT>` e accedi con l'admin del seed. La mail di
   verifica del seed la trovi nei log (driver `console`); l'admin è già verificato.

Per fermare tutto:
```bash
# v2
docker compose -f docker-compose.prod.yml down

# v1
docker-compose -p controllo-timbrature-metema-prod -f docker-compose.prod.yml down
```
(I dati restano nei volumi. Aggiungi `-v` solo per azzerare anche database e file.)

---

## In produzione

Identico al locale, cambiando solo `.env.production`:

- `BETTER_AUTH_URL=https://<dominio>`;
- SMTP reale (da GUI dopo il primo accesso, oppure `EMAIL_DRIVER=smtp` + `SMTP_*`);
- password e segreti robusti.

```bash
# v2
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build

# v1
docker-compose --env-file .env.production -p controllo-timbrature-metema-prod -f docker-compose.prod.yml up -d --build
```

L'app risponde su `127.0.0.1:<WEB_PORT>`: configura il tuo NGINX per inoltrarvi
il traffico.

### NGINX reverse proxy (riferimento)

Il proxy lo configuri tu; questo è un blocco di riferimento. Punti chiave:
inoltrare `X-Forwarded-Proto https` (indispensabile per i cookie `Secure`) e
alzare `client_max_body_size` per gli upload dei file.

```nginx
server {
    listen 443 ssl;
    server_name tuo-dominio.it;

    # ssl_certificate / ssl_certificate_key ...

    client_max_body_size 25m;   # adegua al limite di upload desiderato

    location / {
        proxy_pass http://127.0.0.1:3000;   # = WEB_PORT
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host  $host;
    }
}
```

---

## Aggiornamenti

```bash
git pull

# v2
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d

# v1
docker-compose --env-file .env.production -p controllo-timbrature-metema-prod -f docker-compose.prod.yml build
docker-compose --env-file .env.production -p controllo-timbrature-metema-prod -f docker-compose.prod.yml up -d
```

L'`up` riesegue il servizio `migrate` (applica le migration pendenti e il seed,
entrambi idempotenti) **prima** di far ripartire `web` e `worker` con la nuova
immagine. I volumi `pgdata` e `storage` non vengono toccati: dati e file restano.

Per un **rollback** torna al tag/commit precedente (`git checkout <tag>`) e
ricostruisci. Attenzione: le migration già applicate non vengono annullate
automaticamente; se un aggiornamento le include, valuta un backup del DB prima.

### Backup

Lo stato vive tutto nei due volumi. Esempi:

```bash
# Database (dump SQL)
# v2
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql

# v1
docker-compose -p controllo-timbrature-metema-prod -f docker-compose.prod.yml exec postgres \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup.sql

# File caricati (volume storage) — copia su un archivio
docker run --rm -v controllo-timbrature-metema-prod_storage:/data -v "$PWD":/out alpine \
  tar czf /out/storage-backup.tar.gz -C /data .
```

(I volumi sono prefissati col project name: se usi `-p controllo-timbrature-metema-prod`,
i volumi saranno `controllo-timbrature-metema-prod_pgdata` e
`controllo-timbrature-metema-prod_storage`. Verificali con `docker volume ls`.)

---

## Risoluzione problemi

- **Il login non funziona in locale** → `BETTER_AUTH_URL` è impostato su
  `https://…` mentre apri l'app su `http://`: i cookie `Secure` non vengono
  inviati. In locale usa `http://localhost:<WEB_PORT>`.
- **`P1013: The scheme is not recognized in database URL`** → in `.env.production`
  hai messo le virgolette attorno alla `DATABASE_URL` (o ad altri valori). Con
  docker-compose v1 le virgolette entrano nel valore e Prisma legge lo schema come
  `"postgresql`. Togli le virgolette da **tutti** i valori del file (`VAR=valore`)
  e riavvia. Se la password del DB ha caratteri speciali di URL, codificali
  percent nella `DATABASE_URL` (es. `/` → `%2F`) oppure usa una password senza.
- **`migrate` esce con errore di invio email** → `EMAIL_DRIVER` non è `console`
  e l'SMTP non è raggiungibile. Imposta `EMAIL_DRIVER=console` per il primo avvio.
- **`web` riparte in loop** → controlla `logs web`: spesso è una variabile
  mancante o errata (la validazione in `lib/env.ts` elenca i campi non validi).
- **Le date/i contatori sembrano fermi o i job non partono** → verifica che il
  servizio `worker` sia `up` e che nei log compaia "Worker job avviato".
