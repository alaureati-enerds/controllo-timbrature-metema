import { ApiError, forbidden, ok, safeHandler, unauthorized } from "@/lib/api"
import { getSession } from "@/lib/auth-helpers"
import { prisma } from "@/lib/prisma"

// `user.role` può contenere più ruoli separati da virgola.
function isAdminRole(role?: string | null): boolean {
  return (role ?? "")
    .split(",")
    .map((r) => r.trim())
    .includes("admin")
}

// POST /api/admin/users/[id]/reset-2fa
// Recupero da lockout: azzera la 2FA di un utente (procedura help desk). Better
// Auth non espone un'azione admin nativa per questo, quindi rimuoviamo la riga
// `TwoFactor` e azzeriamo `twoFactorEnabled` direttamente via Prisma. L'utente
// potrà riconfigurare la 2FA dal proprio profilo. Riservato agli admin.
export const POST = safeHandler(async (_request, context) => {
  const session = await getSession()
  if (!session) throw unauthorized()
  if (!isAdminRole(session.user.role)) throw forbidden()

  const { id } = await (context as { params: Promise<{ id: string }> }).params

  // Un admin gestisce la propria 2FA dal profilo (self-service), non da qui.
  if (id === session.user.id) {
    throw new ApiError(
      "Gestisci la tua 2FA dalla pagina del profilo, non da qui",
      400
    )
  }

  await prisma.$transaction([
    prisma.twoFactor.deleteMany({ where: { userId: id } }),
    prisma.user.update({
      where: { id },
      data: { twoFactorEnabled: false },
    }),
  ])

  return ok({ success: true })
})
