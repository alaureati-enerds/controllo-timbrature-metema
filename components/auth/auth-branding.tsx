import Link from "next/link"

import { BrandingIcon } from "@/components/branding-icon"
import type { PublicSystemSettings } from "@/lib/settings/schema"

// Branding (icona + nome + sottotitolo) mostrato sopra le card delle pagine di
// autenticazione. Riprende lo stesso pattern dell'header della sidebar
// (components/app-sidebar.tsx) per coerenza visiva, ma centrato e con i token di
// colore "primary" perché qui siamo fuori dal contesto della sidebar.
export function AuthBranding({ branding }: { branding: PublicSystemSettings }) {
  return (
    <Link
      href="/"
      className="mb-6 flex flex-col items-center gap-2 text-center"
      aria-label={branding.appName}
    >
      <div className="flex aspect-square size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <BrandingIcon name={branding.iconName} className="size-5" />
      </div>
      <div className="flex flex-col gap-0.5 leading-none">
        <span className="font-semibold">{branding.appName}</span>
        {branding.appSubtitle && (
          <span className="text-xs text-muted-foreground">
            {branding.appSubtitle}
          </span>
        )}
      </div>
    </Link>
  )
}
