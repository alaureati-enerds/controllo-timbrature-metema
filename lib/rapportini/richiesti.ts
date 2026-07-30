import { prisma } from "@/lib/prisma"

// Dipendenti (codice del gestionale) per cui il rapportino è obbligatorio.
// Nessuna autorizzazione qui (vedi richiesti-authz.ts).

/** Codici dei dipendenti per cui il rapportino è obbligatorio. */
export async function listDipendentiRichiesti(): Promise<string[]> {
  const righe = await prisma.dipendenteRapportino.findMany({
    select: { dipendente: true },
  })
  return righe.map((r) => r.dipendente)
}

/** Attiva o disattiva l'obbligo di rapportino per un dipendente. */
export async function setRapportinoRichiesto(
  dipendente: string,
  richiesto: boolean
): Promise<void> {
  if (richiesto) {
    await prisma.dipendenteRapportino.upsert({
      where: { dipendente },
      create: { dipendente },
      update: {},
    })
  } else {
    await prisma.dipendenteRapportino
      .delete({ where: { dipendente } })
      .catch(() => {})
  }
}
