// Set curato di icone selezionabili per il branding in modalità "icona". Qui
// stanno solo i NOMI (stringhe), così questo modulo resta leggero e importabile
// anche lato server (es. dallo schema Zod). La mappa nome -> componente lucide
// vive in components/branding-icon.tsx, che è tipata su questi nomi: aggiungere
// un nome qui senza la coppia nel componente (o viceversa) è un errore a compile
// time. Per ampliare la scelta: aggiungi il nome qui e la voce nella mappa.
export const BRANDING_ICON_NAMES = [
  "box",
  "boxes",
  "layout-dashboard",
  "rocket",
  "zap",
  "star",
  "heart",
  "globe",
  "cloud",
  "command",
  "gem",
  "hexagon",
  "shield",
  "flame",
  "sparkles",
  "cpu",
  "database",
  "layers",
  "compass",
  "feather",
  "anchor",
  "atom",
  "aperture",
  "puzzle",
] as const

export type BrandingIconName = (typeof BRANDING_ICON_NAMES)[number]

export const DEFAULT_BRANDING_ICON: BrandingIconName = "box"
