"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

import { MailIcon } from "lucide-react"

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

// Reinvio del link di verifica, utile se quello originale è scaduto.
export function ResendVerificationForm() {
  const [email, setEmail] = useState("")
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: "/",
    })
    setPending(false)
    if (error) {
      toast.error(error.message ?? "Invio non riuscito")
      return
    }
    toast.success("Email di verifica inviata (in dev: link nei log).")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verifica email</CardTitle>
        <CardDescription>
          Non hai ricevuto il link? Reinvialo qui.
        </CardDescription>
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
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner /> : <MailIcon data-icon="inline-start" />}
              Reinvia link
            </Button>
          </FieldGroup>
        </CardContent>
      </form>
      <CardFooter>
        <Link href="/login" className="text-sm hover:underline">
          Torna al login
        </Link>
      </CardFooter>
    </Card>
  )
}
