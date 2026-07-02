import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

// Protezione "ottimistica" delle route (convenzione `proxy` di Next.js 16):
// controlla solo la PRESENZA del cookie di sessione (veloce, senza accesso al DB).
// Chi non ha cookie viene rimandato al login. La verifica REALE della validità
// della sessione e dei ruoli avviene nelle pagine/route handler tramite gli
// helper in lib/auth-helpers.ts (requireUser/requireRole).
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url)
    // Conserva la destinazione per il redirect post-login.
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // Applica a tutto TRANNE le pagine di auth, le API, gli asset statici e i
  // file PWA (manifest, service worker, icone). Questi ultimi DEVONO restare
  // pubblici: se il proxy li reindirizza al login, Chrome non riesce a leggere
  // il manifest né a registrare il SW e la PWA non è installabile.
  matcher: [
    "/((?!login|register|reset-password|verify-email|two-factor|api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon|apple-icon|icon-.*\\.png|apple-icon\\.png).*)",
  ],
}
