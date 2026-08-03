import { format } from "date-fns"

import type {
  CalcoloSettingsAdmin,
  OrarioLavoroSettingsAdmin,
} from "@/lib/settings/schema"
import {
  arrotondaEntrata,
  arrotondaUscita,
} from "@/lib/timbrature/arrotondamento"
import type { Giornata } from "@/lib/timbrature/giornate"

// Calcolo dei valori CORRETTI di una giornata e dei totali del mese. Funzioni
// pure, senza React né accesso al DB: le usano sia la pagina Timbrature
// (components/admin/timbrature-manager.tsx) sia la stampa PDF lato server
// (app/api/admin/timbrature/stampa/), così i numeri a schermo e quelli
// stampati non possono divergere. Le regole del motore (lib/settings/calcolo.ts)
// e l'orario standard arrivano come parametri.

/** Minuti dall'inizio della giornata per un orario HH:MM. */
export function minutiDaOra(ora: string): number {
  const [h, m] = ora.split(":").map(Number)
  return h * 60 + m
}

// Inversa di `minutiDaOra`. Non fa wraparound sulle 24h: oltre mezzanotte
// (straordinario molto lungo) preferiamo un'ora "26:30" onesta a un
// azzeramento silenzioso che farebbe apparire un turno all'indietro.
export function oraDaMinuti(minuti: number): string {
  const h = Math.floor(minuti / 60)
  const m = minuti % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

// Riepilogo di un giorno di rapportini (assistenza tecnica, tabella `cmd` del
// MySQL aziendale, vedi lib/mysql/rapportini.ts), già sommato su eventuali
// righe multiple dello stesso giorno da lib/rapportini/calcolo.ts. Quando
// presente e con `lavoroMinuti + viaggioMinuti > 0`, guida `calcolaCorretti`
// al posto del marcatempo per quel giorno (vedi sotto).
export type RiepilogoRapportino = {
  lavoroMinuti: number
  viaggioMinuti: number
  pernottamento: boolean
}

export type OreSplit = {
  ordinario: number
  straordinarioLavoro: number
  straordinarioViaggio: number
  totale: number
}

/**
 * Split ordinario/straordinario. Il LAVORO riempie per primo la capacità
 * ordinaria (`minutiOrdinari`), il VIAGGIO riempie quanto resta della
 * capacità; oltre, ciascuno genera straordinario della propria categoria
 * (pagate separatamente). Con `viaggioMinuti = 0` (ogni giorno senza
 * rapportino) coincide esattamente con la vecchia formula
 * `Math.min`/`Math.max` su `minutiOrdinari` — nessuna divergenza per chi non
 * ha rapportini. Esempi: 8h lavoro + 2h viaggio → 8 ordinario + 2 straord.
 * viaggio; 6h lavoro + 2h viaggio → 8 ordinario; 10h lavoro + 1h viaggio → 8
 * ordinario + 2 straord. lavoro + 1 straord. viaggio.
 */
export function calcolaOreSplit(
  lavoroMinuti: number,
  viaggioMinuti: number,
  minutiOrdinari: number
): OreSplit {
  const ordinarioLavoro = Math.min(lavoroMinuti, minutiOrdinari)
  const straordinarioLavoro = Math.max(lavoroMinuti - minutiOrdinari, 0)
  const capacitaResidua = minutiOrdinari - ordinarioLavoro
  const ordinarioViaggio = Math.min(viaggioMinuti, capacitaResidua)
  const straordinarioViaggio = viaggioMinuti - ordinarioViaggio

  return {
    ordinario: ordinarioLavoro + ordinarioViaggio,
    straordinarioLavoro,
    straordinarioViaggio,
    totale: lavoroMinuti + viaggioMinuti,
  }
}

export type OrarioRicostruito = {
  entrata1: string | null
  uscita1: string | null
  entrata2: string | null
  uscita2: string | null
}

/**
 * Ricostruisce entrata/uscita a partire dal totale di minuti (lavoro +
 * viaggio) del rapportino, riempiendo l'orario standard dal primo ingresso:
 * prima il mattino, poi il pomeriggio, oltre estende l'uscita serale (unico
 * modo di rappresentare lo straordinario con soli 4 slot). Non inventa mai
 * un'entrata prima di `primoIngresso`.
 *
 * È il caso "al buio": nessuna timbratura a cui agganciarsi. Quando invece il
 * marcatempo ha lasciato un timbro, il giorno passa da
 * `costruisciOrarioAncorato`, che usa quello.
 */
export function costruisciOrario(
  totaleMinuti: number,
  orario: OrarioLavoroSettingsAdmin
): OrarioRicostruito {
  if (totaleMinuti <= 0) {
    return { entrata1: null, uscita1: null, entrata2: null, uscita2: null }
  }

  const inizioMattina = minutiDaOra(orario.primoIngresso)
  const fineMattina = minutiDaOra(orario.primaUscita)
  const inizioPomeriggio = minutiDaOra(orario.secondoIngresso)

  const capacitaMattina = Math.max(fineMattina - inizioMattina, 0)

  if (totaleMinuti <= capacitaMattina) {
    return {
      entrata1: orario.primoIngresso,
      uscita1: oraDaMinuti(inizioMattina + totaleMinuti),
      entrata2: null,
      uscita2: null,
    }
  }

  // Il resto occupa il pomeriggio da `secondoIngresso`: se `restante` supera
  // la capacità standard del pomeriggio, `uscita2` supera naturalmente
  // `secondaUscita` (è lo straordinario), senza bisogno di un clamp esplicito.
  const restante = totaleMinuti - capacitaMattina
  return {
    entrata1: orario.primoIngresso,
    uscita1: orario.primaUscita,
    entrata2: orario.secondoIngresso,
    uscita2: oraDaMinuti(inizioPomeriggio + restante),
  }
}

/**
 * Le timbrature REALI del giorno a cui ancorare l'orario ricostruito dal
 * rapportino, già arrotondate secondo le regole (minuti dall'inizio del
 * giorno). Sono i punti fermi: il rapportino dice QUANTE ore, il marcatempo
 * dice QUANDO.
 */
export type AncoreGiornata = {
  /** Entrata del mattino: l'ancora di inizio. */
  inizio: number | null
  /** Ultima uscita: `uscita2`, o `uscita1` sulle mezze giornate. */
  fine: number | null
  /**
   * `fine` è l'uscita SERALE (`uscita2`), non un'uscita di mezzogiorno. Solo
   * un'uscita serale può reggere da sola la giornata: vedi
   * `costruisciOrarioAncorato`.
   */
  fineSerale: boolean
  /** Uscita per il pranzo, solo se la giornata ha anche un rientro. */
  pranzo: number | null
}

/** Le ancore di una giornata grezza, con gli stessi arrotondamenti degli slot "timbrata". */
export function ancoreGiornata(
  g: Giornata,
  regole: CalcoloSettingsAdmin
): AncoreGiornata {
  const E = (o: string | null) =>
    o ? minutiDaOra(arrotondaEntrata(o, regole)) : null
  const U = (o: string | null) =>
    o ? minutiDaOra(arrotondaUscita(o, regole)) : null

  return {
    inizio: E(g.entrata1),
    fine: U(g.uscita2) ?? U(g.uscita1),
    fineSerale: g.uscita2 != null,
    // Serve come inizio della pausa: ha senso solo se il giorno prosegue nel
    // pomeriggio, altrimenti `uscita1` È la fine della giornata (ed è già in
    // `fine`).
    pranzo: g.uscita2 ? U(g.uscita1) : null,
  }
}

function turnoUnico(da: number, a: number): OrarioRicostruito {
  return {
    entrata1: oraDaMinuti(da),
    uscita1: oraDaMinuti(a),
    entrata2: null,
    uscita2: null,
  }
}

/**
 * Come `costruisciOrario`, ma ANCORATO alle timbrature reali del giorno: le ore
 * del rapportino vengono spalmate sugli orari davvero timbrati, così che prima
 * entrata e ultima uscita coincidano con il marcatempo invece di ricadere
 * sull'orario standard di tutti. Il totale resta per costruzione uguale a
 * `totaleMinuti` in ogni ramo: cambia la giornata rappresentata, mai le ore.
 *
 * Quattro casi, nell'ordine:
 *
 * - **A** — entrambe le ancore e le ore ci stanno dentro: la differenza fra lo
 *   span timbrato e le ore del rapportino È la pausa pranzo. Sui dati reali
 *   (giugno-luglio 2026, 177 giorni con entrambi gli estremi) sta fra 0 e 120'
 *   nel 98,9% dei casi, mediana 75': è una pausa plausibile, non un residuo.
 * - **C** — regge l'uscita serale: si riempie ALL'INDIETRO da `fine`. Copre il
 *   timbro del mattino dimenticato e i giorni in cui le ore dichiarate non
 *   entrano nella finestra timbrata.
 * - **B** — regge l'entrata: si riempie in AVANTI da `inizio`, come faceva
 *   l'orario standard ma dal timbro vero.
 * - **D** — nessuna timbratura: non c'è niente a cui ancorarsi, si ricade su
 *   `costruisciOrario` e sull'orario standard.
 */
export function costruisciOrarioAncorato(
  totaleMinuti: number,
  orario: OrarioLavoroSettingsAdmin,
  ancore: AncoreGiornata
): OrarioRicostruito {
  if (totaleMinuti <= 0) {
    return { entrata1: null, uscita1: null, entrata2: null, uscita2: null }
  }

  const { inizio, fine } = ancore
  // Fine del mattino: la pausa parte da lì. Il timbro reale quando c'è (così
  // su una giornata con tutti e 4 i colpi tre slot su quattro restano quelli
  // veri), altrimenti l'orario standard.
  const fineMattina = ancore.pranzo ?? minutiDaOra(orario.primaUscita)
  const inizioPomeriggio = minutiDaOra(orario.secondoIngresso)

  // A. Due ancore e le ore ci stanno: la pausa assorbe la differenza.
  if (inizio != null && fine != null && fine - inizio >= totaleMinuti) {
    const pausa = fine - inizio - totaleMinuti
    if (pausa === 0) return turnoUnico(inizio, fine)
    // Stessa guardia di monotonia del completamento della pausa: la sequenza
    // risultante deve essere entrata1 < uscita1 < entrata2 < uscita2.
    if (inizio < fineMattina && fineMattina + pausa < fine) {
      return {
        entrata1: oraDaMinuti(inizio),
        uscita1: oraDaMinuti(fineMattina),
        entrata2: oraDaMinuti(fineMattina + pausa),
        uscita2: oraDaMinuti(fine),
      }
    }
    // La giornata non attraversa la fascia della pausa (es. tutta di
    // pomeriggio): un turno solo, ancorato all'inizio. È l'unico ramo in cui
    // una delle due ancore cede.
    return turnoUnico(inizio, inizio + totaleMinuti)
  }

  // Da qui in poi una sola ancora può reggere: le ore non entrano nella
  // finestra timbrata, oppure un estremo non è stato timbrato. Regge l'USCITA
  // se è quella serale — mostrare ore DOPO l'ultimo timbro è esattamente il
  // difetto che stiamo correggendo, mentre chi ha lavorato prima di timbrare è
  // plausibile (il timbro del mattino dimenticato è il caso reale più
  // frequente). Un'uscita di mezzogiorno invece non è la fine della giornata:
  // lì regge l'entrata.
  const reggeUscita = fine != null && (inizio == null || ancore.fineSerale)

  // C. Si riempie ALL'INDIETRO dall'uscita: prima il pomeriggio, il resto in
  // coda al mattino.
  if (reggeUscita && fine != null) {
    const capacitaPomeriggio = fine - inizioPomeriggio
    if (totaleMinuti <= capacitaPomeriggio || capacitaPomeriggio <= 0) {
      return turnoUnico(fine - totaleMinuti, fine)
    }
    const entrata = fineMattina - (totaleMinuti - capacitaPomeriggio)
    // Ore talmente tante da far arretrare l'entrata prima di mezzanotte:
    // `oraDaMinuti` non gestisce i negativi e un orario all'indietro sarebbe
    // peggio del dato standard. Si prova con l'altra ancora, poi si rinuncia.
    if (entrata >= 0) {
      return {
        entrata1: oraDaMinuti(entrata),
        uscita1: oraDaMinuti(fineMattina),
        entrata2: oraDaMinuti(inizioPomeriggio),
        uscita2: oraDaMinuti(fine),
      }
    }
  }

  // B. Si riempie IN AVANTI dall'entrata: mattino fino alla pausa, il resto dal
  // secondo ingresso in poi (come l'orario standard, ma dal timbro vero).
  if (inizio != null) {
    const capacitaMattina = fineMattina - inizio
    if (totaleMinuti <= capacitaMattina || capacitaMattina <= 0) {
      return turnoUnico(inizio, inizio + totaleMinuti)
    }
    return {
      entrata1: oraDaMinuti(inizio),
      uscita1: oraDaMinuti(fineMattina),
      entrata2: oraDaMinuti(inizioPomeriggio),
      uscita2: oraDaMinuti(inizioPomeriggio + totaleMinuti - capacitaMattina),
    }
  }

  // D. Niente a cui ancorarsi.
  return costruisciOrario(totaleMinuti, orario)
}

// Provenienza di uno slot corretto: la garanzia di onestà del sistema — la UI
// distingue un timbro vero da uno ricostruito.
export type ProvenienzaSlot =
  | "timbrata" // dal dato reale del marcatempo (arrotondato)
  | "corretta" // valore inserito a mano dall'admin
  | "ricostruita" // pausa ricostruita dall'orario standard
  | "rapportino" // orario ricostruito dal totale ore del rapportino
  | "assente" // nessun valore

export type Anomalia =
  | "entrata_mancante"
  | "uscita_mancante"
  | "turno_incompleto"
  | "timbratura_sospetta"
  | "durata_eccessiva"
  | "assente"
  // Giorno feriale già trascorso, dipendente soggetto all'obbligo, nessun
  // rapportino registrato. A differenza delle altre, NON è calcolata qui
  // dentro (il motore resta un calcolo puro di orari, senza sapere quali
  // dipendenti richiedono il rapportino): la condizione vive in
  // lib/rapportini/calcolo.ts (`mancaRapportinoObbligatorio`) ed è unita
  // all'array `anomalie` lato UI, in timbrature-manager.tsx. Vedi
  // docs/calcolo-timbrature.md.
  | "rapportino_mancante"
  // Giorno determinabile automaticamente (nessuna anomalia dal solo
  // marcatempo, nessuna correzione manuale), con rapportino attivo, e
  // differenza fra i due totali oltre `sogliaScostamentoRapportino`. Stessa
  // eccezione di `rapportino_mancante`: non calcolata qui, vive in
  // lib/rapportini/calcolo.ts (`scostamentoRapportinoEccessivo`) e si unisce
  // in timbrature-manager.tsx.
  | "scostamento_rapportino"

// Valore corretto di un turno, con la sua provenienza:
// - stringa vuota nell'override = turno azzerato esplicitamente dalla
//   correzione (es. preset senza secondo turno): resta vuoto, NON ricade sul
//   fallback;
// - valore presente = quello corretto (as-is, non arrotondato);
// - assente/undefined = nessuna correzione: si usa il fallback così com'è
//   (già risolto dal chiamante fra marcatempo e rapportino).
function corretto(
  ov: string | null | undefined,
  fallback: { valore: string | null; origine: ProvenienzaSlot }
): { valore: string | null; origine: ProvenienzaSlot } {
  if (ov === "") return { valore: null, origine: "assente" }
  if (ov != null) return { valore: ov, origine: "corretta" }
  return fallback
}

export type GiornataCalcolata = {
  ce1: string | null
  cu1: string | null
  ce2: string | null
  cu2: string | null
  totale: number
  ordinario: number
  straordinario: number
  // Straordinario dovuto al viaggio (pagato separatamente da quello di
  // lavoro): resta sempre 0 sui giorni senza rapportino, per costruzione di
  // `calcolaOreSplit` con `viaggioMinuti = 0`.
  straordinarioViaggio: number
  // true se il rapportino del giorno segnala un pernotto. Indipendente dal
  // totale ore: un pernotto resta un fatto del giorno anche se, per qualche
  // motivo, le ore registrate sono zero.
  pernottamento: boolean
  provenienza: {
    e1: ProvenienzaSlot
    u1: ProvenienzaSlot
    e2: ProvenienzaSlot
    u2: ProvenienzaSlot
  }
  anomalie: Anomalia[]
}

/**
 * Applica overlay, completamento della pausa e ne deriva totale/anomalie.
 *
 * 1. Overlay a 3 livelli: `override` manuale > orario ricostruito dal
 *    `rapportino` (se presente e con ore > 0) > dato reale del marcatempo
 *    (arrotondato). Un rapportino "spiega" la giornata al posto del
 *    marcatempo, ma una correzione manuale resta comunque la fonte di verità
 *    più alta, sopra a qualunque fonte automatica. Il rapportino dice QUANTE
 *    ore, non QUANDO: con `ancoraRapportinoAlleTimbrature` (default) le sue
 *    ore vengono spalmate sugli orari davvero timbrati
 *    (`costruisciOrarioAncorato`) invece di ricadere sull'orario standard di
 *    tutti, così prima entrata e ultima uscita restano quelle vere.
 * 2. Completamento (se `pausaAutomatica`): SOLO se la giornata è chiusa ai due
 *    estremi (entrata mattutina + uscita serale) e lo span è sufficiente,
 *    ricostruisce la pausa con gli orari standard. Mai inventare entrata/uscita.
 *    Non richiede logica dedicata per i giorni guidati dal rapportino: il suo
 *    orario ricostruito è già una sequenza coerente (o nulla a coppie sulla
 *    mezza giornata), quindi la guardia esistente non interferisce.
 * 3. Anomalie: segnalate DOPO overlay+fill, così una correzione manuale (o un
 *    rapportino) che sistema il giorno lo fa sparire dalle anomalie senza
 *    codice extra.
 *
 * Sopra tutto questo sta il giustificativo di assenza (`giustificato`): se il
 * giorno è coperto da ferie/malattia/permesso non c'è nulla da ricostruire, e
 * la funzione esce subito con la giornata azzerata e senza anomalie.
 */
export function calcolaCorretti(
  g: Giornata,
  override: Record<string, string | null> | undefined,
  regole: CalcoloSettingsAdmin,
  orario: OrarioLavoroSettingsAdmin,
  rapportino?: RiepilogoRapportino,
  // Data di riferimento (YYYY-MM-DD, come `g.giorno`) usata per non segnalare
  // "assente" su giorni non ancora passati: default "oggi" reale, esplicito
  // solo nei test o quando il chiamante vuole garantire lo stesso istante di
  // un altro calcolo fatto nello stesso render (vedi timbrature-manager.tsx).
  oggi: string = format(new Date(), "yyyy-MM-dd"),
  // Il giorno è coperto da un giustificativo di assenza (ferie, malattia,
  // permesso 104, ...). Al motore basta il FATTO: la sigla è un dato di
  // presentazione (badge in pagina, banda nel PDF) e vive accanto agli orari
  // corretti, in TimbraturaCorretta.giustificativo.
  giustificato: boolean = false
): GiornataCalcolata {
  // 0. Giornata giustificata: non è una giornata di lavoro da ricostruire.
  // Azzera orari e ore come farebbe un preset vuoto — anche in presenza di
  // timbrature reali o di una correzione manuale, che restano salvate ma
  // inerti e tornano valide togliendo il giustificativo (l'overlay resta non
  // distruttivo) — e non segnala nulla: il giustificativo È la spiegazione
  // della giornata, quindi "assente" e compagnia non hanno più niente da dire.
  if (giustificato) {
    return {
      ce1: null,
      cu1: null,
      ce2: null,
      cu2: null,
      totale: 0,
      ordinario: 0,
      straordinario: 0,
      straordinarioViaggio: 0,
      // Il pernotto resta un fatto del giorno, indipendente dalle ore: stessa
      // regola del ritorno normale, in fondo alla funzione.
      pernottamento: rapportino?.pernottamento ?? false,
      // "assente" significa già "nessun valore": non serve una provenienza
      // dedicata per un dato che nessuno mostra (la UI legge gli orari, non da
      // dove vengono, quando sono nulli).
      provenienza: {
        e1: "assente",
        u1: "assente",
        e2: "assente",
        u2: "assente",
      },
      anomalie: [],
    }
  }

  const roundE = (o: string) => arrotondaEntrata(o, regole)
  const roundU = (o: string) => arrotondaUscita(o, regole)

  // Un rapportino guida il giorno solo se ha ore > 0: un rapportino
  // "vuoto" (es. solo spese, zero lavoro e viaggio) non spiega nulla e il
  // giorno ricade sul marcatempo come se non esistesse.
  const rap =
    rapportino && rapportino.lavoroMinuti + rapportino.viaggioMinuti > 0
      ? rapportino
      : null
  const oreRapportino = rap ? rap.lavoroMinuti + rap.viaggioMinuti : 0
  const daRapportino = rap
    ? regole.ancoraRapportinoAlleTimbrature
      ? costruisciOrarioAncorato(oreRapportino, orario, ancoreGiornata(g, regole))
      : costruisciOrario(oreRapportino, orario)
    : null

  function fallback(
    campo: keyof OrarioRicostruito,
    raw: string | null,
    round: (o: string) => string
  ): { valore: string | null; origine: ProvenienzaSlot } {
    if (daRapportino) {
      const v = daRapportino[campo]
      if (!v) return { valore: null, origine: "assente" }
      // Con l'ancoraggio uno slot ricostruito può COINCIDERE con il timbro
      // reale (è il punto della modifica): dichiararlo "rapportino" sarebbe
      // una bugia, il valore mostrato è esattamente quello del marcatempo.
      const origine = raw && round(raw) === v ? "timbrata" : "rapportino"
      return { valore: v, origine }
    }
    if (raw) return { valore: round(raw), origine: "timbrata" }
    return { valore: null, origine: "assente" }
  }

  // 1. Overlay (s1/s4 sono gli estremi, mai riscritti; s2/s3 possono essere
  // ricostruiti dal fill).
  const s1 = corretto(override?.entrata1, fallback("entrata1", g.entrata1, roundE))
  let s2 = corretto(override?.uscita1, fallback("uscita1", g.uscita1, roundU))
  let s3 = corretto(override?.entrata2, fallback("entrata2", g.entrata2, roundE))
  const s4 = corretto(override?.uscita2, fallback("uscita2", g.uscita2, roundU))

  // 2. Completamento della pausa pranzo. Scatta solo su giornata chiusa ai due
  // estremi (ce1 e cu2 presenti); riempie i mancanti fra cu1 (← primaUscita) e
  // ce2 (← secondoIngresso), mai gli estremi. Non tocca gli slot azzerati a mano.
  if (regole.pausaAutomatica && s1.valore != null && s4.valore != null) {
    const span = minutiDaOra(s4.valore) - minutiDaOra(s1.valore)
    if (span >= regole.pausaSpanMinimo) {
      const fillU1 = s2.valore == null && override?.uscita1 !== ""
      const fillE2 = s3.valore == null && override?.entrata2 !== ""
      const nu1 = fillU1 ? orario.primaUscita : s2.valore
      const ne2 = fillE2 ? orario.secondoIngresso : s3.valore

      // Guardia di monotonia: la sequenza risultante deve essere ce1<cu1<ce2<cu2,
      // altrimenti niente fill (es. entrato alle 15: non ricostruire una pausa
      // alle 12:30) e il giorno resta un'anomalia.
      const monotona =
        nu1 != null &&
        ne2 != null &&
        minutiDaOra(s1.valore) < minutiDaOra(nu1) &&
        minutiDaOra(nu1) < minutiDaOra(ne2) &&
        minutiDaOra(ne2) < minutiDaOra(s4.valore)

      if (monotona) {
        if (fillU1) s2 = { valore: orario.primaUscita, origine: "ricostruita" }
        if (fillE2) s3 = { valore: orario.secondoIngresso, origine: "ricostruita" }
      }
    }
  }

  const ce1 = s1.valore
  const cu1 = s2.valore
  const ce2 = s3.valore
  const cu2 = s4.valore

  const minuti =
    (ce1 && cu1 ? minutiDaOra(cu1) - minutiDaOra(ce1) : 0) +
    (ce2 && cu2 ? minutiDaOra(cu2) - minutiDaOra(ce2) : 0)

  // 3. Anomalie — segnalano i giorni DA RIVEDERE. Le anomalie derivate dai
  // valori correnti (entrata/uscita mancante, turno incompleto) spariscono da
  // sole quando una correzione sistema il giorno, perché rileggono ce1..cu2.
  // Quelle legate al dato GREZZO (timbratura sospetta, assente) non guardano i
  // corretti: le silenziamo se il giorno è già spiegato — a mano
  // (`correttoManualmente`) o da un rapportino (`rap`) — una volta rivisto o
  // spiegato, non è più «da verificare».
  const correttoManualmente =
    override != null && Object.keys(override).length > 0
  const giornoSpiegato = correttoManualmente || rap != null
  const anomalie: Anomalia[] = []
  if (g.nTimbrature === 0) {
    // Giorno feriale senza alcuna timbratura; mai nel weekend, non se già
    // spiegato (a mano o da rapportino), e non se il giorno non è ancora
    // trascorso (da oggi in avanti): non è "assente", semplicemente non è
    // ancora accaduto — oggi stesso incluso, la giornata potrebbe non essere
    // conclusa.
    if (!isWeekend(g.giornoSettimana) && !giornoSpiegato && g.giorno < oggi)
      anomalie.push("assente")
  } else if (ce1 == null && ce2 == null) {
    anomalie.push("entrata_mancante")
  } else if (cu1 == null && cu2 == null) {
    anomalie.push("uscita_mancante")
  } else if (!!ce1 !== !!cu1 || !!ce2 !== !!cu2) {
    // Dopo il fill un turno ha un solo estremo.
    anomalie.push("turno_incompleto")
  }
  if (g.haSentinella0000 && !giornoSpiegato) anomalie.push("timbratura_sospetta")
  if (minuti > regole.oreMassimeGiorno) anomalie.push("durata_eccessiva")

  // Split ordinario/straordinario sempre tramite calcolaOreSplit. Con un
  // rapportino attivo E NESSUNA correzione manuale usa le sue ore di
  // lavoro/viaggio; altrimenti i minuti ricavati dagli orari corretti finali
  // come "lavoro" puro (viaggio = 0) — sia sui giorni senza rapportino, sia
  // su un giorno guidato dal rapportino ma poi corretto a mano: una volta
  // che l'admin tocca un orario, `minuti` (che rilegge SEMPRE ce1..cu2) è la
  // sola fonte di verità del totale, altrimenti la correzione manuale
  // cambierebbe l'orario mostrato senza mai spostare ordinario/straordinario
  // (il bug che ha segnalato l'admin: "corretto ma non ricalcola"). Perdere
  // la categoria lavoro/viaggio del rapportino su un giorno corretto a mano è
  // il prezzo accettato: l'admin ha scritto un orario, non delle ore di
  // lavoro/viaggio, quindi non c'è più nulla da cui derivarla.
  const usaSplitRapportino = rap != null && !correttoManualmente
  const split = calcolaOreSplit(
    usaSplitRapportino ? rap.lavoroMinuti : minuti,
    usaSplitRapportino ? rap.viaggioMinuti : 0,
    regole.minutiOrdinari
  )

  return {
    ce1,
    cu1,
    ce2,
    cu2,
    totale: split.totale,
    ordinario: split.ordinario,
    straordinario: split.straordinarioLavoro,
    straordinarioViaggio: split.straordinarioViaggio,
    pernottamento: rapportino?.pernottamento ?? false,
    provenienza: {
      e1: s1.origine,
      u1: s2.origine,
      e2: s3.origine,
      u2: s4.origine,
    },
    anomalie,
  }
}

/** Somma dei minuti di tutte le giornate del mese. */
export function calcolaTotaliMese(righe: GiornataCalcolata[]) {
  return {
    totale: righe.reduce((s, r) => s + r.totale, 0),
    ordinario: righe.reduce((s, r) => s + r.ordinario, 0),
    straordinario: righe.reduce((s, r) => s + r.straordinario, 0),
    straordinarioViaggio: righe.reduce((s, r) => s + r.straordinarioViaggio, 0),
    giorniTrasferta: righe.filter((r) => r.pernottamento).length,
  }
}

/** Sabato o domenica, dal giorno della settimana di una `Giornata` (0=dom, 6=sab). */
export function isWeekend(giornoSettimana: number): boolean {
  return giornoSettimana === 0 || giornoSettimana === 6
}
