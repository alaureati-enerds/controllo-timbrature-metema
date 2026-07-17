import { Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import { format } from "date-fns"
import { it } from "date-fns/locale"

import type { DatiStampa } from "@/lib/timbrature/stampa/dati"

// Template «Registro presenze (compatto)»: stessi dati del registro classico
// ma SENZA le 4 colonne del marcatempo grezzo — solo gli orari corretti, più
// larghi, e i totali (ordinario, straordinario lavoro/viaggio, TR). Per chi
// non ha bisogno della fedeltà al modulo cartaceo storico e preferisce più
// respiro sui dati corretti e su ciò che arriva dai rapportini.
//
// Pagina autosufficiente come ./registro-classico.tsx (stesso pattern
// «Aggiungere un template» di docs/stampa-timbrature.md): le funzioni di
// formattazione sono duplicate qui apposta, non estratte in un modulo
// condiviso, per tenere ogni template un file indipendente.
//
// NB: componenti di @react-pdf/renderer, NON di React DOM. Questo file è
// server-only: non importarlo mai da un client component (vedi ./catalog.ts,
// che è la parte importabile dal client).

const MESI = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
]

function oreHHMM(minuti: number): string {
  if (minuti === 0) return "—"
  const h = Math.floor(minuti / 60)
  const m = minuti % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function formattaTotale(minuti: number): string {
  if (minuti === 0) return "—"
  const h = Math.floor(minuti / 60)
  const m = minuti % 60
  return `${h}h ${m}m`
}

function ora(valore: string | null): string {
  return valore ? valore.slice(0, 5) : "—"
}

// «01 Lun»: data breve come nella pagina a schermo (mese/anno sono già in
// intestazione, non serve ripeterli su ogni riga).
function dataBreve(data: Date): string {
  const giorno = format(data, "EEE", { locale: it }).replace(/^./, (c) =>
    c.toUpperCase()
  )
  return `${format(data, "dd")} ${giorno}`
}

const NERO = "#1a1a1a"
const GRIGIO = "#6b7280"
const ROSSO = "#c0392b" // sabato e domenica
const CORRETTO = "#2f7f93" // orari arrotondati
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
    marginBottom: 2,
  },
  periodo: {
    textAlign: "center",
    fontSize: 8,
    color: GRIGIO,
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

  // Larghezze: sommano a 100%. wData è stretta (basta «01 Lun», mese/anno
  // sono già in intestazione): lo spazio va tutto agli orari corretti e ai
  // totali, molto più larghi che nel registro classico (niente colonne di
  // marcatempo grezzo con cui condividere la riga).
  wData: { width: "9%", paddingLeft: 2 },
  wTR: { width: "6%" },
  wOra: { width: "14.2%" },
  wTot: { width: "9.4%" },

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
    flexDirection: "column",
    gap: 4,
    marginTop: 14,
    paddingTop: 8,
    borderTopWidth: 0.75,
    borderTopColor: NERO,
  },
  totale: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minWidth: 180,
  },
  totaleValore: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    minWidth: 64,
    paddingVertical: 3,
    paddingHorizontal: 8,
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
      <Text style={[styles.wData, colore ?? {}]}>{dataBreve(data)}</Text>
      <Text style={[styles.cella, styles.wTR]}>
        {r.pernottamento ? "X" : ""}
      </Text>

      {[r.ce1, r.cu1, r.ce2, r.cu2].map((v, i) => (
        <Text
          key={`corretto-${i}`}
          style={[styles.cella, styles.wOra, { color: CORRETTO }]}
        >
          {ora(v)}
        </Text>
      ))}

      <View style={styles.wTot}>
        <Text style={styles.boxTot}>{oreHHMM(r.ordinario)}</Text>
      </View>
      <View style={styles.wTot}>
        <Text style={styles.boxTot}>{oreHHMM(r.straordinario)}</Text>
      </View>
      <View style={styles.wTot}>
        <Text style={styles.boxTot}>{oreHHMM(r.straordinarioViaggio)}</Text>
      </View>
    </View>
  )
}

export function PaginaRegistroCompatto({ dati }: { dati: DatiStampa }) {
  const { dipendente, righe, totali, stampatoIl } = dati

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.titolo}>Registro Presenze</Text>
      <Text style={styles.nome}>
        {(dipendente.descrizione || dipendente.codice).toUpperCase()}
      </Text>
      <Text style={styles.periodo}>
        {MESI[dati.mese - 1]} {dati.anno}
      </Text>

      {/* Intestazione della tabella: ripetuta a ogni pagina (`fixed`). */}
      <View fixed>
        <View style={styles.gruppi}>
          <Text style={styles.wData}>Data</Text>
          <Text style={[styles.gruppo, styles.wTR]}>Trasferta</Text>
          <Text style={[styles.gruppo, { width: "56.8%" }]}>
            Situazione arrotondata
          </Text>
          <Text style={[styles.gruppo, { width: "28.2%" }]}>Totale</Text>
        </View>
        <View style={styles.colonne}>
          <Text style={styles.wData} />
          <Text style={styles.wTR} />
          {["Entrata", "Uscita", "Entrata", "Uscita"].map((t, i) => (
            <Text
              key={`h-corretto-${i}`}
              style={[styles.intestazione, styles.wOra]}
            >
              {t}
            </Text>
          ))}
          <Text style={[styles.intestazione, styles.wTot]}>Ord.</Text>
          <Text style={[styles.intestazione, styles.wTot]}>Straord. lav.</Text>
          <Text style={[styles.intestazione, styles.wTot]}>Straord. viag.</Text>
        </View>
      </View>

      {righe.map((r) => (
        <Riga key={r.giorno} r={r} />
      ))}

      <View style={{ alignItems: "flex-end" }}>
        <View style={styles.totali}>
          <View style={styles.totale}>
            <Text>Ordinario</Text>
            <Text style={styles.totaleValore}>
              {formattaTotale(totali.ordinario)}
            </Text>
          </View>
          <View style={styles.totale}>
            <Text>Straordinario lavoro</Text>
            <Text style={styles.totaleValore}>
              {formattaTotale(totali.straordinario)}
            </Text>
          </View>
          <View style={styles.totale}>
            <Text>Straordinario viaggio</Text>
            <Text style={styles.totaleValore}>
              {formattaTotale(totali.straordinarioViaggio)}
            </Text>
          </View>
          <View style={styles.totale}>
            <Text>Totale ore</Text>
            <Text style={styles.totaleValore}>
              {formattaTotale(totali.totale)}
            </Text>
          </View>
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
  )
}
