/** Ricava fino a due iniziali da un nome, per gli avatar di fallback. */
export function initials(name?: string | null): string {
  if (!name) return "??"
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "??"
  )
}
