import type {
  CalcoloSettingsAdmin,
  OrarioLavoroSettingsAdmin,
} from "@/lib/settings/schema"
import { minutiDaOra } from "@/lib/timbrature/calcolo"

// Assegnazione dei turni dalle timbrature grezze. Modulo PURO (nessun I/O),
// estratto da giornate.ts perché sia testabile senza toccare MySQL/Prisma: è la
// prima metà della pipeline (grezzo → turni), la seconda è calcolo.ts.

export type Timbratura = { ora: string; tipologia: string }

/** true se l'orario è la sentinella 00:00 (i secondi sono ignorati). */
function isSentinella0000(ora: string): boolean {
  return ora.slice(0, 5) === "00:00"
}

/**
 * Pulizia dei dati grezzi prima del bucketing:
 * - scarta le timbrature 00:00 (valore sentinella del marcatempo) se `ignora0000`;
 * - collassa i timbri consecutivi dello stesso tipo entro `dedupMinuti`
 *   (tiene la PRIMA E e l'ULTIMA U). `dedupMinuti = 0` disattiva la deduplica.
 *
 * La lista in ingresso è già ordinata per orario.
 */
function pulisci(
  timbrature: Timbratura[],
  regole: CalcoloSettingsAdmin
): { pulite: Timbratura[]; haSentinella0000: boolean } {
  const haSentinella0000 = timbrature.some((t) => isSentinella0000(t.ora))

  let lista = regole.ignora0000
    ? timbrature.filter((t) => !isSentinella0000(t.ora))
    : timbrature

  if (regole.dedupMinuti > 0) {
    const out: Timbratura[] = []
    for (const t of lista) {
      const prev = out[out.length - 1]
      const doppione =
        prev &&
        prev.tipologia === t.tipologia &&
        minutiDaOra(t.ora) - minutiDaOra(prev.ora) <= regole.dedupMinuti
      if (doppione) {
        // Stesso tipo entro la soglia: per le U tieni l'ultima (sostituisci),
        // per le E tieni la prima (scarta la corrente).
        if (t.tipologia === "U") out[out.length - 1] = t
        continue
      }
      out.push(t)
    }
    lista = out
  }

  return { pulite: lista, haSentinella0000 }
}

/**
 * Assegna i turni (entrata1/uscita1, entrata2/uscita2) dalle timbrature pulite.
 * Per ogni finestra (mattina / pomeriggio, separate da `sogliaPomeriggio`):
 *
 * - Entrata → prima E della finestra
 * - Uscita  → prima o ultima U dopo l'entrata, secondo `strategiaUscita`
 * - Se non c'è E ma c'è una U → uscita orfana (senza entrata)
 *
 * Il tipo E/U non viene mai alterato. Restituisce anche i segnali grezzi che
 * servono al calcolo delle anomalie (conteggio dopo pulizia, sentinella 00:00).
 */
export function assegnaTurni(
  timbrature: Timbratura[],
  orario: OrarioLavoroSettingsAdmin,
  regole: CalcoloSettingsAdmin
) {
  const { pulite, haSentinella0000 } = pulisci(timbrature, regole)

  const separazione = minutiDaOra(regole.sogliaPomeriggio)
  const mattino = pulite.filter((t) => minutiDaOra(t.ora) < separazione)
  const pom = pulite.filter((t) => minutiDaOra(t.ora) >= separazione)

  function assegna(lista: Timbratura[]): {
    entrata: string | null
    uscita: string | null
  } {
    const entrata = lista.find((t) => t.tipologia === "E")?.ora ?? null

    // Uscite valide: dopo l'entrata (o tutte, se l'entrata manca → uscita orfana).
    const uscite = lista.filter(
      (t) =>
        t.tipologia === "U" &&
        (entrata == null || minutiDaOra(t.ora) > minutiDaOra(entrata))
    )
    let uscita: string | null = null
    if (uscite.length > 0) {
      uscita =
        regole.strategiaUscita === "ultima"
          ? uscite[uscite.length - 1].ora
          : uscite[0].ora
    }

    return { entrata, uscita }
  }

  const t1 = assegna(mattino)
  const t2 = assegna(pom)

  let totaleMinuti = 0
  if (t1.entrata && t1.uscita) {
    totaleMinuti += minutiDaOra(t1.uscita) - minutiDaOra(t1.entrata)
  }
  if (t2.entrata && t2.uscita) {
    totaleMinuti += minutiDaOra(t2.uscita) - minutiDaOra(t2.entrata)
  }

  return {
    entrata1: t1.entrata,
    uscita1: t1.uscita,
    entrata2: t2.entrata,
    uscita2: t2.uscita,
    totaleMinuti,
    nTimbrature: pulite.length,
    haSentinella0000,
  }
}
