import mysql from "mysql2/promise"

import { getResolvedMySqlConfig } from "@/lib/settings/mysql"

// Lettura dei RAPPORTINI di assistenza tecnica dal MySQL aziendale (stessa
// tabella `cmd` del gestionale, sola lettura). Query e filtro
// (`documento_origine <> 'assistenza tecnica'`) forniti dall'utente e
// verificati sul DB reale: `DIP_CODICE` combacia con `dip.CODICE` (vedi
// lib/mysql/timbrature.ts), un giorno può avere più righe da sommare.

async function conn() {
  const config = await getResolvedMySqlConfig()
  if (!config.host || !config.database) {
    throw new Error("MySQL non configurato")
  }
  return mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    dateStrings: true,
  })
}

export type RapportinoRiga = {
  progressivo: number
  cmsCodice: string
  tipologia: string | null
  descrizione: string
  giorno: string // YYYY-MM-DD (data_competenza, o DATA_REGISTRAZIONE se assente)
  oreLavorazione: number
  minutiLavorazione: number
  oreViaggio: number
  minutiViaggio: number
  ore: number
  minuti: number
  costoOrario: number
  costoTotale: number
  importoVitto: number
  importoAlloggio: number
  kilometri: number
  rimborsoChilometrico: number
  targaAutomezzo: string
  pernottamento: boolean
  guidatoDalle: string | null
  guidatoAlle: string | null
  giornoFestivo: boolean
  vitto: boolean
}

type RapportinoRow = {
  PROGRESSIVO: number
  CMS_CODICE: string | null
  TIPOLOGIA: string | null
  DESCRIZIONE: string | null
  DATA: string
  orelavorazione: number
  minutilavorazione: number
  oreviaggio: number
  minutiviaggio: number
  ORE: number
  MINUTI: number
  COSTO_ORARIO: string | number
  COSTO_TOTALE: string | number
  IMPORTO_VITTO: string | number
  IMPORTO_ALLOGGIO: string | number
  KILOMETRI: string | number
  RIMBORSO_CHILOMETRICO: string | number
  targa_automezzo: string | null
  pernottamento: string | null
  guidatodalle: string | null
  guidatoalle: string | null
  GIORNO_FESTIVO: string | null
  VITTO: string | null
}

export async function getRapportini(
  codiceDip: string,
  dal: string,
  al: string
): Promise<RapportinoRiga[]> {
  const c = await conn()
  try {
    const [rows] = await c.execute<mysql.RowDataPacket[]>(
      `SELECT
          PROGRESSIVO,
          CMS_CODICE,
          TIPOLOGIA,
          DESCRIZIONE,
          DATE_FORMAT(COALESCE(data_competenza, DATA_REGISTRAZIONE), '%Y-%m-%d') AS DATA,
          orelavorazione,
          minutilavorazione,
          oreviaggio,
          minutiviaggio,
          ORE,
          MINUTI,
          COSTO_ORARIO,
          COSTO_TOTALE,
          IMPORTO_VITTO,
          IMPORTO_ALLOGGIO,
          KILOMETRI,
          RIMBORSO_CHILOMETRICO,
          targa_automezzo,
          pernottamento,
          guidatodalle,
          guidatoalle,
          GIORNO_FESTIVO,
          VITTO
       FROM cmd
       WHERE DIP_CODICE = ?
         AND documento_origine <> 'assistenza tecnica'
         AND COALESCE(data_competenza, DATA_REGISTRAZIONE) BETWEEN ? AND ?
       ORDER BY COALESCE(data_competenza, DATA_REGISTRAZIONE) DESC, PROGRESSIVO DESC`,
      [codiceDip, dal, al]
    )
    return (rows as RapportinoRow[]).map((r) => ({
      progressivo: r.PROGRESSIVO,
      cmsCodice: r.CMS_CODICE ?? "",
      tipologia: r.TIPOLOGIA,
      descrizione: r.DESCRIZIONE ?? "",
      giorno: r.DATA,
      oreLavorazione: r.orelavorazione ?? 0,
      minutiLavorazione: r.minutilavorazione ?? 0,
      oreViaggio: r.oreviaggio ?? 0,
      minutiViaggio: r.minutiviaggio ?? 0,
      ore: r.ORE ?? 0,
      minuti: r.MINUTI ?? 0,
      costoOrario: Number(r.COSTO_ORARIO) || 0,
      costoTotale: Number(r.COSTO_TOTALE) || 0,
      importoVitto: Number(r.IMPORTO_VITTO) || 0,
      importoAlloggio: Number(r.IMPORTO_ALLOGGIO) || 0,
      kilometri: Number(r.KILOMETRI) || 0,
      rimborsoChilometrico: Number(r.RIMBORSO_CHILOMETRICO) || 0,
      targaAutomezzo: r.targa_automezzo ?? "",
      pernottamento: r.pernottamento === "si",
      guidatoDalle: r.guidatodalle,
      guidatoAlle: r.guidatoalle,
      giornoFestivo: r.GIORNO_FESTIVO === "si",
      vitto: r.VITTO === "si",
    }))
  } finally {
    await c.end().catch(() => {})
  }
}
