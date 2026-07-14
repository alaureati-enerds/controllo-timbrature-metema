import { describe, expect, it } from "vitest"

import { CALCOLO_DEFAULTS } from "@/lib/settings/schema"
import type {
  CalcoloSettingsAdmin,
  OrarioLavoroSettingsAdmin,
} from "@/lib/settings/schema"
import { calcolaCorretti } from "@/lib/timbrature/calcolo"
import type { Giornata } from "@/lib/timbrature/giornate"
import { assegnaTurni, type Timbratura } from "@/lib/timbrature/turni"

// Casi reali di BONI (giugno 2026): coprono tutta la casistica del motore. Sono
// la giustificazione dei default e la regressione che distingue questa logica da
// quella del vecchio Access — su tutte, il 30/06 che DEVE restare a 4h30.

const ORARIO: OrarioLavoroSettingsAdmin = {
  primoIngresso: "08:00",
  primaUscita: "12:00",
  secondoIngresso: "13:30",
  secondaUscita: "17:30",
}

function parse(raw: string): Timbratura[] {
  if (!raw.trim()) return []
  const tok = raw.trim().split(/\s+/)
  const out: Timbratura[] = []
  for (let i = 0; i + 1 < tok.length; i += 2) {
    out.push({ tipologia: tok[i], ora: tok[i + 1] })
  }
  return out.sort((a, b) => a.ora.localeCompare(b.ora))
}

function giornata(raw: string, giorno: number): Giornata {
  return {
    giorno: `2026-06-${String(giorno).padStart(2, "0")}`,
    giornoSettimana: new Date(2026, 5, giorno).getDay(),
    ...assegnaTurni(parse(raw), ORARIO, CALCOLO_DEFAULTS),
  }
}

function calc(
  raw: string,
  giorno: number,
  regole: CalcoloSettingsAdmin = CALCOLO_DEFAULTS,
  override?: Record<string, string | null>
) {
  return calcolaCorretti(giornata(raw, giorno), override, regole, ORARIO)
}

describe("calcolaCorretti — casi reali BONI giugno 2026", () => {
  it("03/06 EUEU pulito → 7h45, nessun fill, nessuna anomalia", () => {
    const r = calc("E 07:29 U 12:32 E 14:02 U 17:00", 3)
    expect(r.totale).toBe(465)
    expect(r.anomalie).toEqual([])
    expect(r.provenienza).toEqual({
      e1: "timbrata",
      u1: "timbrata",
      e2: "timbrata",
      u2: "timbrata",
    })
  })

  it("04/06 EU chiusa → 8h00, pausa ricostruita (uscita1/entrata2)", () => {
    const r = calc("E 07:26 U 17:01", 4)
    expect(r.totale).toBe(480)
    expect(r.ordinario).toBe(480)
    expect(r.straordinario).toBe(0)
    expect(r.cu1).toBe("12:00")
    expect(r.ce2).toBe("13:30")
    expect(r.provenienza.u1).toBe("ricostruita")
    expect(r.provenienza.e2).toBe("ricostruita")
    expect(r.anomalie).toEqual([])
  })

  it("18/06 EU lunga → 9h30 con 1h30 di straordinario, pausa ricostruita", () => {
    const r = calc("E 07:26 U 18:30", 18)
    expect(r.totale).toBe(570)
    expect(r.ordinario).toBe(480)
    expect(r.straordinario).toBe(90)
    expect(r.anomalie).toEqual([])
  })

  it("30/06 mezza giornata → 4h30, NESSUN fill (giornata non chiusa)", () => {
    const r = calc("E 07:27 U 12:07", 30)
    expect(r.totale).toBe(270)
    expect(r.ce2).toBeNull()
    expect(r.cu2).toBeNull()
    expect(r.provenienza.u1).toBe("timbrata")
    expect(r.anomalie).toEqual([])
  })

  it("09/06 solo uscita → 0h, entrata_mancante", () => {
    const r = calc("U 17:01", 9)
    expect(r.totale).toBe(0)
    expect(r.anomalie).toEqual(["entrata_mancante"])
  })

  it("05/06 sentinella 00:00 → scartata, entrata_mancante + timbratura_sospetta", () => {
    const r = calc("E 00:00 U 17:12", 5)
    expect(r.totale).toBe(0)
    expect(r.anomalie).toEqual(["entrata_mancante", "timbratura_sospetta"])
  })

  it("23/06 feriale senza timbrature → 0h, assente", () => {
    const r = calc("", 23)
    expect(r.totale).toBe(0)
    expect(r.anomalie).toEqual(["assente"])
  })

  it("06-07/06 weekend senza timbrature → 0h, nessuna anomalia", () => {
    expect(calc("", 6).anomalie).toEqual([]) // sabato
    expect(calc("", 7).anomalie).toEqual([]) // domenica
  })
})

describe("regole configurabili", () => {
  it("pausaAutomatica OFF → la EU torna a 0h e diventa turno_incompleto", () => {
    const regole = { ...CALCOLO_DEFAULTS, pausaAutomatica: false }
    const r = calc("E 07:26 U 17:01", 4, regole)
    expect(r.totale).toBe(0)
    expect(r.cu1).toBeNull()
    expect(r.anomalie).toContain("turno_incompleto")
  })

  it("granularità 30 min arrotonda entrate/uscite al mezzo blocco", () => {
    const regole = { ...CALCOLO_DEFAULTS, granularitaMinuti: 30 }
    const r = calc("E 07:29 U 12:32 E 14:02 U 17:00", 3, regole)
    expect(r.ce1).toBe("07:30") // 07:29 → su → 07:30
    expect(r.cu1).toBe("12:30") // 12:32 → giù → 12:30
    expect(r.ce2).toBe("14:30") // 14:02 → su → 14:30
  })

  it("dedup collassa i doppioni: tiene la prima E e l'ultima U", () => {
    // Due E ravvicinate e due U ravvicinate: restano E 07:26 e U 17:03.
    const r = calc("E 07:26 E 07:28 U 17:01 U 17:03", 4)
    expect(r.totale).toBe(480) // stessa EU chiusa → pausa ricostruita, 8h
    expect(r.ce1).toBe("07:30")
    expect(r.cu2).toBe("17:00") // 17:03 → giù/15 → 17:00
  })

  it("durata_eccessiva oltre oreMassimeGiorno", () => {
    const regole = { ...CALCOLO_DEFAULTS, oreMassimeGiorno: 480 }
    const r = calc("E 07:26 U 18:30", 18, regole) // 9h30 > 8h
    expect(r.anomalie).toContain("durata_eccessiva")
  })
})

describe("guardia di monotonia del fill", () => {
  it("non ricostruisce la pausa se l'entrata è dopo l'orario di pausa", () => {
    // Giornata costruita a mano: entrata alle 13:00, uscita alle 20:00. Il fill
    // proporrebbe cu1=12:00 < ce1=13:00 → sequenza non monotòna → niente fill.
    const g: Giornata = {
      giorno: "2026-06-10",
      giornoSettimana: new Date(2026, 5, 10).getDay(),
      entrata1: "13:00",
      uscita1: null,
      entrata2: null,
      uscita2: "20:00",
      totaleMinuti: 0,
      nTimbrature: 2,
      haSentinella0000: false,
    }
    const r = calcolaCorretti(g, undefined, CALCOLO_DEFAULTS, ORARIO)
    expect(r.cu1).toBeNull()
    expect(r.ce2).toBeNull()
    expect(r.anomalie).toContain("turno_incompleto")
  })
})
