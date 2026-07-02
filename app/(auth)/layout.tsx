import { AuthBranding } from "@/components/auth/auth-branding"
import { ModeToggle } from "@/components/mode-toggle"
import { toPublicSettings } from "@/lib/settings/schema"
import { getSystemSettings } from "@/lib/settings/system"

// Layout delle pagine di autenticazione: niente sidebar, contenuto centrato.
// Le route sotto (auth) sono pubbliche (escluse dal middleware di protezione).
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Stesso branding globale dell'header della sidebar, letto server-side.
  const branding = toPublicSettings(await getSystemSettings())

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <header className="flex h-16 items-center justify-end px-4">
        <ModeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <AuthBranding branding={branding} />
          {children}
        </div>
      </main>
    </div>
  )
}
