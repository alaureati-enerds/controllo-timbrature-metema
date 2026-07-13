// Helper condivisi per gli input orario delle timbrature (pagina Timbrature e
// gestione preset). Tenuti qui così la maschera e la regex non si duplicano tra
// i componenti.

/** Valida una stringa nel formato HH:MM (00:00–23:59). */
export const ORARIO_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

// Maschera "guidata" per l'input orario: accetta solo cifre, le raggruppa in
// HH:MM inserendo i due punti in automatico e scarta ogni cifra che
// renderebbe l'ora (>23) o i minuti (>59) non validi, così l'utente non può
// digitare un formato scorretto.
export function mascheraOrario(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4)
  let hh = ""
  let mm = ""
  for (const d of digits) {
    if (hh.length < 2) {
      if (hh.length === 0 && Number(d) > 2) break
      if (hh.length === 1 && hh === "2" && Number(d) > 3) break
      hh += d
    } else if (mm.length < 2) {
      if (mm.length === 0 && Number(d) > 5) break
      mm += d
    }
  }
  return mm ? `${hh}:${mm}` : hh
}
