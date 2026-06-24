"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

export function ProfileForm({
  initialName,
  email,
}: {
  initialName: string
  email: string
}) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [savingName, setSavingName] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)

  async function handleNameSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingName(true)
    const { error } = await authClient.updateUser({ name })
    setSavingName(false)
    if (error) {
      toast.error(error.message ?? "Aggiornamento non riuscito")
      return
    }
    toast.success("Profilo aggiornato")
    router.refresh()
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingPassword(true)
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    })
    setSavingPassword(false)
    if (error) {
      toast.error(error.message ?? "Cambio password non riuscito")
      return
    }
    toast.success("Password aggiornata")
    setCurrentPassword("")
    setNewPassword("")
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Dati profilo</CardTitle>
          <CardDescription>Aggiorna il tuo nome visualizzato.</CardDescription>
        </CardHeader>
        <form onSubmit={handleNameSubmit}>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" value={email} disabled readOnly />
              </Field>
              <Field>
                <FieldLabel htmlFor="name">Nome</FieldLabel>
                <Input
                  id="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={savingName}
                />
              </Field>
              <Button
                type="submit"
                disabled={savingName || name === initialName}
              >
                {savingName && <Spinner />}
                Salva
              </Button>
            </FieldGroup>
          </CardContent>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cambia password</CardTitle>
          <CardDescription>
            Per sicurezza, le altre sessioni verranno disconnesse.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handlePasswordSubmit}>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="current-password">
                  Password attuale
                </FieldLabel>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={savingPassword}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-password">Nuova password</FieldLabel>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={savingPassword}
                />
              </Field>
              <Button type="submit" disabled={savingPassword}>
                {savingPassword && <Spinner />}
                Aggiorna password
              </Button>
            </FieldGroup>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
