# Stampa del registro presenze (PDF)

Dalla pagina **Timbrature** (`/admin/timbrature`) si genera il **registro
presenze** del dipendente e del mese selezionati come **PDF scaricabile**. Il
formato del foglio è un **template**: se ne può scegliere uno al momento della
stampa. Il template proposto di default è una **preferenza per-utente**,
impostabile in [`/settings`](../app/(dashboard)/settings/page.tsx) (vedi
`stampa.templateId` in [`lib/settings/user.ts`](../lib/settings/user.ts)).

---

## Come funziona

1. Nella toolbar della pagina, in fondo a destra, il bottone **Stampa** apre il
   dialog di stampa
   ([`components/admin/timbrature-stampa-dialog.tsx`](../components/admin/timbrature-stampa-dialog.tsx)).
2. Si sceglie il **template** (parte dal default per-utente). Per cambiare il
   proprio default si va in [`/settings`](../app/(dashboard)/settings/page.tsx)
   → card «Stampa» (`PUT /api/me/preferences`).
3. «Genera PDF» chiama
   `GET /api/admin/timbrature/stampa?dipendente=&mese=&anno=&template=`
   ([route](../app/api/admin/timbrature/stampa/route.ts)), che risponde con un
   `application/pdf` in allegato. Il client lo scarica via `fetch` + blob, così
   un errore del server diventa un toast e non un file rotto.

### Stampa cumulativa (tutti i dipendenti)

Lo switch **«Stampa cumulativa»** nel dialog genera un **unico PDF** con tutti i
dipendenti del mese, **uno per foglio** e in **ordine alfabetico** (l'ordine di
`listDipendenti`). Sono **esclusi i dipendenti senza timbrature**, con un
controllo sui valori **corretti** (`ce1…cu2`) e non sui grezzi: chi ha solo
correzioni manuali compare comunque. In questa modalità il parametro
`cumulativo=1` sostituisce `dipendente`; i dati di tutti i dipendenti sono
costruiti da `getDatiStampaCumulativo`
([`lib/timbrature/stampa/dati.ts`](../lib/timbrature/stampa/dati.ts)) e composti
in un solo documento da `renderDocumentoCumulativo`
([`lib/timbrature/stampa/documenti.tsx`](../lib/timbrature/stampa/documenti.tsx)).
Il template resta lo stesso: ogni template espone la sua `<Page>` (es.
`PaginaRegistroClassico`) e il wrapper `<Document>` — singolo o cumulativo —
vive in `documenti.tsx`. Il piè di pagina «Pagina N di M» usa la numerazione
globale del fascicolo.

**Il contenuto della stampa non viene inviato dal browser.** Le correzioni sono
già persistite mentre si modifica la tabella, quindi il server le rilegge e
**ricalcola** tutto con le stesse funzioni usate a schermo
([`lib/timbrature/calcolo.ts`](../lib/timbrature/calcolo.ts)): il PDF non può
divergere da ciò che si vede.

Ogni stampa è tracciata nell'**audit log** (evento `timbrature.stampa`, con
dipendente, mese e template): è un export di dati sul personale.

### I pezzi

| File | Ruolo |
|---|---|
| [`lib/timbrature/stampa/catalog.ts`](../lib/timbrature/stampa/catalog.ts) | Catalogo dei template: **solo metadati** (id, nome, descrizione). Importabile dal client. |
| [`lib/timbrature/stampa/documenti.tsx`](../lib/timbrature/stampa/documenti.tsx) | Mappa `id → <Page>` + wrapper `<Document>` (singolo e cumulativo). **Server-only**: qui si importa `@react-pdf/renderer`. |
| [`lib/timbrature/stampa/registro-classico.tsx`](../lib/timbrature/stampa/registro-classico.tsx) | Il template «Registro presenze»: espone la sua `<Page>` (`PaginaRegistroClassico`). |
| [`lib/timbrature/stampa/dati.ts`](../lib/timbrature/stampa/dati.ts) | Costruisce i `DatiStampa`: giornate + correzioni + totali, già calcolati (singolo e cumulativo). |
| [`lib/settings/user.ts`](../lib/settings/user.ts) | Template predefinito: **preferenza per-utente** (`stampa.templateId`), impostata in `/settings`. |
| [`components/profile/stampa-preferences-form.tsx`](../components/profile/stampa-preferences-form.tsx) | Card in `/settings` per scegliere il proprio template predefinito. |

La separazione catalogo/documenti è voluta: il client ha bisogno solo di
`id` e `nome` per la Select, e `@react-pdf/renderer` non deve mai finire nel
bundle del browser (è dichiarato in `serverExternalPackages`, vedi
[`next.config.ts`](../next.config.ts)).

---

## Aggiungere un template

Operazione **additiva**: nessun refactor, nessuna migrazione.

1. **Scrivi la pagina** in `lib/timbrature/stampa/<tuo-id>.tsx`. Riceve i
   `DatiStampa` già calcolati e restituisce una `<Page>` di
   `@react-pdf/renderer` (il wrapper `<Document>` lo aggiunge `documenti.tsx`,
   così la stessa pagina serve sia la stampa singola sia quella cumulativa) —
   non deve sapere nulla di MySQL, Prisma o correzioni:

   ```tsx
   import { Page, Text } from "@react-pdf/renderer"
   import type { DatiStampa } from "@/lib/timbrature/stampa/dati"

   export function PaginaRiepilogoCompatto({ dati }: { dati: DatiStampa }) {
     return (
       <Page size="A4">
         <Text>{dati.dipendente.descrizione}</Text>
         {/* … */}
       </Page>
     )
   }
   ```

2. **Registralo nel catalogo** (`lib/timbrature/stampa/catalog.ts`):

   ```ts
   { id: "riepilogo-compatto", nome: "Riepilogo compatto",
     descrizione: "Solo orari corretti e totali del mese." },
   ```

3. **Mappalo in** `lib/timbrature/stampa/documenti.tsx` (nella mappa `pagine`):

   ```tsx
   "riepilogo-compatto": (dati) => <PaginaRiepilogoCompatto dati={dati} />,
   ```

Il template compare subito nella Select del dialog e diventa selezionabile come
predefinito, e funziona sia in stampa singola sia cumulativa. Il tipo
`StampaTemplateId` è derivato dal catalogo, quindi dimenticare il passo 3 è un
**errore di compilazione**, non un bug a runtime.

> **Font**: si usano i font integrati in PDF (Helvetica). Per usarne altri
> servirebbe registrare un TTF con `Font.register()` e spedirlo con l'immagine.

---

## Formato delle ore

Le ore sono stampate come **`HH,MM`** (`08,00`, `03,30`), come sul modulo
cartaceo storico, ma i minuti sono **normalizzati**: 3h30m + 0h30m fanno
`04,00`, non `03,60`. Il vecchio tool sommava quei valori come se fossero
decimali, quindi su alcuni mesi la riga dei totali del nuovo PDF **non coincide
con quella del vecchio stampato** — quella nuova è corretta.
