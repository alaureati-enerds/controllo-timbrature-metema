import type { Metadata } from "next"
import { Geist_Mono, Manrope } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { getSystemSettings } from "@/lib/settings/system"
import { cn } from "@/lib/utils"

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

// `force-dynamic`: il titolo dipende dal nome del software (impostazione di
// sistema letta dal DB in generateMetadata), quindi ogni pagina si renderizza a
// request-time invece che al build. Evita anche che la build dell'immagine
// Docker richieda un database raggiungibile (vedi docs/deploy-docker.md).
export const dynamic = "force-dynamic"

// Titolo dinamico: il nome del software è un'impostazione di sistema, quindi va
// letto a runtime (cachato server-side). `template` fa sì che le singole pagine
// appaiano come "Pagina · <nome software>".
export async function generateMetadata(): Promise<Metadata> {
  const { appName } = await getSystemSettings()
  return {
    title: {
      default: appName,
      template: `%s · ${appName}`,
    },
    description:
      "Base di partenza full-stack: Next.js + shadcn/ui, backend con Route Handlers e PostgreSQL con Prisma.",
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="it"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        manrope.variable
      )}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'})})}`,
          }}
        />
      </body>
    </html>
  )
}
