"use client"

import Link from "next/link"
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

export function RegisterForm() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    const { error } = await authClient.signUp.email({ name, email, password })
    setPending(false)

    if (error) {
      toast.error(error.message ?? "Registrazione non riuscita")
      return
    }

    // Email di verifica inviata (in dev: link nei log). L'utente deve verificare
    // prima di poter accedere (requireEmailVerification in lib/auth.ts).
    setDone(true)
    toast.success("Account creato: verifica l'email per accedere.")
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Controlla l&apos;email</CardTitle>
          <CardDescription>
            Ti abbiamo inviato un link per verificare {email}. In sviluppo il
            link viene stampato nei log del server.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Link href="/login" className="text-sm hover:underline">
            Torna al login
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crea un account</CardTitle>
        <CardDescription>Registrati con email e password.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Nome</FieldLabel>
              <Input
                id="name"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={pending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
              />
            </Field>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />}
              Registrati
            </Button>
          </FieldGroup>
        </CardContent>
      </form>
      <CardFooter className="text-sm text-muted-foreground">
        Hai già un account?{" "}
        <Link href="/login" className="ml-1 text-foreground hover:underline">
          Accedi
        </Link>
      </CardFooter>
    </Card>
  )
}
