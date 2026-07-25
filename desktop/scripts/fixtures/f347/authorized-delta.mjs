/* =====================================================================================
 * F3.4.7 — DELTA AUTORIZADO (encadeável) da correção da ENTREGA VISUAL IMEDIATA amarela/vermelha.
 * -------------------------------------------------------------------------------------
 * A correção toca 5 arquivos-fonte. Este módulo exporta:
 *   - applyF347IndexDelta(text): transforma o index.html da 1.0.183 no estado atual (3 hunks do
 *     renderer: guarda única notifToastOnce + roteamento notif-toast/notif-history p/ TODOS os
 *     eventos). Encadeável após applyF345SlaDelta/applyF346CalendarDelta (usado pelos guards
 *     region f343..f346 e pelo guard novo f347).
 *   - F347_MAIN_MARKERS: marcadores de fonte que PROVAM a intenção da correção em cada .ts tocado
 *     (main.ts, firebase.ts, bgNotify.ts, slaScheduler.ts). O guard f347 exige que cada arquivo
 *     (a) DIFIRA da 1.0.183 e (b) contenha seu marcador — prova de mudança autorizada e localizada.
 *   - F347_SOURCE_FILES: a lista EXATA dos 5 arquivos-fonte da correção.
 * Sem rede, sem build. Determinístico. As substituições são byte-exatas (self-verificadas pelo
 * próprio guard: applyF347IndexDelta(base) === atual, senão o guard falha).
 * ===================================================================================== */

/* ── index.html: hunk 1 — comentário + guarda única notifToastOnce (+ alias) ── */
const IDX_H1_OLD =
  `/* F3.3.10-FIX — TOAST DE ATRIBUIÇÃO (Social → Designer). designer_assigned/task_assigned nasce no
   notifier do MAIN; em alguns casos o canal in-app (notif-toast) não renderiza o toast premium — o
   payload chega só pela captura (notif-history) e entra na Central, sem aparecer no canto inferior
   direito. Compensação CIRÚRGICA: exibe o toast premium para ESSES eventos pela própria captura, UMA
   vez por dedupKey (nunca duplica o toast das demais) e só com a janela visível (mantém a regra
   aprovada: minimizado/bandeja = nativa). NÃO altera SLA/fluxo/dedup/roteamento/severidade/som. */
var notifAttrToastSeen={};
function notifIsAttrEvent(p){ var e=p&&p.eventType; return e==='designer_assigned'||e==='task_assigned'; }
function notifAttrToastOnce(p){ try{ var k=String((p&&(p.dedupKey||p.eventId))||''); if(!k) return false; if(notifAttrToastSeen[k]) return false; notifAttrToastSeen[k]=1; notifShowToast(p); return true; }catch(_){ return false; } }`;
const IDX_H1_NEW =
  `/* F3.3.10-FIX — TOAST DE ATRIBUIÇÃO (Social → Designer). designer_assigned/task_assigned nasce no
   notifier do MAIN; em alguns casos o canal in-app (notif-toast) não renderiza o toast premium — o
   payload chega só pela captura (notif-history) e entra na Central, sem aparecer no canto inferior
   direito. Compensação CIRÚRGICA: exibe o toast premium para ESSES eventos pela própria captura, UMA
   vez por dedupKey (nunca duplica o toast das demais) e só com a janela visível (mantém a regra
   aprovada: minimizado/bandeja = nativa). NÃO altera SLA/fluxo/dedup/roteamento/severidade/som.
   F3.4.7 — a MESMA compensação passa a cobrir TODOS os eventos (inclusive amarela/vermelha de SLA,
   que estavam descobertas): notifToastOnce(p) é a porta ÚNICA do toast premium — chamada pelo canal
   notif-toast E pela captura notif-history — com guarda once-por-dedupKey COMPARTILHADA (o mesmo
   payload vindo pelos dois canais renderiza UMA vez; nunca duplica, nunca perde). */
var notifAttrToastSeen={};
function notifIsAttrEvent(p){ var e=p&&p.eventType; return e==='designer_assigned'||e==='task_assigned'; }
function notifToastOnce(p){ try{ var k=String((p&&(p.dedupKey||p.eventId))||''); if(!k) return false; if(notifAttrToastSeen[k]) return false; notifAttrToastSeen[k]=1; notifShowToast(p); return true; }catch(_){ return false; } }
function notifAttrToastOnce(p){ return notifToastOnce(p); }`;

/* ── index.html: hunk 2 — canal notif-toast roteia TODOS os eventos pela guarda única ── */
const IDX_H2_OLD =
  `try{ if(window.desktopAPI&&typeof window.desktopAPI.onNotifToast==='function'){ window.desktopAPI.onNotifToast(function(p){ if(notifIsAttrEvent(p)){ notifAttrToastOnce(p); } else { notifShowToast(p); } try{ if(typeof notifHistoryAppend==='function') notifHistoryAppend(p); }catch(_){} }); } }catch(_){}`;
const IDX_H2_NEW =
  `try{ if(window.desktopAPI&&typeof window.desktopAPI.onNotifToast==='function'){ window.desktopAPI.onNotifToast(function(p){ notifToastOnce(p); try{ if(typeof notifHistoryAppend==='function') notifHistoryAppend(p); }catch(_){} }); } }catch(_){}   /* F3.4.7 — TODOS os eventos passam pela guarda once-por-dedupKey (mesma porta da compensação) */`;

