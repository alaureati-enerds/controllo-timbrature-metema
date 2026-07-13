# Stampa del registro presenze (PDF)

Dalla pagina **Timbrature** (`/admin/timbrature`) si genera il **registro
presenze** del dipendente e del mese selezionati come **PDF scaricabile**. Il
formato del foglio è un **template**: se ne può scegliere uno al momento della
stampa e fissarlo come **predefinito** per tutti.

---

## Come funziona

1. Nella toolbar della pagina, accanto ad «Aggiorna», il bottone **stampante**
   apre il dialog di stampa
   ([`components/admin/timbrature-stampa-dialog.tsx`](../components/admin/timbrature-stampa-dialog.tsx)).
2. Si sceglie il **template** e, volendo, lo si imposta come predefinito
   (`PUT /api/admin/settings/stampa`).
3. «Genera PDF» chiama
   `GET /api/admin/timbrature/stampa?dipendente=&mese=&anno=&template=`
   ([route](../app/api/admin/timbrature/stampa/route.ts)), che risponde con un
   `application/pdf` in allegato. Il client lo scarica via `fetch` + blob, così
   un errore del server diventa un toast e non un file rotto.

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
| [`lib/timbrature/stampa/documenti.tsx`](../lib/timbrature/stampa/documenti.tsx) | Mappa `id → documento PDF`. **Server-only**: qui si importa `@react-pdf/renderer`. |
| [`lib/timbrature/stampa/registro-classico.tsx`](../lib/timbrature/stampa/registro-classico.tsx) | Il template «Registro presenze». |
| [`lib/timbrature/stampa/dati.ts`](../lib/timbrature/stampa/dati.ts) | Costruisce i `DatiStampa`: giornate + correzioni + totali, già calcolati. |
| [`lib/settings/stampa.ts`](../lib/settings/stampa.ts) | Template predefinito (impostazione di **sistema**, blob `SystemSetting.data.stampa`). |

La separazione catalogo/documenti è voluta: il client ha bisogno solo di
`id` e `nome` per la Select, e `@react-pdf/renderer` non deve mai finire nel
bundle del browser (è dichiarato in `serverExternalPackages`, vedi
[`next.config.ts`](../next.config.ts)).

---

## Aggiungere un template

Operazione **additiva**: nessun refactor, nessuna migrazione.

1. **Scrivi il documento** in `lib/timbrature/stampa/<tuo-id>.tsx`. Riceve i
   `DatiStampa` già calcolati e restituisce un `<Document>` di
   `@react-pdf/renderer` — non deve sapere nulla di MySQL, Prisma o correzioni:

   ```tsx
   import { Document, Page, Text } from "@react-pdf/renderer"
   import type { DatiStampa } from "@/lib/timbrature/stampa/dati"

   export function RiepilogoCompatto({ dati }: { dati: DatiStampa }) {
     return (
       <Document>
         <Page size="A4">
           <Text>{dati.dipendente.descrizione}</Text>
           {/* … */}
         </Page>
       </Document>
     )
   }
   ```

2. **Registralo nel catalogo** (`lib/timbrature/stampa/catalog.ts`):

   ```ts
   { id: "riepilogo-compatto", nome: "Riepilogo compatto",
     descrizione: "Solo orari corretti e totali del mese." },
   ```

3. **Mappalo in** `lib/timbrature/stampa/documenti.tsx`:

   ```tsx
   "riepilogo-compatto": (dati) => <RiepilogoCompatto dati={dati} />,
   ```

Il template compare subito nella Select del dialog e diventa selezionabile come
predefinito. Il tipo `StampaTemplateId` è derivato dal catalogo, quindi
dimenticare il passo 3 è un **errore di compilazione**, non un bug a runtime.

> **Font**: si usano i font integrati in PDF (Helvetica). Per usarne altri
> servirebbe registrare un TTF con `Font.register()` e spedirlo con l'immagine.

---

## Formato delle ore

Le ore sono stampate come **`HH,MM`** (`08,00`, `03,30`), come sul modulo
cartaceo storico, ma i minuti sono **normalizzati**: 3h30m + 0h30m fanno
`04,00`, non `03,60`. Il vecchio tool sommava quei valori come se fossero
decimali, quindi su alcuni mesi la riga dei totali del nuovo PDF **non coincide
con quella del vecchio stampato** — quella nuova è corretta.
