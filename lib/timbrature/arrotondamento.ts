function parseMinuti(ora: string): number {
  const [h, m] = ora.split(":").map(Number)
  return h * 60 + m
}

function formattaOra(minuti: number): string {
  const h = Math.floor(minuti / 60)
  const m = minuti % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function arrotonda(ora: string, verso: "su" | "giu"): string {
  const minuti = parseMinuti(ora)
  const arrotondato =
    verso === "su"
      ? Math.ceil(minuti / 15) * 15
      : Math.floor(minuti / 15) * 15
  return formattaOra(arrotondato)
}

export function arrotondaEntrata(ora: string): string {
  return arrotonda(ora, "su")
}

export function arrotondaUscita(ora: string): string {
  return arrotonda(ora, "giu")
}
