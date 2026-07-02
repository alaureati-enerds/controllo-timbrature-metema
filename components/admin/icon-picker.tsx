"use client"

import { useMemo, useState } from "react"

import { BRANDING_ICONS } from "@/components/branding-icon"
import { Input } from "@/components/ui/input"
import { BRANDING_ICON_NAMES, type BrandingIconName } from "@/lib/settings/icons"
import { cn } from "@/lib/utils"

// Picker dell'icona di branding: campo di ricerca + griglia del set curato
// (lib/settings/icons.ts). Filtra per nome; evidenzia quella selezionata.
export function IconPicker({
  value,
  onChange,
  disabled,
}: {
  value: BrandingIconName
  onChange: (name: BrandingIconName) => void
  disabled?: boolean
}) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return BRANDING_ICON_NAMES
    return BRANDING_ICON_NAMES.filter((name) => name.includes(q))
  }, [query])

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Cerca un'icona…"
        disabled={disabled}
        aria-label="Cerca un'icona"
      />
      <div
        role="radiogroup"
        aria-label="Icona del branding"
        className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-2"
      >
        {filtered.map((name) => {
          const Icon = BRANDING_ICONS[name]
          const selected = name === value
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={name}
              title={name}
              disabled={disabled}
              onClick={() => onChange(name)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md border transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                "disabled:pointer-events-none disabled:opacity-50",
                selected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input text-muted-foreground"
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
            </button>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-muted-foreground col-span-full text-sm">
            Nessuna icona trovata.
          </p>
        )}
      </div>
    </div>
  )
}
