import { auth } from "@/lib/auth"
import { env } from "@/lib/env"
import { prisma } from "@/lib/prisma"
import { systemSettingsSchema } from "@/lib/settings/schema"

// Seed idempotente: garantisce l'esistenza di alcuni account iniziali, così al
// primo avvio c'è sempre un admin (per le aree riservate) e un utente normale
// (per provare l'app senza privilegi). Le credenziali arrivano dalle variabili
// d'ambiente (SEED_ADMIN_* e SEED_USER_*).
//
// La creazione passa per l'API di Better Auth (signUpEmail) così la password
// viene hashata esattamente come per le registrazioni normali; poi impostiamo il
// ruolo e marchiamo l'email come verificata via Prisma.
async function seedUser(opts: {
  email: string
  password: string
  name: string
  role: string
}) {
  const existing = await prisma.user.findUnique({ where: { email: opts.email } })
  if (existing) {
    console.log(`✔ Utente già presente (${opts.email}), nessuna azione.`)
    return
  }

  await auth.api.signUpEmail({
    body: { email: opts.email, password: opts.password, name: opts.name },
  })

  await prisma.user.update({
    where: { email: opts.email },
    data: { role: opts.role, emailVerified: true },
  })

  console.log(`✔ Creato ${opts.role}: ${opts.email}`)
}

// Garantisce la riga singleton delle impostazioni di sistema con i valori di
// default. Non sovrascrive una configurazione già presente (idempotente): se la
// riga manca usa i default dello schema Zod.
async function seedSystemSettings() {
  const existing = await prisma.systemSetting.findUnique({ where: { id: 1 } })
  if (existing) {
    console.log("✔ Impostazioni di sistema già presenti, nessuna azione.")
    return
  }

  await prisma.systemSetting.create({
    data: { id: 1, data: systemSettingsSchema.parse({}) },
  })
  console.log("✔ Create impostazioni di sistema con i valori di default.")
}

async function main() {
  await seedSystemSettings()

  await seedUser({
    email: env.SEED_ADMIN_EMAIL,
    password: env.SEED_ADMIN_PASSWORD,
    name: env.SEED_ADMIN_NAME,
    role: "admin",
  })

  await seedUser({
    email: env.SEED_USER_EMAIL,
    password: env.SEED_USER_PASSWORD,
    name: env.SEED_USER_NAME,
    role: "user",
  })
}

main()
  .catch((e) => {
    console.error("✖ Seed fallito:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
