# TODO

Elenco di attività in sospeso da riprendere.

## Autenticazione — verificare i flussi che toccano i dati d'accesso

Da rivedere con calma i flussi di **cambio email** e **cambio/reset password**,
sia funzionalmente sia come UX.

- **Cambio email**: regressione nota. Con la pagina di conferma + re-login
  (esperimento poi revertato) l'email **non veniva aggiornata**. Capire perché il
  flusso di conferma via `/api/auth/verify-email` (requestType
  `change-email-confirmation`) non applicava il cambiamento quando il redirect
  passava da una pagina intermedia, e ridefinire l'esperienza desiderata.
- **UX dei flussi via email**: oggi al ritorno dal link si atterra in dashboard
  senza conferma esplicita. Best practice: pagina di esito + (per i dati di
  accesso) richiesta di nuovo login. Decidere il comportamento per:
  - verifica email al signup (auto-login sì/no)
  - cambio email
  - reset password (forgot)
  - eliminazione account
- **Cambio password**: verificare il comportamento delle sessioni
  (utente: revoca le altre; admin reset: revoca tutte) e la coerenza dei messaggi.

File coinvolti: [lib/auth.ts](lib/auth.ts),
[components/profile/account-security.tsx](components/profile/account-security.tsx),
[components/auth/reset-password-form.tsx](components/auth/reset-password-form.tsx),
[components/admin/user-detail.tsx](components/admin/user-detail.tsx).

Riferimento: [docs/autenticazione-e-ruoli.md](docs/autenticazione-e-ruoli.md).
