import type {
  OrarioLavoroSettings,
  OrarioLavoroSettingsAdmin,
  OrarioLavoroSettingsInput,
} from "@/lib/settings/schema"
import { getSystemSettings, updateSystemSettings } from "@/lib/settings/system"

async function getPersisted(): Promise<OrarioLavoroSettings> {
  return (await getSystemSettings()).orario
}

export async function getOrarioSettingsForAdmin(): Promise<OrarioLavoroSettingsAdmin> {
  const db = await getPersisted()
  return {
    primoIngresso: db.primoIngresso ?? "08:00",
    primaUscita: db.primaUscita ?? "12:00",
    secondoIngresso: db.secondoIngresso ?? "13:30",
    secondaUscita: db.secondaUscita ?? "17:30",
  }
}

export async function updateOrarioSettings(
  input: OrarioLavoroSettingsInput
): Promise<OrarioLavoroSettingsAdmin> {
  const next: OrarioLavoroSettings = {
    primoIngresso: input.primoIngresso,
    primaUscita: input.primaUscita,
    secondoIngresso: input.secondoIngresso,
    secondaUscita: input.secondaUscita,
  }

  await updateSystemSettings({ orario: next })
  return getOrarioSettingsForAdmin()
}
