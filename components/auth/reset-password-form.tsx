"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

// Gestisce entrambe le fasi del reset password:
// 1) senza `token` in query → richiesta del link via email (forgetPassword)
// 2) con `token` → impostazione della nuova password (resetPassword)
export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [value, setValue] = useState("") // email oppure nuova password
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    const { error } = await authClient.requestPasswordReset({
      email: value,
      redirectTo: "/reset-password",
    })
    setPending(false)
    if (error) {
      toast.error(error.message ?? "Richiesta non riuscita")
      return
    }
    setSent(true)
    toast.success("Se l'email esiste, riceverai un link di reset.")
  }

  async function handleReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    setPending(true)
    const { error } = await authClient.resetPassword({
      newPassword: value,
      token,
    })
    setPending(false)
    if (error) {
      toast.error(error.message ?? "Reset non riuscito (link scaduto?)")
      return
    }
    toast.success("Password aggiornata: ora puoi accedere.")
    router.push("/login")
  }

  // Fase 2: impostazione nuova password
  if (token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nuova password</CardTitle>
          <CardDescription>Scegli una nuova password.</CardDescription>
        </CardHeader>
        <form onSubmit={handleReset}>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-password">Nuova password</FieldLabel>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  disabled={pending}
                />
              </Field>
              <Button type="submit" disabled={pending}>
                {pending && <Spinner />}
                Aggiorna password
              </Button>
            </FieldGroup>
          </CardContent>
        </form>
      </Card>
    )
  }

  // Fase 1: richiesta del link
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recupera password</CardTitle>
        <CardDescription>
          {sent
            ? "Controlla l'email (in dev: il link è nei log del server)."
            : "Inserisci la tua email per ricevere il link di reset."}
        </CardDescription>
      </CardHeader>
      {!sent && (
        <form onSubmit={handleRequest}>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  disabled={pending}
                />
              </Field>
              <Button type="submit" disabled={pending}>
                {pending && <Spinner />}
                Invia link
              </Button>
            </FieldGroup>
          </CardContent>
        </form>
      )}
      <CardFooter>
        <Link href="/login" className="text-sm hover:underline">
          Torna al login
        </Link>
      </CardFooter>
    </Card>
  )
}
