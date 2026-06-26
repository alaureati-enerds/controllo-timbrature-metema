"use client"

import { useRef, useState } from "react"
import { DownloadIcon, FileIcon, Trash2Icon, UploadIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import type { FileMeta } from "@/lib/files"

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Gestione dei file dell'utente: upload, elenco, download ed eliminazione.
// Dimostra l'asse "ownership" del sottosistema file (ogni utente vede e tocca
// solo i propri). Lo stato locale è inizializzato dal server e aggiornato a ogni
// mutazione, così la lista resta coerente senza ricaricare la pagina.
export function FileManager({ initialFiles }: { initialFiles: FileMeta[] }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<FileMeta[]>(initialFiles)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function readError(res: Response): Promise<string> {
    const data = (await res.json().catch(() => null)) as {
      error?: string
    } | null
    return data?.error ?? "Operazione non riuscita"
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setUploading(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch("/api/files", { method: "POST", body })
      if (!res.ok) throw new Error(await readError(res))

      const created = (await res.json()) as FileMeta
      setFiles((prev) => [created, ...prev])
      toast.success("File caricato")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore imprevisto")
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/files/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(await readError(res))

      setFiles((prev) => prev.filter((f) => f.id !== id))
      toast.success("File eliminato")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore imprevisto")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Spinner /> : <UploadIcon />}
          Carica un file
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {files.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileIcon />
            </EmptyMedia>
            <EmptyTitle>Nessun file</EmptyTitle>
            <EmptyDescription>
              Carica il tuo primo file: sarà visibile solo a te.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-3 rounded-md border p-3"
            >
              <FileIcon className="text-muted-foreground size-5 shrink-0" />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">
                  {file.originalName ?? file.id}
                </span>
                <span className="text-muted-foreground text-xs">
                  {file.mimeType} · {formatSize(file.size)}
                </span>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <Button asChild variant="ghost" size="icon" title="Scarica">
                  <a href={`/api/files/${file.id}`} download>
                    <DownloadIcon />
                    <span className="sr-only">Scarica</span>
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Elimina"
                  onClick={() => handleDelete(file.id)}
                  disabled={deletingId === file.id}
                >
                  {deletingId === file.id ? <Spinner /> : <Trash2Icon />}
                  <span className="sr-only">Elimina</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
