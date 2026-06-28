"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { it } from "date-fns/locale"
import { BellIcon, CheckCheckIcon } from "lucide-react"
import { toast } from "sonner"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { typeLabel } from "@/lib/notifications/catalog"

// Tipo allineato a NotificationView (lib/notifications), ridichiarato lato client.
type Notification = {
  id: string
  type: string
  category: string
  title: string
  body: string
  url: string | null
  read: boolean
  createdAt: string
}

const PAGE_SIZE = 20

const relative = (iso: string) =>
  formatDistanceToNow(new Date(iso), { addSuffix: true, locale: it })

// Pagina completa delle notifiche dell'utente, entro i limiti della retention.
// Raggiungibile SOLO dalla campanella in topbar (non è una voce di sidebar). Tab
// "Tutte"/"Non lette", paginazione e azioni di lettura. Vedi docs/notifiche.md.
export function NotificationsView() {
  const router = useRouter()
  const [tab, setTab] = useState<"all" | "unread">("all")
  const [entries, setEntries] = useState<Notification[]>([])
  const [total, setTotal] = useState(0)
  const [unread, setUnread] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  // Caricamento inline nell'effect, senza setState sincrono: `loading` parte true
  // e si spegne al primo dato (come in audit-log.tsx). I cambi di tab/pagina
  // scambiano i dati senza ri-mostrare lo skeleton.
  useEffect(() => {
    let active = true
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
    })
    if (tab === "unread") params.set("unreadOnly", "true")
    fetch(`/api/notifications?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("Caricamento non riuscito")
        return res.json() as Promise<{
          entries: Notification[]
          total: number
          unread: number
        }>
      })
      .then((data) => {
        if (!active) return
        setEntries(data.entries)
        setTotal(data.total)
        setUnread(data.unread)
        setLoading(false)
      })
      .catch((e) => {
        if (!active) return
        setLoading(false)
        toast.error(e instanceof Error ? e.message : "Errore imprevisto")
      })
    return () => {
      active = false
    }
  }, [tab, offset, reloadKey])

  async function markAllRead() {
    try {
      const res = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error()
      setReloadKey((k) => k + 1)
    } catch {
      toast.error("Operazione non riuscita")
    }
  }

  async function openNotification(n: Notification) {
    if (!n.read) {
      fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      }).catch(() => {})
    }
    if (n.url) router.push(n.url)
    else if (!n.read) setReloadKey((k) => k + 1)
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tutte le notifiche</CardTitle>
        <CardDescription>
          Gli avvisi del tuo account, dal più recente. Le notifiche lette
          vengono conservate per il periodo impostato dall&apos;amministratore.
        </CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            disabled={unread === 0}
            onClick={markAllRead}
          >
            <CheckCheckIcon data-icon="inline-start" />
            Segna tutte come lette
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as "all" | "unread")
            setOffset(0)
          }}
        >
          <TabsList>
            <TabsTrigger value="all">Tutte</TabsTrigger>
            <TabsTrigger value="unread">
              Non lette{unread > 0 ? ` (${unread})` : ""}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-lg border p-4">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BellIcon />
              </EmptyMedia>
              <EmptyTitle>Nessuna notifica</EmptyTitle>
              <EmptyDescription>
                {tab === "unread"
                  ? "Hai letto tutte le notifiche."
                  : "Qui arriveranno gli avvisi del tuo account."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => openNotification(n)}
                  data-unread={!n.read}
                  className="flex w-full flex-col gap-1 rounded-lg border p-4 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none data-[unread=true]:border-primary/30 data-[unread=true]:bg-primary/5"
                >
                  <div className="flex items-center gap-2">
                    {!n.read && (
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full bg-primary"
                      />
                    )}
                    <span className="font-medium">{n.title}</span>
                    <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                      {relative(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  <span className="text-xs text-muted-foreground">
                    {typeLabel(n.type)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground tabular-nums">
            {total} notific{total === 1 ? "a" : "he"}
            {total > 0 ? ` · pagina ${page} di ${pages}` : ""}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            >
              Precedente
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
            >
              Successiva
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
