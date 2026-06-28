"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { SaveIcon } from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { AvatarUploader } from "@/components/profile/avatar-uploader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

// Card "Informazioni personali": avatar + nome. La password e l'email stanno
// nella sezione sicurezza (components/profile/account-security.tsx).
export function ProfileForm({
  initialName,
  email,
  image,
  roles,
}: {
  initialName: string
  email: string
  image: string | null
  roles: string[]
}) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [savingName, setSavingName] = useState(false)

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informazioni personali</CardTitle>
        <CardDescription>
          Nome e foto compaiono nella barra laterale e nelle attività
          dell&apos;account.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleNameSubmit} className="contents">
        <CardContent>
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <AvatarUploader name={initialName} image={image} />
              {roles.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {roles.map((r) => (
                    <Badge key={r} variant="secondary" className="capitalize">
                      {r}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <FieldGroup>
              <div className="grid gap-5 sm:grid-cols-2">
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
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input id="email" value={email} disabled readOnly />
                  <FieldDescription>
                    Per cambiarla usa la sezione Email qui sotto.
                  </FieldDescription>
                </Field>
              </div>
            </FieldGroup>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={savingName || name === initialName}>
            {savingName ? <Spinner /> : <SaveIcon data-icon="inline-start" />}
            Salva modifiche
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
