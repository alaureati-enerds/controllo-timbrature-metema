import type {
  StampaSettings,
  StampaSettingsAdmin,
  StampaSettingsInput,
} from "@/lib/settings/schema"
import { getSystemSettings, updateSystemSettings } from "@/lib/settings/system"
import { DEFAULT_TEMPLATE_ID } from "@/lib/timbrature/stampa/catalog"

// Impostazioni della STAMPA del registro presenze (globali). Gemello di
// lib/settings/orario.ts. L'unica impostazione è il template predefinito, che
// l'admin fissa dal dialog di stampa della pagina Timbrature.

async function getPersisted(): Promise<StampaSettings> {
  return (await getSystemSettings()).stampa
}

export async function getStampaSettings(): Promise<StampaSettingsAdmin> {
  const db = await getPersisted()
  return { templateId: db.templateId ?? DEFAULT_TEMPLATE_ID }
}

export async function updateStampaSettings(
  input: StampaSettingsInput
): Promise<StampaSettingsAdmin> {
  await updateSystemSettings({ stampa: { templateId: input.templateId } })
  return getStampaSettings()
}
