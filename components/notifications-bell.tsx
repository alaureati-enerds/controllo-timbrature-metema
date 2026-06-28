"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { it } from "date-fns/locale"
import { BellIcon, CheckCheckIcon } from "lucide-react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"

// Tipo allineato a NotificationView (lib/notifications). Ridichiarato qui come in
// audit-log.tsx: il client non importa dal modulo server.
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

// Ogni quanto aggiornare il conteggio dei non letti. La consegna è in-app, non
// realtime: un polling rado basta e non pesa (una COUNT su indice). Realtime/SSE
// sarà un canale futuro senza toccare questa UI. Vedi docs/notifiche.md.
const POLL_MS = 45_000
const PREVIEW_LIMIT = 8

const relative = (iso: string) =>
  formatDistanceToNow(new Date(iso), { addSuffix: true, locale: it })

// Campanella delle notifiche in topbar: badge col numero di non lette (polling) e
// un popover con le ultime notifiche, "segna tutte come lette" e il link alla
// pagina completa. La pagina /notifications è raggiungibile SOLO da qui (non è in
// sidebar). Vedi docs/notifiche.md.
export function NotificationsBell() {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[] | null>(null)

  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count")
      if (!res.ok) return
      const data = (await res.json()) as { count: number }
      setUnread(data.count)
    } catch {
      // silenzioso: il badge è un indicatore, non un'azione critica.
    }
  }, [])

  // Polling del conteggio, attivo solo da autenticati. Il fetch è inline (la
  // setState vive nel callback del .then, non sincrona nell'effect).
  useEffect(() => {
    if (!session) return
    let active = true
    const tick = () => {
      fetch("/api/notifications/unread-count")
        .then((res) => (res.ok ? (res.json() as Promise<{ count: number }>) : null))
        .then((data) => {
          if (active && data) setUnread(data.count)
        })
        .catch(() => {})
    }
    tick()
    const timer = setInterval(tick, POLL_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [session])

  // Carica l'anteprima quando il popover si apre. Il reset a `null` (skeleton)
  // avviene nell'handler onOpenChange, non qui, per non chiamare setState in modo
  // sincrono dentro l'effect.
  useEffect(() => {
    if (!open) return
    let active = true
    fetch(`/api/notifications?limit=${PREVIEW_LIMIT}`)
      .then((res) => {
        if (!res.ok) throw new Error("Caricamento non riuscito")
        return res.json() as Promise<{ entries: Notification[]; unread: number }>
      })
      .then((data) => {
        if (!active) return
        setItems(data.entries)
        setUnread(data.unread)
      })
      .catch(() => {
        if (active) setItems([])
      })
    return () => {
      active = false
    }
  }, [open])

  async function markAllRead() {
    setItems((prev) => prev?.map((n) => ({ ...n, read: true })) ?? prev)
    setUnread(0)
    try {
      const res = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error("Operazione non riuscita")
      refreshCount()
    }
  }

  async function openNotification(n: Notification) {
    setOpen(false)
    if (!n.read) {
      setUnread((c) => Math.max(0, c - 1))
      fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      }).catch(() => {})
    }
    if (n.url) router.push(n.url)
  }

  if (!session) return null

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        // Reset allo skeleton all'apertura (l'effect poi ricarica).
        if (o) setItems(null)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unread > 0 ? `Notifiche, ${unread} non lette` : "Notifiche"
          }
        >
          <BellIcon />
          {unread > 0 && (
            <Badge
              className="absolute -top-1 -right-1 size-5 min-w-5 justify-center rounded-full px-1 tabular-nums"
              variant="destructive"
            >
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-medium">Notifiche</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={unread === 0}
            onClick={markAllRead}
          >
            <CheckCheckIcon data-icon="inline-start" />
            Segna lette
          </Button>
        </div>

        {/* Lista scrollabile: un div con overflow è più affidabile della
            ScrollArea di Radix dentro un popover (che non vincola l'altezza). */}
        <div className="max-h-96 overflow-y-auto">
          {items === null ? (
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <Empty className="border-0 py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BellIcon />
                </EmptyMedia>
                <EmptyTitle>Nessuna notifica</EmptyTitle>
                <EmptyDescription>
                  Qui arriveranno gli avvisi del tuo account.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openNotification(n)}
                    className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && (
                        <span
                          aria-hidden="true"
                          className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                        />
                      )}
                      <span
                        className={
                          n.read
                            ? "text-sm font-medium text-muted-foreground"
                            : "text-sm font-medium"
                        }
                      >
                        {n.title}
                      </span>
                    </div>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {n.body}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {relative(n.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            asChild
            onClick={() => setOpen(false)}
          >
            <Link href="/notifications">Vedi tutte le notifiche</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
