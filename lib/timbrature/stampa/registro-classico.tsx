import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import { format } from "date-fns"
import { it } from "date-fns/locale"

import type { DatiStampa } from "@/lib/timbrature/stampa/dati"

// Template «Registro presenze»: riproduce il modulo cartaceo storico —  una
// riga per ogni giorno del mese, orari da marcatempo affiancati a quelli
// arrotondati, ordinario e straordinario a destra, totali del mese in fondo.
//
// NB: componenti di @react-pdf/renderer, NON di React DOM. Questo file è
// server-only: non importarlo mai da un client component (vedi ./catalog.ts,
// che è la parte importabile dal client).

// Ore in formato "HH,MM" come sul modulo storico (es. 8h30m → "08,30").
// I minuti sono normalizzati: 3h30m + 0h30m fanno "04,00", non "03,60".
function oreHHMM(minuti: number): string {
  const h = Math.floor(minuti / 60)
  const m = minuti % 60
  return `${String(h).padStart(2, "0")},${String(m).padStart(2, "0")}`
}

// Il modulo storico stampa "00:00" al posto delle celle vuote, non un trattino.
function ora(valore: string | null): string {
  return valore ? valore.slice(0, 5) : "00:00"
}

const NERO = "#1a1a1a"
const GRIGIO = "#6b7280"
const ROSSO = "#c0392b" // sabato e domenica
const MARCATEMPO = "#2f7f93" // orari grezzi: colonna "da marcatempo"
const BORDO = "#d4d4d8"

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 40,
    paddingHorizontal: 28,
    fontFamily: "Helvetica",
    fontSize: 7.5,
    color: NERO,
  },
  titolo: { fontFamily: "Helvetica-Bold", fontSize: 12 },
  nome: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 10,
  },

  // Intestazione a due piani: gruppi di colonne + colonne vere.
  gruppi: { flexDirection: "row", alignItems: "flex-end" },
  gruppo: { textAlign: "center", fontSize: 7.5, color: GRIGIO },
  colonne: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: NERO,
    paddingBottom: 2,
    marginTop: 2,
  },
  intestazione: { fontSize: 7, color: GRIGIO, textAlign: "center" },

  riga: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 13.5,
    borderBottomWidth: 0.25,
    borderBottomColor: BORDO,
  },
  cella: { textAlign: "center" },

  // Larghezze: sommano a 100%.
  wData: { width: "12%", paddingLeft: 2 },
  wGiorno: { width: "10%", paddingLeft: 2 },
  wOra: { width: "8%" },
  wTot: { width: "7%" },

  // Ordinario/straordinario: cella riquadrata come sul modulo storico.
  boxTot: {
    marginHorizontal: 1.5,
    paddingVertical: 1.5,
    borderWidth: 0.25,
    borderColor: BORDO,
    backgroundColor: "#faf9f7",
    textAlign: "center",
  },

  totali: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  totale: { flexDirection: "row", alignItems: "center", gap: 6 },
  totaleValore: {
    fontFamily: "Helvetica-Bold",
    minWidth: 52,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderWidth: 0.5,
    borderColor: NERO,
    textAlign: "right",
  },

  pie: {
    position: "absolute",
    bottom: 20,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: GRIGIO,
  },
})

function Riga({ r }: { r: DatiStampa["righe"][number] }) {
  const data = new Date(r.giorno + "T12:00:00")
  const colore = r.weekend ? { color: ROSSO } : undefined

  return (
    <View style={styles.riga} wrap={false}>
      <Text style={[styles.wData, colore ?? {}]}>
        {format(data, "dd/MM/yyyy")}
      </Text>
      <Text style={[styles.wGiorno, colore ?? {}]}>
        {format(data, "EEEE", { locale: it }).replace(/^./, (c) =>
          c.toUpperCase()
        )}
      </Text>

      {[r.entrata1, r.uscita1, r.entrata2, r.uscita2].map((v, i) => (
        <Text
          key={`reale-${i}`}
          style={[styles.cella, styles.wOra, { color: MARCATEMPO }]}
        >
          {ora(v)}
        </Text>
      ))}

      {[r.ce1, r.cu1, r.ce2, r.cu2].map((v, i) => (
        <Text key={`corretto-${i}`} style={[styles.cella, styles.wOra]}>
          {ora(v)}
        </Text>
      ))}

      <View style={styles.wTot}>
        <Text style={styles.boxTot}>{oreHHMM(r.ordinario)}</Text>
      </View>
      <View style={styles.wTot}>
        <Text style={styles.boxTot}>{oreHHMM(r.straordinario)}</Text>
      </View>
    </View>
  )
}

export function RegistroClassico({ dati }: { dati: DatiStampa }) {
  const { dipendente, righe, totali, stampatoIl } = dati

  return (
    <Document
      title={`Registro presenze — ${dipendente.descrizione || dipendente.codice}`}
      author="Registro Presenze"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.titolo}>Registro Presenze</Text>
        <Text style={styles.nome}>
          {(dipendente.descrizione || dipendente.codice).toUpperCase()}
        </Text>

        {/* Intestazione della tabella: ripetuta a ogni pagina (`fixed`). */}
        <View fixed>
          <View style={styles.gruppi}>
            <Text style={styles.wData}>DATA</Text>
            <Text style={styles.wGiorno} />
            <Text style={[styles.gruppo, { width: "32%" }]}>
              Situazione da marcatempo
            </Text>
            <Text style={[styles.gruppo, { width: "32%" }]}>
              Situazione arrotondata
            </Text>
            <Text style={[styles.gruppo, { width: "14%" }]}>Totale</Text>
          </View>
          <View style={styles.colonne}>
            <Text style={styles.wData} />
            <Text style={styles.wGiorno} />
            {["Entrata", "Uscita", "Entrata", "Uscita"].map((t, i) => (
              <Text
                key={`h-reale-${i}`}
                style={[styles.intestazione, styles.wOra]}
              >
                {t}
              </Text>
            ))}
            {["Entrata", "Uscita", "Entrata", "Uscita"].map((t, i) => (
              <Text
                key={`h-corretto-${i}`}
                style={[styles.intestazione, styles.wOra]}
              >
                {t}
              </Text>
            ))}
            <Text style={[styles.intestazione, styles.wTot]}>Ord.</Text>
            <Text style={[styles.intestazione, styles.wTot]}>Straord.</Text>
          </View>
        </View>

        {righe.map((r) => (
          <Riga key={r.giorno} r={r} />
        ))}

        <View style={styles.totali}>
          <View style={styles.totale}>
            <Text>Ore totali</Text>
            <Text style={styles.totaleValore}>{oreHHMM(totali.totale)}</Text>
          </View>
          <View style={styles.totale}>
            <Text>Totale straordinario</Text>
            <Text style={styles.totaleValore}>
              {oreHHMM(totali.straordinario)}
            </Text>
          </View>
          <View style={styles.totale}>
            <Text>Totale ordinario</Text>
            <Text style={styles.totaleValore}>{oreHHMM(totali.ordinario)}</Text>
          </View>
        </View>

        <View style={styles.pie} fixed>
          <Text>Stampato il {format(stampatoIl, "dd/MM/yyyy")}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Pagina ${pageNumber} di ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}
