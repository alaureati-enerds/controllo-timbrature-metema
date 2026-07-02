import mysql from "mysql2/promise"

import { getResolvedMySqlConfig } from "@/lib/settings/mysql"

export async function createMySqlConnection() {
  const config = await getResolvedMySqlConfig()

  if (!config.host || !config.database) {
    throw new Error(
      "Connessione MySQL non configurata: imposta host e database nelle impostazioni di sistema."
    )
  }

  return mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
  })
}
