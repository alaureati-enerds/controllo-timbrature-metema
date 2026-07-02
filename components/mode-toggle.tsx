"use client"

import { PaletteIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Selettore del tema. Lista piatta: i temi standard (chiaro / scuro / sistema)
// più le palette aggiuntive registrate nel ThemeProvider. Ogni voce corrisponde
// a una classe applicata su <html> da next-themes (vedi app/globals.css).
export function ModeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <PaletteIcon aria-hidden="true" />
          <span className="sr-only">Cambia tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">Chiaro</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Scuro</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">Sistema</DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Catppuccin</DropdownMenuLabel>
          <DropdownMenuRadioItem value="catppuccin-latte">
            Latte
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="catppuccin-mocha">
            Mocha
          </DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Solarized</DropdownMenuLabel>
          <DropdownMenuRadioItem value="solarized-light">
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="solarized-dark">
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Altri (scuri)</DropdownMenuLabel>
          <DropdownMenuRadioItem value="monokai">Monokai</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dracula">Dracula</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="nord">Nord</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="gruvbox-dark">
            Gruvbox
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
