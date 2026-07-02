// Motore di interpolazione minimale per i template email. Una sorgente è una
// stringa con segnaposto `{{nome}}`; renderizzarla significa sostituire ogni
// segnaposto col valore corrispondente. Niente logica, niente cicli: di
// proposito. Così la sorgente di un template resta una semplice stringa HTML,
// editabile a mano oggi e — domani — da un editor frontend che la salva a DB.
//
// Le variabili sono già "pronte": chi costruisce il contesto (lib/email/
// templates/) si occupa di escape/sanitizzazione dei valori che finiscono
// nell'HTML. Vedi escapeHtml() qui sotto.

export type TemplateVars = Record<string, string>

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g

/**
 * Sostituisce i segnaposto `{{nome}}` con i valori di `vars`. Un segnaposto
 * senza valore corrispondente lancia: meglio un errore esplicito in fase di
 * invio che una mail spedita con un buco "{{...}}" visibile all'utente.
 */
export function render(source: string, vars: TemplateVars): string {
  return source.replace(PLACEHOLDER, (_match, key: string) => {
    const value = vars[key]
    if (value === undefined) {
      throw new Error(`Variabile mancante nel template email: "${key}"`)
    }
    return value
  })
}

/** Escape dei caratteri HTML, per inserire valori non fidati nel corpo HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
