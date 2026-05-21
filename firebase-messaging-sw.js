/* ID Seven — firebase-messaging-sw.js
   Service Worker DEDICADO ao Firebase Cloud Messaging (FCM).
   Coexiste com o sw.js (que cuida do cache offline).
   Este arquivo PRECISA estar na raiz do site (mesmo nível do index.html).
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
   Exibe a notificação nativa do sistema. */
messaging.onBackgroundMessage(function(payload){
  var n = payload.notification || {};
  var d = payload.data || {};
  var title = n.title || "ID Seven";
  var options = {
    body: n.body || "",
    icon: n.icon || "icon-192.png",
    badge: "icon-192.png",
    tag: d.tag || ("push-" + Date.now()),
    data: d,
    requireInteraction: false
  };
  return self.registration.showNotification(title, options);
});

/* Quando o usuário clica na notificação:
   - Se o app já está aberto em alguma aba: foca nela e manda mensagem pro JS abrir o card certo
   - Se não estiver aberto: abre uma nova janela com o app */
self.addEventListener("notificationclick", function(event){
  event.notification.close();
  var data = (event.notification && event.notification.data) || {};
  /* URL alvo: rota raiz, app vai usar o `data` pra abrir o card certo */
  var targetUrl = (self.registration && self.registration.scope) || "/";

  event.waitUntil(
    self.clients.matchAll({type: "window", includeUncontrolled: true}).then(function(cs){
      /* 1. Procura uma aba existente do app */
      for(var i = 0; i < cs.length; i++){
        var c = cs[i];
        if(c.url.indexOf(targetUrl.split("?")[0]) === 0 && "focus" in c){
          /* Manda mensagem pro JS pra abrir o card */
          try{ c.postMessage({ type: "fcm-notif-click", data: data }); }catch(_){}
          return c.focus();
        }
      }
      /* 2. Não tem aba aberta — abre uma nova */
      if(self.clients.openWindow){
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
