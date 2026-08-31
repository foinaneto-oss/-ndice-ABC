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
