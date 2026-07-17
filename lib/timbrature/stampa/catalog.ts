// Catalogo dei TEMPLATE DI STAMPA del registro presenze. È la fonte di verità
// dei template disponibili ed è fatto di soli METADATI: nessun import di
// @react-pdf/renderer, così può essere importato anche dal client (la Select
// del dialog di stampa). I documenti PDF veri stanno in ./documenti.tsx, che
// resta server-only. Stesso schema di lib/audit/catalog.ts.
//
// AGGIUNGERE UN TEMPLATE:
//   1. aggiungi una voce qui sotto con un `id` univoco;
//   2. crea il componente PDF in lib/timbrature/stampa/<id>.tsx;
//   3. mappalo in lib/timbrature/stampa/documenti.tsx.
// Nessuna migrazione: il template predefinito vive nel blob delle impostazioni
// di sistema. Vedi docs/stampa-timbrature.md.

export type StampaTemplateDef = {
  // Chiave univoca, salvata nelle impostazioni e passata alla route di stampa.
  id: string
  // Nome mostrato nella Select del dialog di stampa.
  nome: string
  // Riga di aiuto sotto il nome.
  descrizione: string
}

export const stampaTemplates = [
  {
    id: "registro-classico",
    nome: "Registro presenze",
    descrizione:
      "Formato classico: orari da marcatempo, orari arrotondati e totali giornalieri.",
  },
  {
    id: "registro-compatto",
    nome: "Registro presenze (compatto)",
    descrizione:
      "Come il registro classico, senza le colonne del marcatempo grezzo: orari corretti, straordinario lavoro/viaggio e pernotto.",
  },
] as const satisfies readonly StampaTemplateDef[]

export type StampaTemplateId = (typeof stampaTemplates)[number]["id"]

export const stampaTemplateIds = stampaTemplates.map((t) => t.id) as [
  StampaTemplateId,
  ...StampaTemplateId[],
]

export const DEFAULT_TEMPLATE_ID: StampaTemplateId = "registro-classico"

/** True se la stringa è l'id di un template esistente. */
export function isStampaTemplateId(id: string): id is StampaTemplateId {
  return stampaTemplateIds.includes(id as StampaTemplateId)
}

export function getStampaTemplate(id: StampaTemplateId): StampaTemplateDef {
  return stampaTemplates.find((t) => t.id === id) ?? stampaTemplates[0]
}
