import { prisma } from "@/lib/prisma"

// Dipendenti (codice del gestionale) nascosti dalla select della pagina
// Timbrature. Nessuna autorizzazione qui (vedi lib/timbrature/authz.ts).

/** Codici dei dipendenti nascosti dalla select di Timbrature. */
export async function listDipendentiNascosti(): Promise<string[]> {
  const righe = await prisma.dipendenteNascosto.findMany({
    select: { dipendente: true },
  })
  return righe.map((r) => r.dipendente)
}

/** Nasconde o rimostra un dipendente nella select di Timbrature. */
export async function setDipendenteNascosto(
  dipendente: string,
  nascosto: boolean
): Promise<void> {
  if (nascosto) {
    await prisma.dipendenteNascosto.upsert({
      where: { dipendente },
      create: { dipendente },
      update: {},
    })
  } else {
    await prisma.dipendenteNascosto
      .delete({ where: { dipendente } })
      .catch(() => {})
  }
}
