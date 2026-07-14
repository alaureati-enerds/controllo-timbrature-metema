import type { CalcoloSettingsAdmin } from "@/lib/settings/schema"

// Arrotondamento degli orari alla granularità configurata. Funzioni pure. Il
// verso e il passo vengono dalle regole del motore (lib/settings/calcolo.ts):
// entrate al quarto d'ora superiore, uscite all'inferiore, come da tradizione
// del gestionale — ma entrambi ora sono configurabili ("vicino" = al più vicino).

function parseMinuti(ora: string): number {
  const [h, m] = ora.split(":").map(Number)
  return h * 60 + m
}

function formattaOra(minuti: number): string {
  const h = Math.floor(minuti / 60)
  const m = minuti % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export type VersoArrotondamento = "su" | "giu" | "vicino"

export function arrotonda(
  ora: string,
  verso: VersoArrotondamento,
  granularita: number
): string {
  const minuti = parseMinuti(ora)
  const passo = granularita > 0 ? granularita : 1
  const arrotondato =
    verso === "su"
      ? Math.ceil(minuti / passo) * passo
      : verso === "giu"
        ? Math.floor(minuti / passo) * passo
        : Math.round(minuti / passo) * passo
  return formattaOra(arrotondato)
}

export function arrotondaEntrata(
  ora: string,
  regole: CalcoloSettingsAdmin
): string {
  return arrotonda(ora, regole.versoEntrata, regole.granularitaMinuti)
}

export function arrotondaUscita(
  ora: string,
  regole: CalcoloSettingsAdmin
): string {
  return arrotonda(ora, regole.versoUscita, regole.granularitaMinuti)
}
