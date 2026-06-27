// Contratto tra il worker e i singoli tipi di job. Un handler NON sa nulla di
// pg-boss né di Prisma: riceve un payload (già validato da lui) e un contesto
// per riportare avanzamento e rispettare le richieste di stop. Così aggiungere
// un'operazione è scrivere una funzione pura-ish e registrarla, niente altro.

// Sollevata da ctx.throwIfCancelled() quando l'utente ha chiesto lo stop. Il
// worker la riconosce e segna il job come "cancelled" (non come "failed").
export class JobCancelledError extends Error {
  constructor() {
    super("Job annullato su richiesta")
    this.name = "JobCancelledError"
  }
}

// Contesto passato all'handler durante l'esecuzione.
export interface JobContext {
  // Id del Job in corso (utile per log/correlazione).
  jobId: string
  // Aggiorna l'avanzamento mostrato in UI. `progress` è 0..100; `message` è una
  // nota breve facoltativa (es. "elaboro 37/200"). Persistito sulla riga Job.
  report(progress: number, message?: string): Promise<void>
  // Aggiunge una riga al log del job (persistita e mostrata nel dettaglio).
  log(message: string): Promise<void>
  // Punto di controllo della cancellazione COOPERATIVA: rilegge il flag dal DB
  // e, se l'utente ha chiesto lo stop, solleva JobCancelledError. Va chiamato
  // nei punti naturali dell'operazione (inizio iterazione, tra due step): lo
  // stop "morde" solo dove l'handler lo controlla.
  throwIfCancelled(): Promise<void>
}

// Descrittore di un campo di input del job: la "maschera" da cui la UI genera
// il form (components/admin/jobs-manager.tsx), così l'utente non scrive JSON a
// mano. È un dato SERIALIZZABILE (niente funzioni): viaggia fino al client. La
// validazione VERA resta a `parse` (Zod) lato server — qui descriviamo solo
// l'aspetto del form. NB: campi iniettati dal server (es. `userId`) NON vanno
// elencati qui.
export type JobField = { name: string; label: string; help?: string } & (
  | { type: "text" | "textarea"; required?: boolean; placeholder?: string; default?: string }
  | { type: "number"; required?: boolean; default?: number; min?: number; max?: number }
  | { type: "boolean"; default?: boolean }
  | {
      type: "select"
      required?: boolean
      options: { value: string; label: string }[]
      default?: string
    }
)

// Un tipo di operazione eseguibile in background.
export interface JobHandler<Payload = unknown> {
  // Chiave univoca del tipo: coincide con `Job.type` e con la chiave nel
  // registry. Usata anche dalla UI per offrire l'avvio manuale.
  type: string
  // Etichetta leggibile mostrata in UI.
  label: string
  // Maschera dei dati di input: la UI ci genera il form. Vuoto = nessun dato da
  // chiedere all'utente (es. operazione senza parametri).
  fields: JobField[]
  // Valida (e tipizza) il payload grezzo prima dell'esecuzione. Tipicamente uno
  // schema Zod: `parse: (raw) => schema.parse(raw)`.
  parse(raw: unknown): Payload
  // Esegue l'operazione. Deve riportare avanzamento e rispettare i checkpoint di
  // cancellazione. Un'eccezione qualsiasi → job "failed"; JobCancelledError →
  // job "cancelled".
  run(payload: Payload, ctx: JobContext): Promise<void>
}
