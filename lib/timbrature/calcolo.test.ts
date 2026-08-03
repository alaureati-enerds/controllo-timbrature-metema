import { describe, expect, it } from "vitest"

import { CALCOLO_DEFAULTS } from "@/lib/settings/schema"
import type {
  CalcoloSettingsAdmin,
  OrarioLavoroSettingsAdmin,
} from "@/lib/settings/schema"
import {
  calcolaCorretti,
  calcolaOreSplit,
  calcolaTotaliMese,
  costruisciOrario,
  minutiDaOra,
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
  rapportino?: RiepilogoRapportino,
  oggi?: string,
  giustificato?: boolean
) {
  return calcolaCorretti(
    giornata(raw, giorno),
    override,
    regole,
    ORARIO,
    rapportino,
    oggi,
    giustificato
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

describe("assente non si segnala su giorni non ancora trascorsi", () => {
  it("giorno feriale futuro senza timbrature → nessuna anomalia (non è ancora accaduto)", () => {
    // "oggi" fittizio è il 20/06: il 23 non è ancora arrivato.
    const r = calc("", 23, CALCOLO_DEFAULTS, undefined, undefined, "2026-06-20")
    expect(r.anomalie).toEqual([])
  })

  it("il giorno di oggi stesso, senza timbrature → nessuna anomalia (giornata non conclusa)", () => {
    const r = calc("", 23, CALCOLO_DEFAULTS, undefined, undefined, "2026-06-23")
    expect(r.anomalie).toEqual([])
  })

  it("un giorno passato senza timbrature resta assente anche con oggi esplicito", () => {
    const r = calc("", 23, CALCOLO_DEFAULTS, undefined, undefined, "2026-06-25")
    expect(r.anomalie).toEqual(["assente"])
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

// Casi REALI di luglio 2026 (MySQL aziendale), l'evidenza che ha motivato
// l'ancoraggio: COLA DANIELE entra alle 06:37 ed esce alle 17:14, ma con
// l'orario standard il registro mostrava 07:30–18:00, cioè un'uscita DOPO
// l'ultimo timbro. BONI ROBERTO invece segue davvero l'orario standard: è la
// regressione che deve restare identica.
function giornataRapportino(raw: string, giorno: number): Giornata {
  return {
    giorno: `2026-07-${String(giorno).padStart(2, "0")}`,
    giornoSettimana: new Date(2026, 6, giorno).getDay(),
    ...assegnaTurni(parse(raw), ORARIO_RAPPORTINO, CALCOLO_DEFAULTS),
  }
}

function ancorato(
  raw: string,
  giorno: number,
  lavoroMinuti: number,
  viaggioMinuti = 0,
  regole: CalcoloSettingsAdmin = CALCOLO_DEFAULTS
) {
  return calcolaCorretti(
    giornataRapportino(raw, giorno),
    undefined,
    regole,
    ORARIO_RAPPORTINO,
    { lavoroMinuti, viaggioMinuti, pernottamento: false }
  )
}

function orari(r: ReturnType<typeof calcolaCorretti>) {
  return [r.ce1, r.cu1, r.ce2, r.cu2]
}

describe("costruisciOrarioAncorato — le ore del rapportino sugli orari timbrati", () => {
  it("BONI 07/07 (regressione): chi segue l'orario standard non cambia di un minuto", () => {
    const r = ancorato("E 07:28 U 17:03", 7, 8 * 60)
    expect(orari(r)).toEqual(["07:30", "12:30", "14:00", "17:00"])
    expect(r.totale).toBe(8 * 60)
  })

  it("COLAD 07/07: 9h su 06:37–17:14 → entrata e uscita restano i timbri veri, la pausa assorbe", () => {
    const r = ancorato("E 06:37 U 17:14", 7, 7 * 60, 2 * 60)
    // Prima mostrava 07:30 12:30 14:00 18:00: un'uscita 46' dopo l'ultimo timbro.
    expect(orari(r)).toEqual(["06:45", "12:30", "13:45", "17:00"])
    expect(r.totale).toBe(9 * 60)
    // La differenza fra span timbrato e ore dichiarate è la pausa: 75'.
    expect(minutiDaOra("13:45") - minutiDaOra("12:30")).toBe(75)
  })

  it("COLAD 24/07: con tutti e 4 i timbri anche la pausa parte da quello vero", () => {
    const r = ancorato("E 07:15 U 12:32 E 13:48 U 17:01", 24, 7 * 60, 60)
    // Tre slot su quattro sono il timbro reale arrotondato: si sposta solo il
    // rientro, l'unico che deve assorbire la differenza.
    expect(orari(r)).toEqual(["07:15", "12:30", "14:15", "17:00"])
    expect(r.totale).toBe(8 * 60)
  })

  it("COLAD 20/07: timbrata solo l'entrata → si riempie in avanti da quella", () => {
    const r = ancorato("E 05:59", 20, 7 * 60 + 30, 4 * 60)
    // Prima: 07:30 12:30 14:00 20:30.
    expect(orari(r)).toEqual(["06:00", "12:30", "14:00", "19:00"])
    expect(r.totale).toBe(11 * 60 + 30)
  })

  it("COLAD 06/07: timbrata solo l'uscita serale → si riempie all'indietro da quella", () => {
    const r = ancorato("U 17:05", 6, 7 * 60, 2 * 60)
    // Prima: 07:30 12:30 14:00 18:00, di nuovo oltre l'ultimo timbro.
    expect(orari(r)).toEqual(["06:30", "12:30", "14:00", "17:00"])
    expect(r.totale).toBe(9 * 60)
  })

  it("CAPRAD 17/07: mezza giornata → un turno solo, ancorato all'entrata", () => {
    const r = ancorato("E 07:07 U 12:33", 17, 3 * 60, 2 * 60)
    expect(orari(r)).toEqual(["07:15", "12:15", null, null])
    expect(r.totale).toBe(5 * 60)
  })

  it("MAGN.G 01/07: 8h non entrano in un timbro di mezzogiorno → regge l'uscita serale", () => {
    const r = ancorato("E 12:34 U 17:07", 1, 8 * 60)
    // Ancorare l'entrata darebbe 12:45–20:45: ore inventate dopo l'ultimo
    // timbro, proprio il difetto da correggere.
    expect(orari(r)).toEqual(["07:30", "12:30", "14:00", "17:00"])
    expect(r.totale).toBe(8 * 60)
  })

  it("LENTINI 09/07: 8h in 7h45 di finestra → l'uscita regge, l'entrata arretra", () => {
    const r = ancorato("E 06:02 U 14:10", 9, 8 * 60)
    expect(orari(r)).toEqual(["06:00", "14:00", null, null])
    expect(r.totale).toBe(8 * 60)
  })

  it("un'uscita di mezzogiorno non regge la giornata: lì vince l'entrata", () => {
    // Timbrata l'entrata e l'uscita per il pranzo, mai il rientro. Ancorare
    // quell'uscita all'indietro farebbe cominciare la giornata alle 04:00.
    const r = ancorato("E 07:30 U 12:00", 8, 8 * 60)
    expect(orari(r)).toEqual(["07:30", "12:30", "14:00", "17:00"])
    expect(r.totale).toBe(8 * 60)
  })

  it("nessuna timbratura: niente a cui ancorarsi, resta l'orario standard", () => {
    const r = ancorato("", 16, 8 * 60)
    expect(orari(r)).toEqual(["07:30", "12:30", "14:00", "17:00"])
  })

  it("gli slot che coincidono con il timbro si dichiarano «timbrata», non «rapportino»", () => {
    const r = ancorato("E 06:37 U 17:14", 7, 7 * 60, 2 * 60)
    expect(r.provenienza.e1).toBe("timbrata")
    expect(r.provenienza.u2).toBe("timbrata")
    // Fine mattino e rientro sono ricostruiti: quelli sì vengono dal rapportino.
    expect(r.provenienza.u1).toBe("rapportino")
    expect(r.provenienza.e2).toBe("rapportino")
  })

  it("il totale resta SEMPRE quello del rapportino, ramo per ramo", () => {
    const casi: Array<[string, number]> = [
      ["E 07:28 U 17:03", 480], // due ancore, ci sta
      ["E 06:37 U 17:14", 540],
      ["E 05:59", 690], // solo entrata
      ["U 17:05", 540], // solo uscita
      ["E 07:07 U 12:33", 300], // mezza giornata
      ["E 12:34 U 17:07", 480], // non ci sta
      ["", 480], // nessuna timbratura
    ]
    for (const [raw, totale] of casi) {
      expect(ancorato(raw, 7, totale).totale).toBe(totale)
    }
  })

  it("con il flag disattivato si torna all'orario standard di prima", () => {
    const regole: CalcoloSettingsAdmin = {
      ...CALCOLO_DEFAULTS,
      ancoraRapportinoAlleTimbrature: false,
    }
    const r = ancorato("E 06:37 U 17:14", 7, 7 * 60, 2 * 60, regole)
    expect(orari(r)).toEqual(["07:30", "12:30", "14:00", "18:00"])
    expect(r.totale).toBe(9 * 60)
  })

  it("una correzione manuale vince comunque sull'orario ancorato", () => {
    const r = calcolaCorretti(
      giornataRapportino("E 06:37 U 17:14", 7),
      { entrata1: "09:00" },
      CALCOLO_DEFAULTS,
      ORARIO_RAPPORTINO,
      { lavoroMinuti: 9 * 60, viaggioMinuti: 0, pernottamento: false }
    )
    expect(r.ce1).toBe("09:00")
    expect(r.provenienza.e1).toBe("corretta")
    expect(r.cu2).toBe("17:00")
  })

  it("un giustificativo azzera comunque la giornata ancorata", () => {
    const r = calcolaCorretti(
      giornataRapportino("E 06:37 U 17:14", 7),
      undefined,
      CALCOLO_DEFAULTS,
      ORARIO_RAPPORTINO,
      { lavoroMinuti: 9 * 60, viaggioMinuti: 0, pernottamento: false },
      undefined,
      true
    )
    expect(orari(r)).toEqual([null, null, null, null])
    expect(r.totale).toBe(0)
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

describe("calcolaCorretti — giornata giustificata (ferie, malattia, ...)", () => {
  it("azzera orari e ore anche su una giornata EUEU pulita", () => {
    const r = calc(
      "E 07:29 U 12:32 E 14:02 U 17:00",
      3,
      CALCOLO_DEFAULTS,
      undefined,
      undefined,
      undefined,
      true
    )
    expect(r.ce1).toBeNull()
    expect(r.cu1).toBeNull()
    expect(r.ce2).toBeNull()
    expect(r.cu2).toBeNull()
    expect(r.totale).toBe(0)
    expect(r.ordinario).toBe(0)
    expect(r.straordinario).toBe(0)
    expect(r.straordinarioViaggio).toBe(0)
    expect(r.anomalie).toEqual([])
    expect(r.provenienza).toEqual({
      e1: "assente",
      u1: "assente",
      e2: "assente",
      u2: "assente",
    })
  })

  it("spegne l'anomalia «assente» sul feriale vuoto", () => {
    // Stesso giorno del test a inizio file, che senza giustificativo dà ["assente"].
    const r = calc("", 23, CALCOLO_DEFAULTS, undefined, undefined, undefined, true)
    expect(r.anomalie).toEqual([])
  })

  it("silenzia anche le anomalie del dato grezzo (sentinella 00:00)", () => {
    const r = calc("E 00:00 U 17:12", 5, CALCOLO_DEFAULTS, undefined, undefined, undefined, true)
    expect(r.anomalie).toEqual([])
    expect(r.totale).toBe(0)
  })

  it("vince sulla correzione manuale, che resta salvata ma inerte", () => {
    const r = calc(
      "",
      23,
      CALCOLO_DEFAULTS,
      { entrata1: "08:00", uscita1: "12:00" },
      undefined,
      undefined,
      true
    )
    expect(r.ce1).toBeNull()
    expect(r.cu1).toBeNull()
    expect(r.totale).toBe(0)
  })

  it("vince sul rapportino ma ne conserva il pernotto", () => {
    const r = calc(
      "",
      23,
      CALCOLO_DEFAULTS,
      undefined,
      { lavoroMinuti: 8 * 60, viaggioMinuti: 60, pernottamento: true },
      undefined,
      true
    )
    expect(r.totale).toBe(0)
    expect(r.ce1).toBeNull()
    expect(r.pernottamento).toBe(true)
  })

  it("giustificato = false lascia il calcolo identico a com'era", () => {
    const raw = "E 07:26 U 17:01"
    expect(
      calc(raw, 4, CALCOLO_DEFAULTS, undefined, undefined, undefined, false)
    ).toEqual(calc(raw, 4))
  })
})

describe("calcolaTotaliMese con giornate giustificate", () => {
  it("le ore della giornata giustificata non entrano nei totali, il pernotto sì", () => {
    const lavorata = calc("E 07:26 U 18:30", 18) // 9h30: 8h ord + 1h30 straord
    const giustificata = calc(
      "E 07:29 U 12:32 E 14:02 U 17:00",
      3,
      CALCOLO_DEFAULTS,
      undefined,
      { lavoroMinuti: 0, viaggioMinuti: 0, pernottamento: true },
      undefined,
      true
    )

    const totali = calcolaTotaliMese([lavorata, giustificata])
    expect(totali.totale).toBe(570)
    expect(totali.ordinario).toBe(480)
    expect(totali.straordinario).toBe(90)
    // Il pernotto resta un fatto del giorno anche se le ore sono azzerate.
    expect(totali.giorniTrasferta).toBe(1)
  })
})
