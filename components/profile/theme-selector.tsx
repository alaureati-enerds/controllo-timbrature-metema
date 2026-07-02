"use client"

import { useEffect, useState } from "react"
import { CheckIcon, MonitorIcon } from "lucide-react"
import { useTheme } from "next-themes"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

// Selettore del tema PER-UTENTE con anteprima della palette. La scelta è
// client-only: usa next-themes (localStorage), come il selettore in topbar
// (components/mode-toggle.tsx). I temi disponibili sono quelli registrati nel
// ThemeProvider; per aggiungerne uno vedi docs/creare-un-tema.md.

// Colori rappresentativi per l'anteprima. RISPECCHIANO i token in
// app/globals.css (background, primary, secondary, accent di ogni blocco): se
// cambi una palette là, aggiorna lo swatch qui. Sono solo per il preview, la UI
// vera resta guidata dai token CSS.
type ThemeDef = {
  value: string
  label: string
  group: string
  swatches: { bg: string; primary: string; secondary: string; accent: string }
}

const themes: ThemeDef[] = [
  {
    value: "light",
    label: "Chiaro",
    group: "Standard",
    swatches: {
      bg: "oklch(1 0 0)",
      primary: "oklch(0.21 0.006 285.885)",
      secondary: "oklch(0.967 0.001 286.375)",
      accent: "oklch(0.967 0.001 286.375)",
    },
  },
  {
    value: "dark",
    label: "Scuro",
    group: "Standard",
    swatches: {
      bg: "oklch(0.141 0.005 285.823)",
      primary: "oklch(0.92 0.004 286.32)",
      secondary: "oklch(0.274 0.006 286.033)",
      accent: "oklch(0.274 0.006 286.033)",
    },
  },
  {
    value: "catppuccin-latte",
    label: "Catppuccin Latte",
    group: "Catppuccin",
    swatches: {
      bg: "oklch(0.958 0.006 264.5)",
      primary: "oklch(0.555 0.25 297)",
      secondary: "oklch(0.857 0.014 268.5)",
      accent: "oklch(0.857 0.014 268.5)",
    },
  },
  {
    value: "catppuccin-mocha",
    label: "Catppuccin Mocha",
    group: "Catppuccin",
    swatches: {
      bg: "oklch(0.243 0.03 283.9)",
      primary: "oklch(0.787 0.119 304.8)",
      secondary: "oklch(0.324 0.032 282)",
      accent: "oklch(0.404 0.032 280.2)",
    },
  },
  {
    value: "solarized-light",
    label: "Solarized Light",
    group: "Solarized",
    swatches: {
      bg: "oklch(0.974 0.026 90.1)",
      primary: "oklch(0.615 0.139 244.9)",
      secondary: "oklch(0.931 0.026 92.4)",
      accent: "oklch(0.931 0.026 92.4)",
    },
  },
  {
    value: "solarized-dark",
    label: "Solarized Dark",
    group: "Solarized",
    swatches: {
      bg: "oklch(0.267 0.049 219.8)",
      primary: "oklch(0.615 0.139 244.9)",
      secondary: "oklch(0.309 0.052 219.7)",
      accent: "oklch(0.363 0.061 220)",
    },
  },
  {
    value: "monokai",
    label: "Monokai",
    group: "Altri (scuri)",
    swatches: {
      bg: "oklch(0.274 0.011 114.8)",
      primary: "oklch(0.642 0.24 7.5)",
      secondary: "oklch(0.357 0.018 103)",
      accent: "oklch(0.399 0.016 102.4)",
    },
  },
  {
    value: "dracula",
    label: "Dracula",
    group: "Altri (scuri)",
    swatches: {
      bg: "oklch(0.288 0.022 277.5)",
      primary: "oklch(0.742 0.149 301.9)",
      secondary: "oklch(0.403 0.032 277.8)",
      accent: "oklch(0.403 0.032 277.8)",
    },
  },
  {
    value: "nord",
    label: "Nord",
    group: "Altri (scuri)",
    swatches: {
      bg: "oklch(0.324 0.023 264.2)",
      primary: "oklch(0.775 0.062 217.5)",
      secondary: "oklch(0.416 0.032 264.1)",
      accent: "oklch(0.416 0.032 264.1)",
    },
  },
  {
    value: "gruvbox-dark",
    label: "Gruvbox",
    group: "Altri (scuri)",
    swatches: {
      bg: "oklch(0.277 0 0)",
      primary: "oklch(0.725 0.143 77.7)",
      secondary: "oklch(0.344 0.007 48.5)",
      accent: "oklch(0.411 0.012 51.9)",
    },
  },
]

function PalettePreview({ swatches }: { swatches: ThemeDef["swatches"] }) {
  return (
    <div
      className="flex h-12 items-center gap-1.5 rounded-md border px-2.5"
      style={{ backgroundColor: swatches.bg, borderColor: swatches.secondary }}
    >
      <span
        className="size-5 rounded-full"
        style={{ backgroundColor: swatches.primary }}
      />
      <span
        className="size-5 rounded-full"
        style={{ backgroundColor: swatches.secondary }}
      />
      <span
        className="size-5 rounded-full"
        style={{ backgroundColor: swatches.accent }}
      />
    </div>
  )
}

function ThemeTile({
  def,
  selected,
  onSelect,
}: {
  def: ThemeDef
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col gap-2 rounded-lg border bg-card p-2.5 text-left transition-colors",
        "hover:border-ring/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected && "border-ring ring-3 ring-ring/30"
      )}
    >
      <PalettePreview swatches={def.swatches} />
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className="text-sm font-medium">{def.label}</span>
        {selected && (
          <CheckIcon
            className="size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
        )}
      </div>
    </button>
  )
}

export function ThemeSelector() {
  const { theme, setTheme } = useTheme()
  // next-themes conosce il tema scelto solo lato client: prima del mount nessun
  // tile risulta selezionato, così evitiamo un mismatch di idratazione su
  // aria-checked. Il flag "monta una volta" è il pattern consigliato da
  // next-themes: lo setState nell'effetto è voluto.
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  const systemSelected = mounted && theme === "system"

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aspetto</CardTitle>
        <CardDescription>
          Scegli il tema dell&apos;interfaccia. La scelta vale su questo
          browser.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          role="radiogroup"
          aria-label="Tema dell'interfaccia"
          className="flex flex-col gap-3"
        >
          {/* Sistema: segue le preferenze del sistema operativo, niente palette
              fissa da mostrare. */}
          <button
            type="button"
            role="radio"
            aria-checked={systemSelected}
            onClick={() => setTheme("system")}
            className={cn(
              "flex items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors",
              "hover:border-ring/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              systemSelected && "border-ring ring-3 ring-ring/30"
            )}
          >
            <span className="flex size-9 items-center justify-center rounded-md border bg-muted">
              <MonitorIcon className="size-4" aria-hidden="true" />
            </span>
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-medium">Sistema</span>
              <span className="text-xs text-muted-foreground">
                Segue il tema chiaro o scuro del dispositivo.
              </span>
            </div>
            {systemSelected && (
              <CheckIcon
                className="size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
            )}
          </button>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {themes.map((def) => (
              <ThemeTile
                key={def.value}
                def={def}
                selected={mounted && theme === def.value}
                onSelect={() => setTheme(def.value)}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