/* ── index.html: hunk 3 — compensação via captura estendida a TODOS os eventos (gate visível) ── */
const IDX_H3_OLD =
  `try{ if(window.desktopAPI&&typeof window.desktopAPI.onNotifHistory==='function'){ window.desktopAPI.onNotifHistory(function(p){ try{ notifHistoryAppend(p); }catch(_){} try{ if(notifIsAttrEvent(p) && (typeof document==='undefined'||document.visibilityState!=='hidden')) notifAttrToastOnce(p); }catch(_){} }); } }catch(_){}`;
const IDX_H3_NEW =
  `try{ if(window.desktopAPI&&typeof window.desktopAPI.onNotifHistory==='function'){ window.desktopAPI.onNotifHistory(function(p){ try{ notifHistoryAppend(p); }catch(_){} try{ if(typeof document==='undefined'||document.visibilityState!=='hidden') notifToastOnce(p); }catch(_){} }); } }catch(_){}   /* F3.4.7 — compensação estendida a TODOS os eventos (era só atribuição); once compartilhado ⇒ nunca duplica */`;

function replaceOnce(text, oldS, newS, tag) {
  const i = text.indexOf(oldS);
  if (i < 0) throw new Error('F3.4.7 authorized-delta: hunk NÃO encontrado no base (' + tag + ')');
  if (text.indexOf(oldS, i + 1) >= 0) throw new Error('F3.4.7 authorized-delta: hunk ambíguo no base (' + tag + ')');
  return text.slice(0, i) + newS + text.slice(i + oldS.length);
}

/** Aplica os 3 hunks do renderer (1.0.183 → atual). Encadeável após os deltas F3.4.5/F3.4.6. */
export function applyF347IndexDelta(text) {
  let t = String(text).replace(/\r\n/g, '\n');
  t = replaceOnce(t, IDX_H1_OLD, IDX_H1_NEW, 'index-h1');
  t = replaceOnce(t, IDX_H2_OLD, IDX_H2_NEW, 'index-h2');
  t = replaceOnce(t, IDX_H3_OLD, IDX_H3_NEW, 'index-h3');
  return t;
}

/** Marcadores de fonte por arquivo TS tocado — prova de intenção da correção (mudança localizada). */
export const F347_MAIN_MARKERS = {
  'desktop/src/main/main.ts': ['function nativeNotify(', 'const markSeen = () =>', 'showBgNotify(p, () => {', 'deliver.bg.noAck→native'],
  'desktop/src/main/firebase.ts': ['firestore.listen.rearm', 'Math.min(5000 * Math.pow(2, attempt - 1), 60000)'],
  'desktop/src/main/bgNotify.ts': ['bg.render.timeout', 'ackArm(', 'showBgNotify(p: any, onNoRender'],
  'desktop/src/main/slaScheduler.ts': ['sla.deliver.retry', '.ok === false'],
};

/** Lista EXATA dos arquivos-fonte tocados pela correção F3.4.7. */
export const F347_SOURCE_FILES = [
  'desktop/src/renderer/index.html',
  'desktop/src/main/main.ts',
  'desktop/src/main/firebase.ts',
  'desktop/src/main/bgNotify.ts',
  'desktop/src/main/slaScheduler.ts',
];

/** Testes re-ancorados por causa do delta AUTORIZADO F3.4.7 (pins de fonte da cadeia de notificação). */
export const F347_REANCHORED_TESTS = [
  'desktop/scripts/f33A-notif-central.test.mjs',
  'desktop/scripts/f33C-assignment-toast.test.mjs',
  'desktop/scripts/f33F-bg-notify.test.mjs',
  'desktop/scripts/f33D-background-notif.test.mjs',
  'desktop/scripts/f33E-main-notifier.test.mjs',
  'desktop/scripts/f33G-editprazo-write.test.mjs',
  'desktop/scripts/f33H-hotfix-ui.test.mjs',
  'desktop/scripts/f3311-baseline-freeze.test.mjs',
  'desktop/scripts/f343-preexisting-registry.test.mjs',
  'desktop/scripts/fixtures/f343/deliver-harness.mjs',
];

/**
 * Predicado ÚNICO do conjunto AUTORIZADO F3.4.7 (fonte + versão + testes re-ancorados + novos f347).
 * Os guards region ANTERIORES (f343..f346) delegam a ESTE predicado a autorização das mudanças da
 * correção — mesmo modelo com que cada hotfix delega ao guard mais novo (a prova de escopo byte-a-byte
 * vive em f347-hotfix-region-invariance). NÃO enfraquece: só relata que a mudança é do escopo F3.4.7.
 */
export function isF347Authorized(rel) {
  if (F347_SOURCE_FILES.includes(rel)) return true;
  if (rel === 'desktop/package.json' || rel === 'desktop/package-lock.json') return true;
  if (F347_REANCHORED_TESTS.includes(rel)) return true;
  if (/^desktop\/scripts\/f347-[^/]+\.mjs$/.test(rel)) return true;
  if (/^desktop\/scripts\/fixtures\/f347\//.test(rel)) return true;
  return false;
}
