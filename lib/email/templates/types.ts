// Forma di un template email. La SORGENTE (subject/html/text) è una stringa con
// segnaposto `{{...}}`; `variables` dichiara i segnaposto attesi, così un futuro
// editor frontend sa quali offrire e si possono validare i contesti d'invio.
// Tenere la sorgente come stringa (non come componente) è ciò che rende i
// template editabili da un editor: vedi la nota in docs/email.md.
export interface EmailTemplate {
  /** Identificatore stabile, usato come chiave nel registry e per gli override. */
  id: string
  /** Oggetto della mail (può contenere segnaposto). */
  subject: string
  /** Corpo HTML completo (può contenere segnaposto). */
  html: string
  /** Corpo testuale alternativo (può contenere segnaposto). */
  text: string
  /** Nomi dei segnaposto che il contesto d'invio deve fornire. */
  variables: readonly string[]
}
