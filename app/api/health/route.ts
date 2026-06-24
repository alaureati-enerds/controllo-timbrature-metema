// Smoke test: verifica rapida che il backend risponda. GET /api/health
export async function GET() {
  return Response.json({ status: "ok" })
}
