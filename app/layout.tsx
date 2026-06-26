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
      </body>
    </html>
  )
}
