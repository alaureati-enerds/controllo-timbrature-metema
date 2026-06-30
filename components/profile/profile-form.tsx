"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { PencilIcon, UserIcon } from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AvatarUploader } from "@/components/profile/avatar-uploader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { initials } from "@/lib/initials"

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
  const [editOpen, setEditOpen] = useState(false)
  const [name, setName] = useState(initialName)
  const [editName, setEditName] = useState(initialName)
  const [savingName, setSavingName] = useState(false)

  async function handleNameSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingName(true)
    const { error } = await authClient.updateUser({ name: editName })
    setSavingName(false)
    if (error) {
      toast.error(error.message ?? "Aggiornamento non riuscito")
      return
    }
    setName(editName)
    setEditOpen(false)
    toast.success("Nome aggiornato")
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserIcon aria-hidden="true" className="size-4" />
          Informazioni personali
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <Avatar className="size-16 shrink-0 rounded-xl">
            {image && <AvatarImage src={image} alt="" className="rounded-xl" />}
            <AvatarFallback className="rounded-xl text-lg font-medium">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <span className="truncate font-medium">{name}</span>
              {roles.map((r) => (
                <Badge key={r} variant="secondary" className="shrink-0 capitalize">
                  {r}
                </Badge>
              ))}
            </span>
            <span className="truncate text-sm text-muted-foreground">
              {email}
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button>
              <PencilIcon aria-hidden="true" data-icon="inline-start" />
              Modifica
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifica profilo</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-6">
              <AvatarUploader name={editName} image={image} />
              <form onSubmit={handleNameSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="edit-name">Nome</FieldLabel>
                    <Input
                      id="edit-name"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      disabled={savingName}
                    />
                  </Field>
                </FieldGroup>
                <DialogFooter className="mt-6">
                  <Button type="submit" disabled={savingName || editName === name}>
                    {savingName ? <Spinner /> : <PencilIcon data-icon="inline-start" />}
                    Salva
                  </Button>
                </DialogFooter>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  )
}
