import { ModeToggle } from "@/components/mode-toggle"

// Layout delle pagine di autenticazione: niente sidebar, contenuto centrato.
// Le route sotto (auth) sono pubbliche (escluse dal middleware di protezione).
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <header className="flex h-16 items-center justify-end px-4">
        <ModeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}
