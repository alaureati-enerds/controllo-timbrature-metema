import { describe, expect, it } from "vitest"

import { raggruppaPerGiorno, sommaGiorno } from "@/lib/rapportini/calcolo"
import type { RapportinoRiga } from "@/lib/mysql/rapportini"

function riga(
  giorno: string,
  oreLavorazione: number,
  minutiLavorazione: number,
  oreViaggio: number,
  minutiViaggio: number,
  pernottamento = false
): RapportinoRiga {
  return {
    progressivo: 1,
    cmsCodice: "000000001",
    cmsDescrizione: "",
    tipologia: "1",
    descrizione: "",
    giorno,
    oreLavorazione,
    minutiLavorazione,
    oreViaggio,
    minutiViaggio,
    ore: oreLavorazione + oreViaggio,
    minuti: minutiLavorazione + minutiViaggio,
    costoOrario: 0,
    costoTotale: 0,
    importoVitto: 0,
    importoAlloggio: 0,
    kilometri: 0,
    rimborsoChilometrico: 0,
    targaAutomezzo: "",
    pernottamento,
    guidatoDalle: null,
    guidatoAlle: null,
    giornoFestivo: false,
    vitto: false,
  }
}

describe("raggruppaPerGiorno / sommaGiorno", () => {
  it("somma più rapportini dello stesso giorno e OR-a il pernotto", () => {
    const righe = [
      riga("2026-06-19", 4, 0, 0, 0, false),
      riga("2026-06-19", 3, 30, 1, 0, true),
      riga("2026-06-20", 8, 0, 0, 0, false),
    ]
    const perGiorno = raggruppaPerGiorno(righe)
    expect(perGiorno.get("2026-06-19")).toHaveLength(2)

    const riepilogo19 = sommaGiorno(perGiorno.get("2026-06-19")!)
    expect(riepilogo19).toEqual({
      lavoroMinuti: 4 * 60 + 3 * 60 + 30,
      viaggioMinuti: 60,
      pernottamento: true,
    })

    const riepilogo20 = sommaGiorno(perGiorno.get("2026-06-20")!)
    expect(riepilogo20).toEqual({
      lavoroMinuti: 480,
      viaggioMinuti: 0,
      pernottamento: false,
    })
  })
})
