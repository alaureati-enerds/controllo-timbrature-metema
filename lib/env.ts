import { z } from "zod"

// Valida le variabili d'ambiente all'avvio (fail-fast): se manca o è errata una
// variabile critica, l'app si ferma subito con un messaggio chiaro invece di
// rompersi più avanti in modo oscuro. Importare questo modulo dal codice server.
const envSchema = z.object({
  // Connessione al database (usata da Prisma, vedi lib/prisma.ts)
  DATABASE_URL: z.string().url(),

  // Segreto usato da Better Auth per firmare cookie e token. In produzione deve
  // essere una stringa casuale robusta (es. `openssl rand -base64 32`).
  BETTER_AUTH_SECRET: z.string().min(1),
  // URL base dell'app, usato da Better Auth per costruire i link (es. verifica).
  // In PRODUZIONE è obbligatorio. In SVILUPPO lascialo vuoto: Better Auth
  // inferisce automaticamente l'host dalla richiesta, così i link usano la porta
  // reale del dev server (3000/3001/...) invece di una porta fissa.
  BETTER_AUTH_URL: z.string().url().optional(),

  // Credenziali dell'admin iniziale create da prisma/seed.ts (idempotente).
  SEED_ADMIN_EMAIL: z.string().email().default("admin@example.com"),
  SEED_ADMIN_PASSWORD: z.string().min(8).default("changeme123"),
  SEED_ADMIN_NAME: z.string().min(1).default("Admin"),

  // Utente "normale" (ruolo user) creato dal seed, utile per provare l'app
  // dal punto di vista di un account senza privilegi.
  SEED_USER_EMAIL: z.string().email().default("user@example.com"),
  SEED_USER_PASSWORD: z.string().min(8).default("changeme123"),
  SEED_USER_NAME: z.string().min(1).default("Utente"),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  // Messaggio leggibile con l'elenco delle variabili mancanti/errate.
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n")
  throw new Error(
    `Variabili d'ambiente non valide o mancanti:\n${issues}\n` +
      `Controlla il file .env (vedi .env.example).`
  )
}

export const env = parsed.data
