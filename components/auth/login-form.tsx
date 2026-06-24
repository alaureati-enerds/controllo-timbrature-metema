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

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") || "/"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    const { error } = await authClient.signIn.email({ email, password })
    setPending(false)

    if (error) {
      if (error.code === "EMAIL_NOT_VERIFIED") {
        toast.error(
          "Email non verificata: controlla la posta (o i log in dev)."
        )
        return
      }
      toast.error(error.message ?? "Credenziali non valide")
      return
    }

    toast.success("Accesso effettuato")
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accedi</CardTitle>
        <CardDescription>Entra con email e password.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent>
          <FieldGroup>
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
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
              />
            </Field>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />}
              Accedi
            </Button>
          </FieldGroup>
        </CardContent>
      </form>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <Link
          href="/reset-password"
          className="text-muted-foreground hover:underline"
        >
          Password dimenticata?
        </Link>
        <span className="text-muted-foreground">
          Non hai un account?{" "}
          <Link href="/register" className="text-foreground hover:underline">
            Registrati
          </Link>
        </span>
      </CardFooter>
    </Card>
  )
}
