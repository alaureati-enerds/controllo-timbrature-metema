import { describe, expect, it } from "vitest"

import type { OrarioLavoroSettingsAdmin } from "@/lib/settings/schema"
import {
  calcolaOreSplit,
  costruisciOrario,
  raggruppaPerGiorno,
  sommaGiorno,
} from "@/lib/rapportini/calcolo"
import type { RapportinoRiga } from "@/lib/mysql/rapportini"

// Standard usato negli esempi dell'utente: 07:30–12:30 / 14:00–17:00 (8h).
const ORARIO: OrarioLavoroSettingsAdmin = {
  primoIngresso: "07:30",
  primaUscita: "12:30",
  secondoIngresso: "14:00",
  secondaUscita: "17:00",
}

const MINUTI_ORDINARI = 480 // 8h, CALCOLO_DEFAULTS.minutiOrdinari

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

describe("calcolaOreSplit — esempi dell'utente", () => {
  it("8h lavoro + 2h viaggio → 8 ordinario, 2 straord. viaggio", () => {
    const r = calcolaOreSplit(8 * 60, 2 * 60, MINUTI_ORDINARI)
    expect(r.ordinario).toBe(480)
    expect(r.straordinarioLavoro).toBe(0)
    expect(r.straordinarioViaggio).toBe(120)
    expect(r.totale).toBe(600)
  })

  it("6h lavoro + 2h viaggio → 8 ordinario, nessuno straordinario", () => {
    const r = calcolaOreSplit(6 * 60, 2 * 60, MINUTI_ORDINARI)
    expect(r.ordinario).toBe(480)
    expect(r.straordinarioLavoro).toBe(0)
    expect(r.straordinarioViaggio).toBe(0)
    expect(r.totale).toBe(480)
  })

  it("10h lavoro + 1h viaggio → 8 ordinario, 2 straord. lavoro, 1 straord. viaggio", () => {
    const r = calcolaOreSplit(10 * 60, 1 * 60, MINUTI_ORDINARI)
    expect(r.ordinario).toBe(480)
    expect(r.straordinarioLavoro).toBe(120)
    expect(r.straordinarioViaggio).toBe(60)
    expect(r.totale).toBe(660)
  })

  it("nessun lavoro né viaggio → tutto zero", () => {
    const r = calcolaOreSplit(0, 0, MINUTI_ORDINARI)
    expect(r).toEqual({
      ordinario: 0,
      straordinarioLavoro: 0,
      straordinarioViaggio: 0,
      totale: 0,
    })
  })
})

describe("costruisciOrario", () => {
  it("8h totali → riempie esattamente il mattino e il pomeriggio standard", () => {
    const r = costruisciOrario(8 * 60, ORARIO)
    expect(r).toEqual({
      entrata1: "07:30",
      uscita1: "12:30",
      entrata2: "14:00",
      uscita2: "17:00",
    })
  })

  it("meno della capacità del mattino → solo il primo turno, parziale", () => {
    const r = costruisciOrario(3 * 60, ORARIO)
    expect(r).toEqual({
      entrata1: "07:30",
      uscita1: "10:30",
      entrata2: null,
      uscita2: null,
    })
  })

  it("più di 8h → il pomeriggio si estende oltre l'orario standard (straordinario)", () => {
    const r = costruisciOrario(10 * 60, ORARIO)
    expect(r).toEqual({
      entrata1: "07:30",
      uscita1: "12:30",
      entrata2: "14:00",
      uscita2: "19:00",
    })
  })

  it("0 minuti → nessun orario", () => {
    expect(costruisciOrario(0, ORARIO)).toEqual({
      entrata1: null,
      uscita1: null,
      entrata2: null,
      uscita2: null,
    })
  })
})

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
