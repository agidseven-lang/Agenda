/* Agenda ID Seven - service worker
   Estratégia: rede primeiro (sempre busca a versão mais nova quando online),
   com cache de reserva para funcionar offline.
   [V63.87] Cache bump — FIX: push de agenda não disparava por filtro positivo de status. Agora sai pra todos. */
var CACHE = "idseven-v63-87";

self.addEventListener("install", function (e) {
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (k) {
          if (k !== CACHE) return caches.delete(k);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(function (resp) {
        try {
          var copy = resp.clone();
          caches.open(CACHE).then(function (c) {
            c.put(e.request, copy);
          });
        } catch (_) {}
        return resp;
      })
      .catch(function () {
        return caches.match(e.request).then(function (m) {
          return m || caches.match("./") || caches.match("index.html");
        });
      })
  );
});
