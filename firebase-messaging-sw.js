/* ID Seven — firebase-messaging-sw.js
   Service Worker DEDICADO ao Firebase Cloud Messaging (FCM).
   Coexiste com o sw.js (que cuida do cache offline).
   Este arquivo PRECISA estar na raiz do site (mesmo nível do index.html).

   [V63.97] AUDITORIA ESTRUTURAL — 2 bugs críticos corrigidos:

   BUG #1: notificationclick usava self.registration.scope (que é
     "/firebase-cloud-messaging-push-scope") como targetUrl. Resultado:
     - clients.matchAll() filtrava por essa URL que NUNCA bate com a aba
       real do app (que está em "/"). Sempre caía em openWindow.
     - openWindow abria URL inexistente "/firebase-cloud-messaging-push-scope"
     - User clicava na notif e nada acontecia, ou abria página em branco.

   BUG #2: Não usava data.url pra deep-link. Toda notification abria a app
     na raiz, mesmo que o payload tivesse url do compromisso/tarefa.

   AGORA:
   - Match de abas existentes feito por mesmo ORIGIN (não scope)
   - Se há aba aberta, posta mensagem + foca nela (JS abre o card)
   - Se não há, abre nova janela com a URL CORRETA do app + query do deep link
*/

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBbeZ5M9iNgzw5382iCIDKB-G2QqKuwAes",
  authDomain: "agenda-id-seven.firebaseapp.com",
  projectId: "agenda-id-seven",
  storageBucket: "agenda-id-seven.firebasestorage.app",
  messagingSenderId: "391529908613",
  appId: "1:391529908613:web:ba62ed04ff7d0d776cdcec"
});

var messaging = firebase.messaging();

/* Handler de push em BACKGROUND (app fechado ou aba inativa).
   Quando o payload tem `notification` field, o Chrome auto-exibe e este
   handler NÃO é chamado. Mantemos como fallback pra browsers/SDK que não
   fazem auto-display (Firefox em alguns casos). */
messaging.onBackgroundMessage(function(payload){
  try{
    var n = payload.notification || {};
    var d = payload.data || {};
    var title = n.title || "ID Seven";
    var options = {
      body: n.body || "",
      icon: n.icon || "icon-192.png",
      badge: "icon-192.png",
      tag: d.tag || ("push-" + Date.now()),
      data: d,
      requireInteraction: false,
      vibrate: [200, 100, 200]
    };
    return self.registration.showNotification(title, options);
  }catch(e){
    /* nunca quebra o SW por erro de display */
    console.error("[firebase-messaging-sw onBackgroundMessage]", e);
  }
});

/* Quando o usuário clica na notificação:
   - Se há uma aba do app aberta (mesma origin): foca nela + manda mensagem
     pra abrir o card certo
   - Senão: abre nova janela com a URL alvo (deep link se possível) */
self.addEventListener("notificationclick", function(event){
  event.notification.close();
  var data = (event.notification && event.notification.data) || {};

  /* [V63.97] FIX BUG #1: usa o ORIGIN do scope, não o path completo.
     Origin do SW é "https://agendaidseven.com.br" — bate com qualquer aba
     do app independente do path. */
  var swOrigin;
  try{
    swOrigin = new URL(self.registration.scope).origin;
  }catch(_){
    swOrigin = "";
  }

  /* [V63.97] FIX BUG #2: monta URL alvo usando data.url se disponível.
     Pra "?openEvent=ID" → abre "https://agendaidseven.com.br/?openEvent=ID"
     Pra URLs absolutas → usa direto.
     Sem data.url → abre a raiz do app. */
  var targetUrl;
  try{
    if(data.url){
      var u = String(data.url);
      if(u.indexOf("http") === 0){
        targetUrl = u;
      } else {
        /* relativa — monta com origin */
        targetUrl = swOrigin + "/" + u.replace(/^\//, "");
      }
    } else {
      targetUrl = swOrigin + "/";
    }
  }catch(_){
    targetUrl = swOrigin + "/" || "/";
  }

  event.waitUntil(
    self.clients.matchAll({type: "window", includeUncontrolled: true}).then(function(cs){
      /* 1. Procura aba existente do app (qualquer URL do mesmo origin) */
      for(var i = 0; i < cs.length; i++){
        var c = cs[i];
        try{
          var cOrigin = new URL(c.url).origin;
          if(cOrigin === swOrigin && "focus" in c){
            /* Manda mensagem pro JS pra abrir o card */
            try{ c.postMessage({ type: "fcm-notif-click", data: data }); }catch(_){}
            /* [V63.97] Se a aba está em URL diferente do targetUrl, navega ela */
            try{
              if(data.url && c.url.indexOf(targetUrl) !== 0 && c.navigate){
                return c.navigate(targetUrl).then(function(){ return c.focus(); }).catch(function(){ return c.focus(); });
              }
            }catch(_){}
            return c.focus();
          }
        }catch(_){ /* URL inválida, ignora esse client */ }
      }
      /* 2. Não tem aba aberta — abre uma nova com URL alvo correta */
      if(self.clients.openWindow){
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
