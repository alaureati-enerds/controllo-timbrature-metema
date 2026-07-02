import type { Metadata } from "next"

import { AuditSettingsForm } from "@/components/admin/audit-settings-form"
import { EmailSettingsForm } from "@/components/admin/email-settings-form"
import { MySqlSettingsForm } from "@/components/admin/mysql-settings-form"
import { NotificationSettingsForm } from "@/components/admin/notification-settings-form"
import { SystemSettingsForm } from "@/components/admin/system-settings-form"
import { requireRole } from "@/lib/auth-helpers"
import { getAuditSettings } from "@/lib/settings/audit"
import { getEmailSettingsForAdmin } from "@/lib/settings/email"
import { getMySqlSettingsForAdmin } from "@/lib/settings/mysql"
import { getNotificationSettings } from "@/lib/settings/notifications"
import { getSystemSettings } from "@/lib/settings/system"

export const metadata: Metadata = { title: "Impostazioni di sistema" }

export default async function AdminSettingsPage() {
  await requireRole("admin")
  const [
    settings,
    emailSettings,
    auditSettings,
    notificationSettings,
    mysqlSettings,
  ] = await Promise.all([
    getSystemSettings(),
    getEmailSettingsForAdmin(),
    getAuditSettings(),
    getNotificationSettings(),
    getMySqlSettingsForAdmin(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Impostazioni di sistema
        </h1>
        <p className="text-sm text-muted-foreground">
          Configurazione globale dell&apos;applicazione: branding, email, MySQL,
          audit log e notifiche.
        </p>
      </header>

      <SystemSettingsForm initial={settings} />
      <EmailSettingsForm initial={emailSettings} />
      <MySqlSettingsForm initial={mysqlSettings} />
      <AuditSettingsForm initial={auditSettings} />
      <NotificationSettingsForm initial={notificationSettings} />
    </div>
  )
}
