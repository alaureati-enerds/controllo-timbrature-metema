import {
  CALCOLO_DEFAULTS,
  type CalcoloSettings,
  type CalcoloSettingsAdmin,
  type CalcoloSettingsInput,
} from "@/lib/settings/schema"
import { getSystemSettings, updateSystemSettings } from "@/lib/settings/system"

// Service delle regole del MOTORE DI CALCOLO. Gemello di lib/settings/orario.ts:
// legge/scrive la chiave `calcolo` del blob singleton, applicando i default di
// fallback (CALCOLO_DEFAULTS, definiti nel modulo puro schema.ts così da restare
// riusabili anche dal motore e dai suoi test senza tirare dentro Prisma).

async function getPersisted(): Promise<CalcoloSettings> {
  return (await getSystemSettings()).calcolo
}

export async function getCalcoloSettingsForAdmin(): Promise<CalcoloSettingsAdmin> {
  const db = await getPersisted()
  return {
    ignora0000: db.ignora0000 ?? CALCOLO_DEFAULTS.ignora0000,
    dedupMinuti: db.dedupMinuti ?? CALCOLO_DEFAULTS.dedupMinuti,
    sogliaPomeriggio: db.sogliaPomeriggio ?? CALCOLO_DEFAULTS.sogliaPomeriggio,
    strategiaUscita: db.strategiaUscita ?? CALCOLO_DEFAULTS.strategiaUscita,
    granularitaMinuti:
      db.granularitaMinuti ?? CALCOLO_DEFAULTS.granularitaMinuti,
    versoEntrata: db.versoEntrata ?? CALCOLO_DEFAULTS.versoEntrata,
    versoUscita: db.versoUscita ?? CALCOLO_DEFAULTS.versoUscita,
    pausaAutomatica: db.pausaAutomatica ?? CALCOLO_DEFAULTS.pausaAutomatica,
    pausaSpanMinimo: db.pausaSpanMinimo ?? CALCOLO_DEFAULTS.pausaSpanMinimo,
    minutiOrdinari: db.minutiOrdinari ?? CALCOLO_DEFAULTS.minutiOrdinari,
    oreMassimeGiorno:
      db.oreMassimeGiorno ?? CALCOLO_DEFAULTS.oreMassimeGiorno,
  }
}

export async function updateCalcoloSettings(
  input: CalcoloSettingsInput
): Promise<CalcoloSettingsAdmin> {
  // Il merge di updateSystemSettings è shallow: passiamo l'oggetto completo.
  const next: CalcoloSettings = { ...input }
  await updateSystemSettings({ calcolo: next })
  return getCalcoloSettingsForAdmin()
}
