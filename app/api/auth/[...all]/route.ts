import { toNextJsHandler } from "better-auth/next-js"

import { auth } from "@/lib/auth"

// Espone tutti gli endpoint di Better Auth sotto /api/auth/* (login, signup,
// logout, verifica email, reset password, azioni admin, ...).
export const { GET, POST } = toNextJsHandler(auth.handler)
