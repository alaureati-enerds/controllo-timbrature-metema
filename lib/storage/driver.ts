import type { Readable } from "node:stream"

// Astrazione dello storage dei file. I consumatori (lib/files.ts) parlano solo
// con questa interfaccia, mai col filesystem o con un SDK specifico: cambiare
// backend (filesystem -> S3/R2/Blob) significa scrivere un nuovo driver e
// scambiarlo in lib/storage/index.ts, senza toccare modello, autorizzazione e UI.
//
// La `key` è un percorso/identificatore opaco gestito da chi chiama (es.
// "user/<userId>/<id>"): il driver la usa così com'è, validandola contro abusi.
export interface StorageDriver {
  /** Salva (o sovrascrive) l'oggetto identificato da `key`. */
  put(key: string, data: Buffer): Promise<void>
  /** Restituisce uno stream leggibile dell'oggetto; lancia se non esiste. */
  get(key: string): Promise<Readable>
  /** Elimina l'oggetto; non lancia se è già assente. */
  delete(key: string): Promise<void>
}
