import { describe, expect, it } from "vitest"

import { CALCOLO_DEFAULTS } from "@/lib/settings/schema"
import type {
  CalcoloSettingsAdmin,
  OrarioLavoroSettingsAdmin,
} from "@/lib/settings/schema"
import {
  calcolaCorretti,
  calcolaOreSplit,
  costruisciOrario,
} from "@/lib/timbrature/calcolo"
import type { RiepilogoRapportino } from "@/lib/timbrature/calcolo"
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
  override?: Record<string, string | null>,
  rapportino?: RiepilogoRapportino
) {
  return calcolaCorretti(
    giornata(raw, giorno),
    override,
    regole,
    ORARIO,
    rapportino
  )
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

describe("le anomalie «grezze» si spengono dopo una correzione manuale", () => {
  it("timbratura_sospetta sparisce se l'admin corregge il giorno", () => {
    // Senza correzione il flag c'è (il grezzo conteneva una 00:00)...
    expect(calc("E 00:00 U 17:12", 5).anomalie).toContain("timbratura_sospetta")

    // ...ma una volta assegnata l'entrata il giorno è stato rivisto: niente più
    // badge, e la pausa viene ricostruita normalmente.
    const r = calc("E 00:00 U 17:12", 5, CALCOLO_DEFAULTS, {
      entrata1: "08:00",
    })
    expect(r.anomalie).toEqual([])
    expect(r.totale).toBe(450) // 08:00–12:00 + 13:30–17:00
  })

  it("assente sparisce se l'admin applica un preset al giorno vuoto", () => {
    expect(calc("", 23).anomalie).toEqual(["assente"])

    const r = calc("", 23, CALCOLO_DEFAULTS, {
      entrata1: "08:00",
      uscita1: "12:00",
      entrata2: "13:30",
      uscita2: "17:30",
    })
    expect(r.anomalie).toEqual([])
    expect(r.totale).toBe(480)
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

// Standard usato negli esempi dell'utente per il rapportino: 07:30–12:30 /
// 14:00–17:00 (8h). Diverso da ORARIO sopra apposta, per non confondere i due
// gruppi di test.
const ORARIO_RAPPORTINO: OrarioLavoroSettingsAdmin = {
  primoIngresso: "07:30",
  primaUscita: "12:30",
  secondoIngresso: "14:00",
  secondaUscita: "17:00",
}

const MINUTI_ORDINARI = 480 // 8h, CALCOLO_DEFAULTS.minutiOrdinari

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
    const r = costruisciOrario(8 * 60, ORARIO_RAPPORTINO)
    expect(r).toEqual({
      entrata1: "07:30",
      uscita1: "12:30",
      entrata2: "14:00",
      uscita2: "17:00",
    })
  })

  it("meno della capacità del mattino → solo il primo turno, parziale", () => {
    const r = costruisciOrario(3 * 60, ORARIO_RAPPORTINO)
    expect(r).toEqual({
      entrata1: "07:30",
      uscita1: "10:30",
      entrata2: null,
      uscita2: null,
    })
  })

  it("più di 8h → il pomeriggio si estende oltre l'orario standard (straordinario)", () => {
    const r = costruisciOrario(10 * 60, ORARIO_RAPPORTINO)
    expect(r).toEqual({
      entrata1: "07:30",
      uscita1: "12:30",
      entrata2: "14:00",
      uscita2: "19:00",
    })
  })

  it("0 minuti → nessun orario", () => {
    expect(costruisciOrario(0, ORARIO_RAPPORTINO)).toEqual({
      entrata1: null,
      uscita1: null,
      entrata2: null,
      uscita2: null,
    })
  })
})

describe("calcolaCorretti — un rapportino guida la giornata", () => {
  it("sostituisce il marcatempo (giorno senza timbrature) con l'orario ricostruito", () => {
    const r = calc("", 10, CALCOLO_DEFAULTS, undefined, {
      lavoroMinuti: 8 * 60,
      viaggioMinuti: 0,
      pernottamento: false,
    })
    expect(r.ce1).toBe("08:00")
    expect(r.cu1).toBe("12:00")
    expect(r.ce2).toBe("13:30")
    expect(r.cu2).toBe("17:30")
    expect(r.ordinario).toBe(480)
    expect(r.straordinario).toBe(0)
    expect(r.straordinarioViaggio).toBe(0)
    expect(r.anomalie).toEqual([])
    expect(r.provenienza).toEqual({
      e1: "rapportino",
      u1: "rapportino",
      e2: "rapportino",
      u2: "rapportino",
    })
  })

  it("lavoro + viaggio oltre l'ordinario finisce in straordinario viaggio", () => {
    const r = calc("", 10, CALCOLO_DEFAULTS, undefined, {
      lavoroMinuti: 8 * 60,
      viaggioMinuti: 2 * 60,
      pernottamento: false,
    })
    expect(r.totale).toBe(600)
    expect(r.ordinario).toBe(480)
    expect(r.straordinario).toBe(0)
    expect(r.straordinarioViaggio).toBe(120)
    expect(r.cu2).toBe("19:30") // il pomeriggio si estende oltre le 17:30
  })

  it("un giorno senza rapportino (o con rapportino a zero ore) resta invariato", () => {
    const base = calc("E 07:26 U 17:01", 4)
    const conRapportinoVuoto = calc("E 07:26 U 17:01", 4, CALCOLO_DEFAULTS, undefined, {
      lavoroMinuti: 0,
      viaggioMinuti: 0,
      pernottamento: false,
    })
    expect(conRapportinoVuoto).toEqual(base)
  })

  it("la correzione manuale vince sul rapportino, slot per slot", () => {
    const r = calc(
      "",
      10,
      CALCOLO_DEFAULTS,
      { entrata1: "09:00" },
      { lavoroMinuti: 8 * 60, viaggioMinuti: 0, pernottamento: false }
    )
    expect(r.ce1).toBe("09:00")
    expect(r.provenienza.e1).toBe("corretta")
    // Gli altri slot restano guidati dal rapportino, non toccati dall'override.
    expect(r.cu1).toBe("12:00")
    expect(r.provenienza.u1).toBe("rapportino")
  })

  it("una correzione manuale ricalcola ordinario/straordinario dall'orario finale, non resta congelata sul totale del rapportino (bug segnalato: 'corretto ma non ricalcola')", () => {
    // Rapportino da 8h piatte (8:00-12:00 + 13:30-17:30, tutto ordinario).
    // L'admin sposta a mano l'entrata di un'ora: 9:00-12:00 + 13:30-17:30 =
    // 3h + 4h = 7h. Il totale/ordinario DEVE riflettere l'orario corretto.
    const r = calc(
      "",
      10,
      CALCOLO_DEFAULTS,
      { entrata1: "09:00" },
      { lavoroMinuti: 8 * 60, viaggioMinuti: 0, pernottamento: false }
    )
    expect(r.totale).toBe(7 * 60)
    expect(r.ordinario).toBe(7 * 60)
    expect(r.straordinario).toBe(0)
    expect(r.straordinarioViaggio).toBe(0)
  })

  it("una correzione manuale che riduce l'uscita rimescola la categoria dello straordinario (non più viaggio)", () => {
    // Rapportino da 8h lavoro + 2h viaggio: senza correzioni farebbe 8
    // ordinario + 2 straord. VIAGGIO (uscita ricostruita alle 19:30, vedi
    // test sopra). L'admin però corregge a mano l'uscita serale alle 18:00
    // (mezz'ora di straordinario in meno): 8:00-12:00 + 13:30-18:00 = 4h30
    // + 4h30 = 8h30. Una volta corretto a mano non si può più sapere quanto
    // di quel totale sia viaggio: lo straordinario residuo (30m) ricade sul
    // lavoro (bucket unico), non più sul viaggio.
    const r = calc(
      "",
      10,
      CALCOLO_DEFAULTS,
      { uscita2: "18:00" },
      { lavoroMinuti: 8 * 60, viaggioMinuti: 2 * 60, pernottamento: false }
    )
    expect(r.cu2).toBe("18:00")
    expect(r.totale).toBe(8 * 60 + 30)
    expect(r.ordinario).toBe(8 * 60)
    expect(r.straordinario).toBe(30)
    expect(r.straordinarioViaggio).toBe(0)
  })

  it("un rapportino spiega il giorno: silenzia assente e timbratura sospetta", () => {
    const g: Giornata = {
      giorno: "2026-06-10",
      giornoSettimana: new Date(2026, 5, 10).getDay(),
      entrata1: null,
      uscita1: null,
      entrata2: null,
      uscita2: null,
      totaleMinuti: 0,
      nTimbrature: 0,
      haSentinella0000: true,
    }
    const r = calcolaCorretti(g, undefined, CALCOLO_DEFAULTS, ORARIO, {
      lavoroMinuti: 8 * 60,
      viaggioMinuti: 0,
      pernottamento: false,
    })
    expect(r.anomalie).toEqual([])
  })

  it("il pernotto passa sempre, anche su un rapportino a zero ore che non guida il giorno", () => {
    const r = calc("", 23, CALCOLO_DEFAULTS, undefined, {
      lavoroMinuti: 0,
      viaggioMinuti: 0,
      pernottamento: true,
    })
    expect(r.pernottamento).toBe(true)
    // Zero ore non spiega il giorno: l'anomalia "assente" resta.
    expect(r.anomalie).toEqual(["assente"])
    expect(r.ce1).toBeNull()
  })
})
