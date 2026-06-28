"use client"

import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { ImageUpIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { initials } from "@/lib/initials"

// Formati e dimensione accettati lato client: stessi vincoli applicati dal
// server in POST /api/me/avatar (immagini, max 5 MB).
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]
const MAX_SIZE = 5 * 1024 * 1024

// Estrae l'id del file dall'URL dell'avatar attuale, per poterne eliminare i
// byte quando l'utente rimuove la foto.
function fileIdFromUrl(url: string | null): string | null {
  if (!url) return null
  return /^\/api\/files\/([^/?#]+)$/.exec(url)?.[1] ?? null
}

// Avatar del profilo: anteprima + caricamento + rimozione. L'upload va a
// /api/me/avatar (validazione e pulizia del vecchio file); l'URL risultante è
// salvato su user.image via authClient.updateUser, così la sessione (e quindi la
// sidebar) si aggiorna senza ricaricare la pagina.
export function AvatarUploader({
  name,
  image,
}: {
  name: string
  image: string | null
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null)

  async function handlePick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Azzera il valore così la stessa immagine può essere riselezionata.
    event.target.value = ""
    if (!file) return

    if (!ACCEPTED.includes(file.type)) {
      toast.error("Formato non supportato (usa PNG, JPG, WebP o GIF)")
      return
    }
    if (file.size > MAX_SIZE) {
      toast.error("Immagine troppo grande (max 5 MB)")
      return
    }

    setBusy("upload")
    try {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch("/api/me/avatar", { method: "POST", body })
      const data = (await res.json().catch(() => null)) as {
        url?: string
        error?: string
      } | null
      if (!res.ok || !data?.url) {
        throw new Error(data?.error ?? "Caricamento non riuscito")
      }
      const { error } = await authClient.updateUser({ image: data.url })
      if (error) throw new Error(error.message ?? "Aggiornamento non riuscito")
      toast.success("Avatar aggiornato")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore imprevisto")
    } finally {
      setBusy(null)
    }
  }

  async function handleRemove() {
    setBusy("remove")
    try {
      const { error } = await authClient.updateUser({ image: "" })
      if (error) throw new Error(error.message ?? "Operazione non riuscita")
      const id = fileIdFromUrl(image)
      if (id) {
        await fetch(`/api/files/${id}`, { method: "DELETE" }).catch(() => {})
      }
      toast.success("Avatar rimosso")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore imprevisto")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16 rounded-xl">
        {image && <AvatarImage src={image} alt="" className="rounded-xl" />}
        <AvatarFallback className="rounded-xl text-lg font-medium">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="sr-only"
            onChange={handlePick}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => inputRef.current?.click()}
          >
            {busy === "upload" ? (
              <Spinner />
            ) : (
              <ImageUpIcon data-icon="inline-start" />
            )}
            {image ? "Cambia foto" : "Carica foto"}
          </Button>
          {image && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy !== null}
                  className="text-muted-foreground"
                >
                  {busy === "remove" ? (
                    <Spinner />
                  ) : (
                    <Trash2Icon data-icon="inline-start" />
                  )}
                  Rimuovi
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Rimuovere la foto?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tornerai a usare le iniziali come avatar. Potrai sempre
                    caricarne una nuova.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={handleRemove}
                  >
                    <Trash2Icon data-icon="inline-start" />
                    Rimuovi
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          PNG, JPG, WebP o GIF, fino a 5 MB.
        </p>
      </div>
    </div>
  )
}
