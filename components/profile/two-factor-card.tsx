"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import QRCode from "qrcode"
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  KeyRoundIcon,
  ShieldCheckIcon,
  ShieldXIcon,
} from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
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

// Estrae il segreto base32 dall'URI otpauth:// per l'inserimento manuale.
function secretFromTotpUri(uri: string): string {
  try {
    return new URL(uri).searchParams.get("secret") ?? ""
  } catch {
    return ""
  }
}

// Raggruppa il segreto in blocchi da 4 caratteri: più leggibile e digitabile.
function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim()
}

// --- Riquadro riutilizzabile per mostrare/salvare i codici di backup ---
function BackupCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Copia non riuscita")
    }
  }

  function download() {
    const blob = new Blob([codes.join("\n") + "\n"], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "codici-backup.txt"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-4 font-mono text-sm">
        {codes.map((c) => (
          <li key={c} className="text-center tracking-wide">
            {c}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={copy}
        >
          {copied ? (
            <CheckIcon aria-hidden="true" data-icon="inline-start" />
          ) : (
            <CopyIcon aria-hidden="true" data-icon="inline-start" />
          )}
          {copied ? "Copiati" : "Copia"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={download}
        >
          <DownloadIcon aria-hidden="true" data-icon="inline-start" />
          Scarica .txt
        </Button>
      </div>
    </div>
  )
}

type Step = "password" | "verify" | "backup"

export function TwoFactorCard({ initialEnabled }: { initialEnabled: boolean }) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(initialEnabled)

  // --- Wizard di attivazione ---
  const [enableOpen, setEnableOpen] = useState(false)
  const [step, setStep] = useState<Step>("password")
  const [password, setPassword] = useState("")
  const [totpUri, setTotpUri] = useState("")
  const [qrDataUrl, setQrDataUrl] = useState("")
  const [code, setCode] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // --- Disattivazione ---
  const [disablePassword, setDisablePassword] = useState("")

  // --- Rigenerazione codici di backup ---
  const [regenOpen, setRegenOpen] = useState(false)
  const [regenPassword, setRegenPassword] = useState("")
  const [regenCodes, setRegenCodes] = useState<string[]>([])

  // Genera il QR quando arriva l'URI TOTP (la pulizia avviene in resetWizard).
  useEffect(() => {
    if (!totpUri) return
    let active = true
    QRCode.toDataURL(totpUri, { margin: 1, width: 200 })
      .then((url) => active && setQrDataUrl(url))
      .catch(() => active && setQrDataUrl(""))
    return () => {
      active = false
    }
  }, [totpUri])

  function resetWizard() {
    setStep("password")
    setPassword("")
    setTotpUri("")
    setQrDataUrl("")
    setCode("")
    setBackupCodes([])
    setSaved(false)
    setError(null)
    setBusy(false)
  }

  function openWizard(open: boolean) {
    setEnableOpen(open)
    if (!open) resetWizard()
  }

  // Step 1: conferma password → genera segreto + codici di backup.
  async function handleEnable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { data, error } = await authClient.twoFactor.enable({ password })
    setBusy(false)
    if (error) {
      setError(
        error.code === "INVALID_PASSWORD"
          ? "Password non corretta. Riprova."
          : (error.message ?? "Attivazione non riuscita.")
      )
      return
    }
    setTotpUri(data.totpURI)
    setBackupCodes(data.backupCodes)
    setStep("verify")
  }

  // Step 2: verifica il primo codice TOTP → attiva davvero la 2FA.
  async function verifyEnable(value: string) {
    setBusy(true)
    setError(null)
    const { error } = await authClient.twoFactor.verifyTotp({ code: value })
    setBusy(false)
    if (error) {
      setCode("")
      setError("Codice non valido. Controlla l'app e reinserisci le 6 cifre.")
      return
    }
    setStep("backup")
  }

  // Step 3: conferma salvataggio codici → chiudi e aggiorna stato.
  function finishWizard() {
    setEnabled(true)
    openWizard(false)
    router.refresh()
    toast.success("Autenticazione a due fattori attivata")
  }

  async function handleDisable() {
    setBusy(true)
    const { error } = await authClient.twoFactor.disable({
      password: disablePassword,
    })
    setBusy(false)
    setDisablePassword("")
    if (error) {
      toast.error(
        error.code === "INVALID_PASSWORD"
          ? "Password non corretta. Riprova."
          : (error.message ?? "Disattivazione non riuscita.")
      )
      return
    }
    setEnabled(false)
    router.refresh()
    toast.success("Autenticazione a due fattori disattivata")
  }

  async function handleRegenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { data, error } = await authClient.twoFactor.generateBackupCodes({
      password: regenPassword,
    })
    setBusy(false)
    setRegenPassword("")
    if (error) {
      setError(
        error.code === "INVALID_PASSWORD"
          ? "Password non corretta. Riprova."
          : (error.message ?? "Operazione non riuscita.")
      )
      return
    }
    setRegenCodes(data.backupCodes)
  }

  function openRegen(open: boolean) {
    setRegenOpen(open)
    if (!open) {
      setRegenPassword("")
      setRegenCodes([])
      setError(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <ShieldCheckIcon
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            Autenticazione a due fattori
          </span>
          {enabled ? (
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              Abilitata
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Non attiva
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Aggiungi un secondo passaggio al login con un&apos;app authenticator.
          Anche chi conosce la tua password non potrà accedere senza il codice.
        </CardDescription>
      </CardHeader>

      {enabled ? (
        <CardFooter className="justify-end gap-2">
          {/* Rigenera codici di backup */}
          <Dialog open={regenOpen} onOpenChange={openRegen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <KeyRoundIcon aria-hidden="true" data-icon="inline-start" />
                Rigenera codici di backup
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rigenera i codici di backup</DialogTitle>
                <DialogDescription>
                  I codici precedenti smetteranno di funzionare. Conferma la
                  password per generarne di nuovi.
                </DialogDescription>
              </DialogHeader>
              {regenCodes.length > 0 ? (
                <div className="flex flex-col gap-4">
                  <BackupCodes codes={regenCodes} />
                  <DialogFooter>
                    <Button onClick={() => openRegen(false)}>
                      <CheckIcon />
                      Fatto
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <form onSubmit={handleRegenerate}>
                  <FieldGroup>
                    <Field data-invalid={error ? true : undefined}>
                      <FieldLabel htmlFor="regen-pw">Password</FieldLabel>
                      <Input
                        id="regen-pw"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={regenPassword}
                        disabled={busy}
                        aria-invalid={error ? true : undefined}
                        onChange={(e) => {
                          setRegenPassword(e.target.value)
                          if (error) setError(null)
                        }}
                      />
                      <FieldError>{error}</FieldError>
                    </Field>
                    <DialogFooter>
                      <Button type="submit" disabled={busy || !regenPassword}>
                        {busy ? <Spinner /> : <KeyRoundIcon />}
                        Genera nuovi codici
                      </Button>
                    </DialogFooter>
                  </FieldGroup>
                </form>
              )}
            </DialogContent>
          </Dialog>

          {/* Disattiva */}
          <AlertDialog
            onOpenChange={(open) => {
              if (!open) setDisablePassword("")
            }}
          >
            <AlertDialogTrigger asChild>
              <Button variant="outline">
                <ShieldXIcon />
                Disattiva
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Disattivare la verifica in due passaggi?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Il tuo account tornerà protetto dalla sola password. Conferma
                  la password per procedere.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Field>
                <FieldLabel htmlFor="disable-pw">Password</FieldLabel>
                <Input
                  id="disable-pw"
                  type="password"
                  autoComplete="current-password"
                  value={disablePassword}
                  disabled={busy}
                  onChange={(e) => setDisablePassword(e.target.value)}
                />
              </Field>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Annulla</AlertDialogCancel>
                <Button
                  variant="destructive"
                  disabled={busy || !disablePassword}
                  onClick={handleDisable}
                >
                  {busy ? <Spinner /> : <ShieldXIcon />}
                  Disattiva
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      ) : (
        <CardFooter className="justify-end">
          <Dialog open={enableOpen} onOpenChange={openWizard}>
            <DialogTrigger asChild>
              <Button>
                <ShieldCheckIcon aria-hidden="true" data-icon="inline-start" />
                Abilita 2FA
              </Button>
            </DialogTrigger>
            <DialogContent>
              {step === "password" && (
                <>
                  <DialogHeader>
                    <DialogTitle>Conferma la tua password</DialogTitle>
                    <DialogDescription>
                      Per la tua sicurezza, conferma la password prima di
                      attivare la verifica in due passaggi.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleEnable}>
                    <FieldGroup>
                      <Field data-invalid={error ? true : undefined}>
                        <FieldLabel htmlFor="enable-pw">Password</FieldLabel>
                        <Input
                          id="enable-pw"
                          type="password"
                          autoComplete="current-password"
                          required
                          value={password}
                          disabled={busy}
                          aria-invalid={error ? true : undefined}
                          onChange={(e) => {
                            setPassword(e.target.value)
                            if (error) setError(null)
                          }}
                        />
                        <FieldError>{error}</FieldError>
                      </Field>
                      <DialogFooter>
                        <Button type="submit" disabled={busy || !password}>
                          {busy ? <Spinner /> : <ArrowRightIcon />}
                          Continua
                        </Button>
                      </DialogFooter>
                    </FieldGroup>
                  </form>
                </>
              )}

              {step === "verify" && (
                <>
                  <DialogHeader>
                    <DialogTitle>Scansiona il QR con la tua app</DialogTitle>
                    <DialogDescription>
                      Apri Google Authenticator, Authy o 1Password, inquadra il
                      codice e inserisci le 6 cifre mostrate.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col items-center gap-4">
                    {qrDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrDataUrl}
                        alt="Codice QR per configurare l'app authenticator"
                        width={176}
                        height={176}
                        className="size-44 rounded-lg border bg-white p-2"
                      />
                    ) : (
                      <div className="flex size-44 items-center justify-center rounded-lg border">
                        <Spinner />
                      </div>
                    )}

                    <Collapsible className="group/manual flex w-full flex-col items-center">
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-muted-foreground"
                        >
                          <ChevronDownIcon
                            aria-hidden="true"
                            className="transition-transform duration-200 group-data-[state=open]/manual:rotate-180"
                          />
                          Non puoi scansionare? Inserisci la chiave
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="w-full">
                        <div className="mt-2 flex items-center gap-2 rounded-md border bg-muted/40 p-2 ps-3">
                          <code
                            translate="no"
                            className="flex-1 text-center font-mono text-sm tracking-wider break-words select-all"
                          >
                            {groupSecret(secretFromTotpUri(totpUri))}
                          </code>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0"
                            aria-label="Copia la chiave"
                            onClick={() => {
                              navigator.clipboard
                                .writeText(secretFromTotpUri(totpUri))
                                .then(() => toast.success("Chiave copiata"))
                                .catch(() => toast.error("Copia non riuscita"))
                            }}
                          >
                            <CopyIcon aria-hidden="true" />
                          </Button>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    <Field data-invalid={error ? true : undefined}>
                      <FieldLabel htmlFor="enable-code" className="sr-only">
                        Codice a 6 cifre
                      </FieldLabel>
                      <InputOTP
                        id="enable-code"
                        maxLength={6}
                        value={code}
                        disabled={busy}
                        aria-invalid={error ? true : undefined}
                        containerClassName="justify-center"
                        onChange={(value) => {
                          setCode(value)
                          if (error) setError(null)
                          if (value.length === 6) verifyEnable(value)
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
                      {busy && (
                        <span className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Spinner /> Verifica…
                        </span>
                      )}
                    </Field>
                  </div>
                </>
              )}

              {step === "backup" && (
                <>
                  <DialogHeader>
                    <DialogTitle>Salva i tuoi codici di backup</DialogTitle>
                    <DialogDescription>
                      Usali per accedere se perdi il telefono. Ogni codice
                      funziona una sola volta e non potrai rivederli: conservali
                      in un posto sicuro.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col gap-4">
                    <BackupCodes codes={backupCodes} />
                    <Field orientation="horizontal">
                      <Checkbox
                        id="saved-codes"
                        checked={saved}
                        onCheckedChange={(v) => setSaved(v === true)}
                      />
                      <FieldLabel htmlFor="saved-codes" className="font-normal">
                        Ho salvato i codici di backup
                      </FieldLabel>
                    </Field>
                    <DialogFooter>
                      <Button disabled={!saved} onClick={finishWizard}>
                        <CheckIcon />
                        Fine
                      </Button>
                    </DialogFooter>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        </CardFooter>
      )}
    </Card>
  )
}
