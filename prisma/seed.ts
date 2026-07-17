import { auth } from "@/lib/auth"
import { env } from "@/lib/env"
import { categoryOf } from "@/lib/notifications/catalog"
import { prisma } from "@/lib/prisma"
import { systemSettingsSchema } from "@/lib/settings/schema"

// Bootstrap degli account iniziali: al PRIMO avvio (database senza utenti) crea
// un admin (per le aree riservate) e un utente normale (per provare l'app senza
// privilegi). Le credenziali arrivano dalle variabili d'ambiente (SEED_ADMIN_*
// e SEED_USER_*). Vedi main() per la condizione di "database vuoto".
//
// Importante: NON è un seed che gira a ogni avvio ricreando gli account. Se lo
// fosse, un utente eliminato dall'admin tornerebbe al riavvio successivo. Perciò
// gli account si seminano solo quando non esiste ancora alcun utente: dopo il
// primo avvio le eliminazioni restano.
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

// Notifiche di esempio per un utente, così la campanella e la pagina /notifications
// hanno qualcosa da mostrare senza dover prima scatenare eventi reali. Idempotente:
// se l'utente ha già notifiche, non aggiunge nulla. Le righe si creano direttamente
// (non via notify()) per poter variare data e stato letto/non letto a scopo demo.
async function seedNotifications(email: string) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return

  const existing = await prisma.notification.count({ where: { userId: user.id } })
  if (existing > 0) {
    console.log(`✔ Notifiche già presenti per ${email}, nessuna azione.`)
    return
  }

  const hour = 60 * 60 * 1000
  const now = Date.now()
  // ageH = quante ore fa; read = se già letta.
  const samples = [
    {
      type: "auth.login.new_device",
      title: "Nuovo accesso al tuo account",
      body: "Rilevato un accesso da un dispositivo non riconosciuto. Se non sei stato tu, cambia subito la password.",
      ageH: 1,
      read: false,
    },
    {
      type: "account.password.change",
      title: "Password modificata",
      body: "La password del tuo account è stata cambiata. Se non sei stato tu, reimpostala subito.",
      ageH: 26,
      read: false,
    },
    {
      type: "account.2fa.enable",
      title: "Verifica in due passaggi attivata",
      body: "Hai attivato la verifica in due passaggi (2FA) sul tuo account.",
      ageH: 52,
      read: true,
    },
    {
      type: "account.email.change",
      title: "Email modificata",
      body: "L'indirizzo email del tuo account è stato modificato.",
      ageH: 100,
      read: true,
    },
  ]

  await prisma.notification.createMany({
    data: samples.map((s) => ({
      userId: user.id,
      type: s.type,
      category: categoryOf(s.type),
      title: s.title,
      body: s.body,
      data: { url: "/profile" },
      createdAt: new Date(now - s.ageH * hour),
      readAt: s.read ? new Date(now - s.ageH * hour + 30 * 60 * 1000) : null,
    })),
  })

  console.log(`✔ Create ${samples.length} notifiche di esempio per ${email}.`)
}

async function main() {
  await seedSystemSettings()

  // Gli account (e le notifiche demo) si creano SOLO su un database vuoto, cioè
  // al primo avvio. Con almeno un utente presente il seed non tocca più gli
  // account: così un utente eliminato dall'admin non ricompare al riavvio. Se
  // il DB viene svuotato del tutto, admin e utente vengono ripristinati come
  // rete di sicurezza (non resti mai senza un admin per accedere).
  const userCount = await prisma.user.count()
  if (userCount > 0) {
    console.log(
      `✔ Database già inizializzato (${userCount} utenti): salto il bootstrap degli account.`,
    )
    return
  }

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

  await seedNotifications(env.SEED_ADMIN_EMAIL)
  await seedNotifications(env.SEED_USER_EMAIL)
}

main()
  .catch((e) => {
    console.error("✖ Seed fallito:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
