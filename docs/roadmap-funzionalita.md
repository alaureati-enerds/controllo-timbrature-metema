# Roadmap funzionalità

Analisi delle funzionalità mancanti rispetto alla base già implementata.
Aggiornata: giugno 2026.

---

## Cosa è già presente

| Area | Funzionalità |
|---|---|
| Auth | Login/registrazione email+password, verifica email, reset password, 2FA TOTP, sessioni tracciate (IP + UA), RBAC admin/user |
| Profilo | Modifica nome/email/foto, cambio password, gestione 2FA, sessioni attive |
| File | Upload/download/eliminazione con ownership, storage intercambiabile (filesystem oggi) |
| Ricerca globale | Palette ⌘K — voci menu, estendibile via registry |
| Job background | Accodamento, progress, cancellazione cooperativa, cron schedulato (pg-boss) |
| Audit log | Registro append-only, configurabile per evento e retention, anti-flood |
| Gestione utenti (admin) | Lista, dettaglio, ban/unban, cambio ruolo, reset 2FA, impersonation |
| Impostazioni sistema | Branding (nome, icona), config email (console/SMTP), config audit |
| Email | Driver intercambiabile, template HTML brandizzati, email transazionali auth |

---

## Funzionalità mancanti

### Priorità alta — gap evidenti nell'uso quotidiano

**Dashboard con metriche**
La home page è uno scheletro vuoto. Con i dati già in DB (utenti, file, job)
basterebbe poco per avere widget significativi: utenti registrati, job in coda, ultimo
errore, spazio storage usato.

**Notifiche in-app**
Nessun sistema di notifiche. I job completano ma l'utente non lo sa a meno di non
riaprire la pagina. Una bell-icon nella topbar con lista notifiche (modello
`Notification`, letta/non letta) si integra bene con l'infrastruttura job già presente.

**Paginazione robusta**
Le liste (file, utenti admin) usano limiti fissi. Senza cursor-based pagination
o server-side paging non scalano — problema strutturale che peggiora col tempo.

**Log accessi personale per l'utente**
L'audit log è visibile solo all'admin. L'utente non ha modo di vedere da dove si è
loggato, quali sessioni ha aperto, o se c'è stata attività sospetta — eppure le
sessioni sono già tracciate con IP e user-agent.

---

### Priorità media — arrotondano il sistema

**Export dati (CSV/XLSX)**
L'admin non può esportare log di audit, lista utenti, log job. Mancanza sentita per
analisi esterne o compliance.

**Tag/Categorie**
I file non hanno categorizzazione. Con molti record la ricerca per testo non
basta — servono filtri strutturati.

**Preview file in-browser**
Il file manager scarica i file ma non li visualizza. Immagini e PDF potrebbero essere
mostrati direttamente in un Dialog.

**API Key management**
Nessun accesso programmatico all'API. Per integrazioni esterne, gli utenti oggi non
hanno alternativa alle sessioni browser.

---

### Priorità media-bassa — maturità e compliance

**GDPR — export dati personali**
L'utente può eliminare l'account ma non scaricare tutti i suoi dati (GDPR art. 20).

**Alert su eventi critici**
L'audit log raccoglie tutto ma non reagisce. Troppi login falliti, un nuovo admin
creato, una modifica alle impostazioni: potrebbero generare un'email all'admin via
job già esistenti.

**Maintenance mode**
Nessun modo di mettere l'app in manutenzione dall'UI. Una flag in `SystemSetting` +
middleware basterebbe.

**Password policy configurabile**
Lunghezza minima, requisiti complessità — non configurabile dall'admin.

---

## Idee che sfruttano l'infrastruttura esistente

| Idea | Si aggancia a |
|---|---|
| Report schedulati per admin | Job + Cron + Email |
| Digest settimanale per utenti | Job + Email + File |
| Pulizia file orfani | Job + StorageDriver |
| Soft delete con retention | Pattern già usato da AuditLog prune |
| Webhook outbound | Job (fire-and-forget) |
| Notifiche da job completati | Job → Notification model |
