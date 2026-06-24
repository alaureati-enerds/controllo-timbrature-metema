"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

export function NoteForm() {
  const router = useRouter()
  const [text, setText] = useState("")
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = text.trim()
    if (!value) return

    setPending(true)
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? "Errore durante il salvataggio")
      }

      setText("")
      toast.success("Nota aggiunta")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore imprevisto")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="note-text">Nuova nota</FieldLabel>
          <Input
            id="note-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Scrivi qualcosa…"
            disabled={pending}
          />
        </Field>
        <Button type="submit" disabled={pending || !text.trim()}>
          {pending && <Spinner />}
          Aggiungi
        </Button>
      </FieldGroup>
    </form>
  )
}
