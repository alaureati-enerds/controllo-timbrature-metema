import type { Metadata } from "next"

import { AuditSettingsForm } from "@/components/admin/audit-settings-form"
import { CalcoloSettingsForm } from "@/components/admin/calcolo-settings-form"
import { DipendentiSettingsForm } from "@/components/admin/dipendenti-settings-form"
import { EmailSettingsForm } from "@/components/admin/email-settings-form"
import { MySqlSettingsForm } from "@/components/admin/mysql-settings-form"
import { NotificationSettingsForm } from "@/components/admin/notification-settings-form"
import { OrarioSettingsForm } from "@/components/admin/orario-settings-form"
import { StampeStoricoSettingsForm } from "@/components/admin/stampe-storico-settings-form"
import { SystemSettingsForm } from "@/components/admin/system-settings-form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { requireRole } from "@/lib/auth-helpers"
import { listDipendentiNascosti } from "@/lib/dipendenti/nascosti"
import { listDipendenti } from "@/lib/mysql/timbrature"
import { listDipendentiRichiesti } from "@/lib/rapportini/richiesti"
import { getAuditSettings } from "@/lib/settings/audit"
import { getCalcoloSettingsForAdmin } from "@/lib/settings/calcolo"
import { getEmailSettingsForAdmin } from "@/lib/settings/email"
import { getMySqlSettingsForAdmin } from "@/lib/settings/mysql"
import { getNotificationSettings } from "@/lib/settings/notifications"
import { getOrarioSettingsForAdmin } from "@/lib/settings/orario"
import { getStampeStoricoSettings } from "@/lib/settings/stampe-storico"
import { getSystemSettings } from "@/lib/settings/system"

export const metadata: Metadata = { title: "Impostazioni di sistema" }

export default async function AdminSettingsPage() {
  await requireRole("admin")
  const [
    settings,
    emailSettings,
    auditSettings,
    notificationSettings,
    stampeSettings,
    mysqlSettings,
    orarioSettings,
    calcoloSettings,
    dipendenti,
    dipendentiRichiesti,
    dipendentiNascosti,
  ] = await Promise.all([
    getSystemSettings(),
    getEmailSettingsForAdmin(),
    getAuditSettings(),
    getNotificationSettings(),
    getStampeStoricoSettings(),
    getMySqlSettingsForAdmin(),
    getOrarioSettingsForAdmin(),
    getCalcoloSettingsForAdmin(),
    listDipendenti().catch(() => []),
    listDipendentiRichiesti(),
    listDipendentiNascosti(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Impostazioni di sistema
        </h1>
        <p className="text-sm text-muted-foreground">
          Configurazione globale dell&apos;applicazione: branding, email, MySQL,
          orario di lavoro, regole di calcolo, audit log, notifiche e storico
          stampe.
        </p>
      </header>

      <Tabs defaultValue="generale">
        <TabsList>
          <TabsTrigger value="generale">Generale</TabsTrigger>
          <TabsTrigger value="dipendenti">Dipendenti</TabsTrigger>
        </TabsList>
        <TabsContent value="generale">
          <div className="flex flex-col gap-6">
            <SystemSettingsForm initial={settings} />
            <EmailSettingsForm initial={emailSettings} />
            <MySqlSettingsForm initial={mysqlSettings} />
            <OrarioSettingsForm initial={orarioSettings} />
            <CalcoloSettingsForm initial={calcoloSettings} />
            <AuditSettingsForm initial={auditSettings} />
            <NotificationSettingsForm initial={notificationSettings} />
            <StampeStoricoSettingsForm initial={stampeSettings} />
          </div>
        </TabsContent>
        <TabsContent value="dipendenti">
          <DipendentiSettingsForm
            dipendenti={dipendenti}
            richiesti={dipendentiRichiesti}
            nascosti={dipendentiNascosti}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
