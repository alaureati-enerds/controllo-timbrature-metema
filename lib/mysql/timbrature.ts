import mysql from "mysql2/promise"

import { getResolvedMySqlConfig } from "@/lib/settings/mysql"

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

export type Dipendente = {
  codice: string
  descrizione: string
}

export async function listDipendenti(): Promise<Dipendente[]> {
  const c = await conn()
  try {
    const [rows] = await c.execute<
      mysql.RowDataPacket[]
    >("SELECT CODICE, DESCRIZIONE FROM dip WHERE obs != 'si' ORDER BY DESCRIZIONE")
    return (rows as { CODICE: string; DESCRIZIONE: string }[]).map((r) => ({
      codice: r.CODICE,
      descrizione: r.DESCRIZIONE ?? "",
    }))
  } finally {
    await c.end().catch(() => {})
  }
}

/** Un singolo dipendente per codice (null se non esiste o è obsoleto). */
export async function getDipendente(codice: string): Promise<Dipendente | null> {
  const c = await conn()
  try {
    const [rows] = await c.execute<mysql.RowDataPacket[]>(
      "SELECT CODICE, DESCRIZIONE FROM dip WHERE CODICE = ? LIMIT 1",
      [codice]
    )
    const r = (rows as { CODICE: string; DESCRIZIONE: string }[])[0]
    return r ? { codice: r.CODICE, descrizione: r.DESCRIZIONE ?? "" } : null
  } finally {
    await c.end().catch(() => {})
  }
}

export type Timbratura = {
  data: string // YYYY-MM-DD
  ora: string // HH:mm:ss
  tipologia: "E" | "U"
}

export async function getPresenze(
  codiceDip: string,
  dal: string,
  al: string
): Promise<Timbratura[]> {
  const c = await conn()
  try {
    const [rows] = await c.execute<mysql.RowDataPacket[]>(
      "SELECT DATA, TIMBRATURA, TIPOLOGIA FROM presenze WHERE CODICE_DIP = ? AND DATA BETWEEN ? AND ? ORDER BY DATA, TIMBRATURA",
      [codiceDip, dal, al]
    )
    return (rows as { DATA: string; TIMBRATURA: string; TIPOLOGIA: string }[]).map(
      (r) => ({
        data: formatMysqlDate(r.DATA),
        ora: formatMysqlTime(r.TIMBRATURA),
        tipologia: r.TIPOLOGIA === "U" ? "U" : "E",
      })
    )
  } finally {
    await c.end().catch(() => {})
  }
}

export function formatMysqlDate(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10)
  return d.toISOString().slice(0, 10)
}

export function formatMysqlTime(t: Date | string): string {
  if (typeof t === "string") return t.slice(0, 8)
  return t.toISOString().slice(11, 19)
}
