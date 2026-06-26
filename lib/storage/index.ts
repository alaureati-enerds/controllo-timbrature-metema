import { env } from "@/lib/env"
import type { StorageDriver } from "@/lib/storage/driver"
import { FilesystemDriver } from "@/lib/storage/filesystem"

// Punto unico in cui si sceglie il driver di storage attivo. Oggi: filesystem.
// Per passare a un altro backend (S3/R2/Blob) basta implementare StorageDriver
// e sostituire l'istanza qui: nient'altro nel codebase cambia.
export const storage: StorageDriver = new FilesystemDriver(env.STORAGE_DIR)

export type { StorageDriver } from "@/lib/storage/driver"
