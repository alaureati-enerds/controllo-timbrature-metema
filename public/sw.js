// Service worker minimale per l'installabilità della PWA.
//
// Non implementa caching offline (vedi docs/pwa.md per le estensioni future).
// L'handler `fetch` no-op serve a soddisfare il criterio di installabilità di
// Chromium, che richiede uno SW con un fetch handler registrato. I listener
// `push` e `notificationclick` sono predisposti per future notifiche push.

self.addEventListener("install", function () {
  self.skipWaiting()
})

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", function (event) {
  // Lascia che il browser gestisca le navigazioni di documento (HTML) da solo:
  // intercettarle con fetch() rompe la prima navigazione della finestra standalone
  // in dev con Next.js. Il SW esiste solo per soddisfare il criterio di
  // installabilità di Chromium, non per caching.
  if (event.request.mode === "navigate") return
  event.respondWith(fetch(event.request))
})

// Parse difensivo del payload push: il server può inviare JSON strutturato
// ({title, body, icon}) oppure testo piatto (es. il test di Chrome DevTools).
function parsePushData(data) {
  if (!data) return { title: "Notifica", body: "" }
  try {
    const parsed = data.json()
    return {
      title: parsed.title || "Notifica",
      body: parsed.body || "",
      icon: parsed.icon,
    }
  } catch {
    // Non è JSON valido: tratta il contenuto come testo della notifica.
    const text = data.text()
    return { title: "Notifica", body: text }
  }
}

self.addEventListener("push", function (event) {
  const data = parsePushData(event.data)
  const options = {
    body: data.body,
    icon: data.icon || "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: "2",
    },
  }
  event.waitUntil(self.registration.showNotification(data.title, options))
})

self.addEventListener("notificationclick", function (event) {
  event.notification.close()
  event.waitUntil(self.clients.openWindow("/"))
})
