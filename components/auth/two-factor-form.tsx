"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useCallback, useRef, useState } from "react"

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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Spinner } from "@/components/ui/spinner"

type Mode = "totp" | "backup"

export function TwoFactorForm() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") || "/"

  const [mode, setMode] = useState<Mode>("totp")
  const [code, setCode] = useState("")
  const [backupCode, setBackupCode] = useState("")
  const [trustDevice, setTrustDevice] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Evita il doppio invio quando l'OTP si completa e l'utente preme anche Invio.
  const submittingRef = useRef(false)

  // Navigazione full-page (non router.push): dopo la verifica 2FA serve una
  // richiesta nuova al server con il cookie di sessione già impostato, altrimenti
  // la cache RSC del router può riusare lo stato non autenticato e il redirect
  // non avviene al primo tentativo (visibile solo nella build di produzione).
  const finish = useCallback(() => {
    window.location.href = redirectTo
  }, [redirectTo])

  const verifyTotp = useCallback(
    async (value: string) => {
      if (submittingRef.current) return
      submittingRef.current = true
      setPending(true)
      setError(null)
      const { error } = await authClient.twoFactor.verifyTotp({
        code: value,
        trustDevice,
      })
      submittingRef.current = false
      if (error) {
        setPending(false)
        setCode("")
        setError("Codice non valido. Controlla l'app e reinserisci le 6 cifre.")
        return
      }
      finish()
    },
    [finish, trustDevice]
  )

  async function handleBackupSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    setPending(true)
    setError(null)
    const { error } = await authClient.twoFactor.verifyBackupCode({
      code: backupCode.trim(),
      trustDevice,
    })
    submittingRef.current = false
    if (error) {
      setPending(false)
      setBackupCode("")
      setError("Codice di backup non valido o già utilizzato.")
      return
    }
    finish()
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setCode("")
    setBackupCode("")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verifica in due passaggi</CardTitle>
        <CardDescription>
          {mode === "totp"
            ? "Inserisci il codice a 6 cifre della tua app authenticator."
            : "Inserisci uno dei codici di backup che hai salvato."}
        </CardDescription>
      </CardHeader>

      {mode === "totp" ? (
        <CardContent>
          <FieldGroup>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="totp-code" className="sr-only">
                Codice a 6 cifre
              </FieldLabel>
              <InputOTP
                id="totp-code"
                maxLength={6}
                value={code}
                autoFocus
                disabled={pending}
                aria-invalid={error ? true : undefined}
                containerClassName="justify-center"
                onChange={(value) => {
                  setCode(value)
                  if (error) setError(null)
                  if (value.length === 6) verifyTotp(value)
                }}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
              <FieldError className="text-center">{error}</FieldError>
            </Field>

            <Field orientation="horizontal">
              <Checkbox
                id="trust-device"
                checked={trustDevice}
                disabled={pending}
                onCheckedChange={(v) => setTrustDevice(v === true)}
              />
              <FieldLabel htmlFor="trust-device" className="font-normal">
                Non chiedere più su questo dispositivo per 30 giorni
              </FieldLabel>
            </Field>

            {pending && (
              <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Spinner /> Verifica in corso…
              </p>
            )}
          </FieldGroup>
        </CardContent>
      ) : (
        <form onSubmit={handleBackupSubmit} className="contents">
          <CardContent>
            <FieldGroup>
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="backup-code">Codice di backup</FieldLabel>
                <Input
                  id="backup-code"
                  autoComplete="one-time-code"
                  autoFocus
                  spellCheck={false}
                  required
                  value={backupCode}
                  disabled={pending}
                  aria-invalid={error ? true : undefined}
                  onChange={(e) => {
                    setBackupCode(e.target.value)
                    if (error) setError(null)
                  }}
                />
                <FieldDescription>
                  Ogni codice funziona una sola volta.
                </FieldDescription>
                <FieldError>{error}</FieldError>
              </Field>

              <Field orientation="horizontal">
                <Checkbox
                  id="trust-device-backup"
                  checked={trustDevice}
                  disabled={pending}
                  onCheckedChange={(v) => setTrustDevice(v === true)}
                />
                <FieldLabel
                  htmlFor="trust-device-backup"
                  className="font-normal"
                >
                  Non chiedere più su questo dispositivo per 30 giorni
                </FieldLabel>
              </Field>

              <Button type="submit" disabled={pending || !backupCode.trim()}>
                {pending && <Spinner />}
                Verifica
              </Button>
            </FieldGroup>
          </CardContent>
        </form>
      )}

      <CardFooter className="flex-col items-start gap-2 text-sm">
        {mode === "totp" ? (
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-muted-foreground"
            onClick={() => switchMode("backup")}
          >
            Non hai accesso all&apos;app? Usa un codice di backup
          </Button>
        ) : (
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-muted-foreground"
            onClick={() => switchMode("totp")}
          >
            Usa l&apos;app authenticator
          </Button>
        )}
        <Button
          asChild
          variant="link"
          className="h-auto p-0 text-muted-foreground"
        >
          <Link href="/login">Torna al login</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
