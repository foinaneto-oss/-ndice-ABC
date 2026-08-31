// Service Worker mínimo do Índice ABC.
// Por enquanto só existe para tornar o site "instalável" como PWA.
// Cache/uso offline pode ser adicionado depois, se fizer sentido.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Por enquanto, deixa o navegador buscar tudo normalmente na rede.
  return;
});

// Recebe uma notificação push do servidor e mostra pro usuário
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }

  event.waitUntil(
    self.registration.showNotification(data.title || "Índice ABC", {
      body: data.body || "Nova pesquisa disponível!",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

// Ao clicar na notificação, abre (ou foca) o site na página certa
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
