/* Agenda ID Seven - service worker (cache offline)
   [V64.0] FIX CAUSA RAIZ — race condition do registro de push. ANTES: chamadas
   paralelas de setupPushNotifications abandonavam (return false) se vissem outra
   em andamento. Se a primeira chamada falhasse silenciosamente (rede ruim, app
   em background no mobile), TODAS as outras já tinham desistido. User ficava
   sem token até clicar manualmente em "Testar push". AGORA: promise compartilhada
   (chamadas paralelas esperam a mesma promise) + watchdog de 30s (reseta se
   travar) + trigger automático no snapshot dos users (se detecta sem token,
   agenda retry). sw.js: só cache bump.
   [V63.99] FIX CRÍTICO — Bug do loop ao sair da conta. Causa raiz: sessionId em memória
   não era zerado no logout (só o localStorage), e o teardownPushNotifications da V63.98
   dispara update no Firestore que ativa o onSnapshot de users → snapshot tinha auto-relogin
   por sessionId → re-login infinito → tela piscando. Fix em index.html: sessionId=null
   no logout + sincronização nos handlers de login/cadastro. sw.js: só cache bump.
   [V63.98] AUDITORIA ENGENHARIA SENIOR — 7 bugs reais novos: deep link URL params, isUserActive excluido, fcm-notif-click data.url, onMessage listeners duplicados, teardown race+state, retryPush sem desregistro SW.
   [V63.97] AUDITORIA ESTRUTURAL — bug crítico corrigido:

   BUG: o handler 'fetch' interceptava TODAS as requests GET, incluindo:
     - https://firestore.googleapis.com/... (Firestore listen/watch — usa SSE)
     - https://fcm.googleapis.com/... (FCM client → servidor)
     - https://www.gstatic.com/firebasejs/... (SDK CDN)
     - https://ik.imagekit.io/... (uploads/leituras de fotos)
   
   Cachear essas responses (especialmente listen do Firestore que é SSE
   streaming) podia corromper conexões long-lived. Em mobile com rede
   instável, isso causava reconexões frequentes e estados inconsistentes.
   
   AGORA: SÓ intercepta same-origin (a própria app). Tudo que não é da app
   passa direto pra rede sem cachear.
*/
var CACHE = "idseven-v64-0";

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

  /* [V63.97] FIX CRÍTICO: só intercepta requests pra mesma origin (app).
     Requests pra Firestore, FCM, gstatic, ImageKit etc passam direto. */
  var sameOrigin;
  try{
    sameOrigin = new URL(e.request.url).origin === self.location.origin;
  }catch(_){
    sameOrigin = false;
  }
  if(!sameOrigin) return; /* deixa o browser tratar normalmente, sem cache */

  /* [V63.97] Não cacheia os próprios service workers — browser trata o
     lifecycle deles separadamente; cache aqui só atrapalha update. */
  var p = "";
  try{ p = new URL(e.request.url).pathname; }catch(_){}
  if(p === "/sw.js" || p === "/firebase-messaging-sw.js") return;

  e.respondWith(
    fetch(e.request)
      .then(function (resp) {
        try {
          /* Só cacheia responses básicas (200, mesmo origin) */
          if(resp && resp.ok && resp.type === "basic"){
            var copy = resp.clone();
            caches.open(CACHE).then(function (c) {
              c.put(e.request, copy);
            }).catch(function(){});
          }
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
