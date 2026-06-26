import { createReadStream } from "node:fs"
import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import type { Readable } from "node:stream"

import type { StorageDriver } from "@/lib/storage/driver"

// Driver di storage su filesystem locale. I file vivono sotto `baseDir` (da
// STORAGE_DIR), una cartella FUORI da public/: l'accesso passa sempre dalle
// route autorizzate. Pensato per girare con un volume Docker persistente.
export class FilesystemDriver implements StorageDriver {
  private readonly baseDir: string

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir)
  }

  // Risolve `key` dentro baseDir impedendo il path traversal (es. "../../etc"):
  // il percorso finale deve restare confinato nella cartella base.
  private resolve(key: string): string {
    const full = path.resolve(this.baseDir, key)
    if (full !== this.baseDir && !full.startsWith(this.baseDir + path.sep)) {
      throw new Error(`Chiave di storage non valida: ${key}`)
    }
    return full
  }

  async put(key: string, data: Buffer): Promise<void> {
    const full = this.resolve(key)
    await mkdir(path.dirname(full), { recursive: true })
    await writeFile(full, data)
  }

  async get(key: string): Promise<Readable> {
    // createReadStream è lazy: l'errore di "file mancante" emerge come evento
    // 'error' sullo stream, gestito da chi serve la risposta.
    return createReadStream(this.resolve(key))
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true })
  }
}
