// Logger minimale e strutturato. Centralizza l'output così da poterlo in futuro
// sostituire con un logger vero (pino/winston) o inviarlo a un servizio esterno
// senza toccare i call site. Per ora scrive su console in formato leggibile.
type LogLevel = "info" | "warn" | "error"

function log(level: LogLevel, message: string, meta?: unknown) {
  const time = new Date().toISOString()
  const prefix = `[${time}] ${level.toUpperCase()}`
  if (meta !== undefined) {
    console[level](`${prefix} ${message}`, meta)
  } else {
    console[level](`${prefix} ${message}`)
  }
}

export const logger = {
  info: (message: string, meta?: unknown) => log("info", message, meta),
  warn: (message: string, meta?: unknown) => log("warn", message, meta),
  error: (message: string, meta?: unknown) => log("error", message, meta),
}
