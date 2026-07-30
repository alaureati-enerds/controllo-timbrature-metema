import { Readable } from "node:stream"
import { ZipArchive } from "archiver"
import { z } from "zod"

import { fail, parseJson, safeHandler } from "@/lib/api"
import { requireTimbraturePermission } from "@/lib/timbrature/authz"
import {
  findManyStampeStorico,
  getStampaStoricoStream,
} from "@/lib/timbrature/stampe-storico"

// POST /api/admin/timbrature/stampe/zip — scarica più stampe selezionate
// dallo storico in un unico archivio ZIP. È sola lettura (nessuna riga viene
// toccata): richiede `timbrature.read`, come il download di una singola
// stampa. Il body è un POST (non query string) perché la selezione può
// contenere molti id.

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
})

/**
 * Nomi univoci dentro lo ZIP: se due stampe selezionate hanno lo stesso
 * `originalName` (es. la stessa stampa rigenerata due volte), la seconda
 * diventa "nome (2).pdf" invece di sovrascrivere la prima nell'archivio.
 */
function nomeUnivoco(nome: string, usati: Set<string>): string {
  if (!usati.has(nome)) {
    usati.add(nome)
    return nome
  }
  const punto = nome.lastIndexOf(".")
  const base = punto === -1 ? nome : nome.slice(0, punto)
  const ext = punto === -1 ? "" : nome.slice(punto)
  let i = 2
  let candidato = `${base} (${i})${ext}`
  while (usati.has(candidato)) {
    i++
    candidato = `${base} (${i})${ext}`
  }
  usati.add(candidato)
  return candidato
}

// POST /api/admin/timbrature/stampe/zip — body { ids: string[] }
export const POST = safeHandler(async (request) => {
  await requireTimbraturePermission("read")
  const { ids } = await parseJson(request, bodySchema)

  const files = await findManyStampeStorico(ids)
  if (files.length === 0) return fail("Nessuna stampa trovata", 404)

  const archive = new ZipArchive({ zlib: { level: 9 } })
  const usati = new Set<string>()
  for (const file of files) {
    const stream = await getStampaStoricoStream(file)
    archive.append(stream, { name: nomeUnivoco(file.originalName, usati) })
  }
  // Non si attende: l'archivio si chiude mentre il body della Response viene
  // consumato in streaming dal client (stesso pattern di pipe verso una res).
  void archive.finalize()

  const data = new Date().toISOString().slice(0, 10)
  return new Response(Readable.toWeb(archive) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="storico-stampe-${data}.zip"`,
      "Cache-Control": "no-store",
    },
  })
})
