# Gestione dei file (storage e accesso)

Questa guida spiega come il progetto **salva e serve i file** caricati (il logo,
i file degli utenti) e come aggiungere nuove funzionalità di upload. Il
sottosistema è pensato come **base da forkare**: oggi salva su filesystem, ma è
costruito per scalare a tanti file (anche grandi, foto/video) e per cambiare
backend senza riscrivere l'applicazione.

---

## Due lati di un file: byte e metadati

Ogni file ha due parti, tenute separate apposta:

- **I byte** vivono nello **storage** ([`lib/storage/`](../lib/storage/)), oggi su
  filesystem sotto la cartella `STORAGE_DIR` — **fuori da `public/`**, così
  nessun file è raggiungibile saltando i controlli.
- **I metadati** vivono su **Postgres** nel modello `File`
  ([`prisma/schema.prisma`](../prisma/schema.prisma)): id, `storageKey`,
  `mimeType`, `size`, `originalName`, proprietà. La riga è la fonte di verità per
  il lookup e l'autorizzazione.

Salvare i byte su disco invece che nel database è voluto: mettere foto/video in
Postgres gonfia DB e backup e non si streamma bene. Il database tiene solo i
metadati, leggeri.

---

## Due assi di proprietà (gli stessi delle impostazioni)

Il campo `ownerType` distingue due tipi di file, con **due modelli di
autorizzazione diversi** — gli stessi due assi descritti in
[`impostazioni-di-sistema.md`](impostazioni-di-sistema.md):

|                | File di **sistema** (`ownerType = "system"`) | File **utente** (`ownerType = "user"`) |
| -------------- | -------------------------------------------- | -------------------------------------- |
| Esempio        | il logo                                      | i file di uno scraper / di un archivio |
| Chi scrive     | solo admin                                   | solo il proprietario                   |
| Chi legge      | tutti                                        | solo il proprietario                   |
| Autorizzazione | **RBAC** (permesso `settings`)               | **ownership** (`ownerId === userId`)   |
| `ownerId`      | `null`                                       | l'`id` dell'utente                     |

L'autorizzazione di lettura è in [`lib/files.ts`](../lib/files.ts) (`canRead`):
i file di sistema sono pubblici, quelli utente solo del proprietario. La scrittura
dei file di sistema è regolata a monte dal permesso RBAC `settings`.

---

## Come si accede ai file

L'accesso passa **sempre** da route handler autorizzate, mai da link diretti al
disco:

- `GET /api/files/:id` — serve i byte in streaming applicando `canRead`. In caso
  di accesso negato risponde **404** (non 403), per non rivelare l'esistenza di
  file altrui. Imposta header di cache (immutabile per i file di sistema, privato
  per quelli utente) e header di sicurezza (`Content-Security-Policy: sandbox` +
  `X-Content-Type-Options: nosniff`) che neutralizzano eventuali script in un SVG.
- `GET /api/files` — elenco dei file dell'utente autenticato.
- `POST /api/files` — upload di un file dell'utente (multipart, campo `file`).
- `DELETE /api/files/:id` — elimina un file dell'utente (ownership).

Il logo (file di sistema) ha un endpoint admin dedicato:
[`app/api/admin/settings/logo/route.ts`](../app/api/admin/settings/logo/route.ts).

La demo end-to-end dell'asse ownership è la pagina **«I miei file»**
([`app/(dashboard)/files/page.tsx`](<../app/(dashboard)/files/page.tsx>)): upload,
download ed eliminazione dei propri file.

---

## Lo storage è intercambiabile

Tutto lo storage passa da un'unica interfaccia,
[`StorageDriver`](../lib/storage/driver.ts) (`put` / `get` / `delete`). Il driver
attivo si sceglie in un solo punto, [`lib/storage/index.ts`](../lib/storage/index.ts).

Oggi: `FilesystemDriver` ([`lib/storage/filesystem.ts`](../lib/storage/filesystem.ts)),
che scrive sotto `STORAGE_DIR` proteggendosi dal path traversal. In Docker monta
quella cartella come **volume** per renderla persistente.

**Per passare a un object storage** (S3, Cloudflare R2, Vercel Blob — utile in
produzione o su host con filesystem effimero): implementa `StorageDriver` con
l'SDK scelto e sostituisci l'istanza in `lib/storage/index.ts`. Modello `File`,
autorizzazione, route e UI **non cambiano**.

---

## Aggiungere una funzionalità di upload

Esempio: allegati a una risorsa dell'utente.

1. **Salva il file** con il service: `createUserFile(userId, { buffer, mimeType,
   originalName })` (o `createSystemFile(...)` per un file globale, dopo un check
   RBAC). Restituisce i metadati, incluso l'`id`.
2. **Conserva il riferimento**: salva l'`id` del file dove ti serve (una colonna,
   un campo del blob impostazioni come fa il logo, ecc.).
3. **Mostralo/scaricalo** puntando a `/api/files/<id>` (es. `src` di un `<img>` o
   `href` di un link con `download`).
4. **Validazione**: usa [`readUpload`](../lib/upload.ts) per leggere il multipart
   applicando limiti di dimensione e, se vuoi, una whitelist di `mimeType`
   (`IMAGE_MIME_TYPES` per le immagini).

Per file molto grandi (video) valuta in futuro l'upload/serving in streaming e le
richieste con `Range`: l'interfaccia del driver è il punto giusto dove aggiungerli.

---

## Riferimenti

- Impostazioni di sistema e branding: [`impostazioni-di-sistema.md`](impostazioni-di-sistema.md)
- Autenticazione, ruoli e RBAC: [`autenticazione-e-ruoli.md`](autenticazione-e-ruoli.md)
