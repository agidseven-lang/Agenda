#!/usr/bin/env node
/* F3.3.10-DESKTOP FASE B — TESTE da Central de Notificações & Histórico (local, read-side).
 * Extrai o bloco F3.3.10-NOTIF-CENTRAL do renderer (store/dedup/lida/filtros) e exercita com
 * localStorage stub em memória. Prova estática: captura é CAPTURE-ONLY (sem escrita/provider) no
 * renderer, no main.ts (webContents.send 'notif-history' em try/catch, sem alterar entrega) e no
 * preload (onNotifHistory). Puro: sem DOM real, sem rede, sem Firestore.
 * Rodar: /opt/node22/bin/node desktop/scripts/f33A-notif-central.test.mjs */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = path.resolve(__dirname, '..', 'src');
const html = fs.readFileSync(path.resolve(R, 'renderer', 'index.html'), 'utf8');
const mainTs = fs.readFileSync(path.resolve(R, 'main', 'main.ts'), 'utf8');
const preloadTs = fs.readFileSync(path.resolve(R, 'preload', 'preload.ts'), 'utf8');
globalThis.fetch = () => { throw new Error('PROVIDER-CALL-DETECTED'); };

const bi = html.indexOf('F3.3.10-NOTIF-CENTRAL BEGIN'), ei = html.indexOf('F3.3.10-NOTIF-CENTRAL END');
if (bi < 0 || ei < 0) { console.error('::error:: sentinela NOTIF-CENTRAL ausente'); process.exit(1); }
const block = html.slice(html.lastIndexOf('/*', bi), html.indexOf('*/', ei) + 2);

const api = new Function(
  'var window={};var store={};' +
  'var localStorage={getItem:function(k){return (k in store)?store[k]:null;},setItem:function(k,v){store[k]=String(v);},removeItem:function(k){delete store[k];}};' +
  'var document={getElementById:function(){return null;},createElement:function(){return {};},head:{appendChild:function(){}}};' +
  'var state={tab:"tarefas",users:[]};' +
  'function esc(s){return s==null?"":String(s);}function svg(){return "";}function userColor(){return "#000";}function initials(n){return (n||"?").slice(0,2);}function notifRoute(){}' +
  block + '\n' +
  'return {append:notifHistoryAppend,load:notifHistoryLoad,unread:notifHistoryUnread,markRead:notifHistoryMarkRead,markAll:notifHistoryMarkAll,clear:notifHistoryClear,filter:notifHistoryFilter,typeLabel:notifTypeLabel,dayLabel:ncDayLabel,setFilters:function(f){notifCentralFilters=Object.assign({tipo:"",sev:"",designer:"",cliente:"",q:""},f||{});},getKey:function(){return NOTIF_HIST_KEY;},rawStore:function(){return store;}};'
)();

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL:', n); } };
const eq = (n, a, b) => ok(n + ' (=' + b + ', obtido ' + a + ')', a === b);

const NOW = Date.now();   // recente: o append poda itens > 30 dias (TTL real via Date.now())
const P = (o) => Object.assign({ taskId: 't' + Math.random(), createdAt: NOW, action: {} }, o);
api.clear();

// ── entram no histórico (tipos) ──
api.append(P({ eventType: 'designer_assigned', dedupKey: 'designer_assigned:t1', title: 'Nova tarefa atribuída', taskId: 't1', action: { deep: 'detail/t1' } }));
api.append(P({ eventType: 'sla_warning', dedupKey: 'sla_warning:t2', title: 'prazo próximo', severity: 'warning', taskId: 't2' }));
api.append(P({ eventType: 'sla_overdue', dedupKey: 'sla_overdue:t3', title: 'prazo encerrado', severity: 'critical', taskId: 't3' }));
api.append(P({ eventType: 'sla_critical', dedupKey: 'sla_critical:t4', title: 'atraso crítico', severity: 'critical', taskId: 't4', status: 'overdue' }));
api.append(P({ eventType: 'flow_designer_delivered', dedupKey: 'flow_designer_delivered:t5', title: 'Designer entregou', severity: 'success', taskId: 't5' }));
eq('5 notificações no histórico', api.load().length, 5);
eq('tipo: designer_assigned => Atribuição', api.typeLabel({ eventType: 'designer_assigned' }), 'Atribuição');
eq('tipo: sla_warning => SLA', api.typeLabel({ eventType: 'sla_warning' }), 'SLA');
eq('tipo: operational_block => SLA', api.typeLabel({ eventType: 'operational_block' }), 'SLA');
eq('tipo: flow_* => Fluxo', api.typeLabel({ eventType: 'flow_completed' }), 'Fluxo');
eq('tipo: desconhecido => Sistema', api.typeLabel({ eventType: 'whatever' }), 'Sistema');

// ── dedup ──
api.append(P({ eventType: 'sla_warning', dedupKey: 'sla_warning:t2', title: 'DUP', severity: 'warning', taskId: 't2' }));
eq('dedup impede duplicação (segue 5)', api.load().length, 5);

// ── lida/não lida + contador ──
eq('5 não lidas', api.unread(), 5);
api.markRead('sla_warning:t2');
eq('após markRead: 4 não lidas', api.unread(), 4);
api.markAll();
eq('após markAll: 0 não lidas', api.unread(), 0);

// ── filtros + busca ──
api.setFilters({ tipo: 'SLA' });
eq('filtro tipo=SLA => 3', api.filter(api.load()).length, 3);
api.setFilters({ sev: 'critical' });
eq('filtro sev=critical => 2', api.filter(api.load()).length, 2);
api.setFilters({ q: 'entregou' });
eq('busca "entregou" => 1', api.filter(api.load()).length, 1);
api.setFilters({});
eq('sem filtro => 5', api.filter(api.load()).length, 5);

// ── limpar ──
api.clear();
eq('clear => 0', api.load().length, 0);

// ── retenção: cap 300 ──
for (let i = 0; i < 320; i++) api.append(P({ eventType: 'flow_x', dedupKey: 'k' + i, title: 't' + i, taskId: 'x' + i }));
ok('retenção: cap em 300 itens', api.load().length === 300);
// ── retenção: TTL 30 dias (item antigo é podado) ──
api.clear();
api.append(P({ eventType: 'flow_x', dedupKey: 'old', title: 'antigo', createdAt: NOW - 40 * 24 * 3600 * 1000, taskId: 'old' }));
eq('item > 30 dias é podado (0)', api.load().length, 0);

// ── store: só localStorage com a chave esperada ──
ok('store usa idseven.notif.history.v1', api.getKey() === 'idseven.notif.history.v1' && ('idseven.notif.history.v1' in api.rawStore()));

// ── invariantes estáticas: CAPTURE-ONLY, zero escrita/provider ──
ok('NOTIF-CENTRAL não tem .set(', !/\.set\(/.test(block));
ok('NOTIF-CENTRAL não tem .update(', !/\.update\(/.test(block));
ok('NOTIF-CENTRAL não tem setDoc/addDoc/deleteDoc/updateDoc', !/(setDoc|addDoc|deleteDoc|updateDoc)\b/.test(block));
ok('NOTIF-CENTRAL não chama Firestore/db.collection', !/db\.collection|firestore\(/.test(block));
ok('NOTIF-CENTRAL não chama fetch', !/\bfetch\(/.test(block));
ok('NOTIF-CENTRAL persiste só em localStorage', /localStorage\.setItem\(NOTIF_HIST_KEY/.test(block) && !/sessionStorage|indexedDB/.test(block));

// ── captura renderer (hooks) ──
ok('notifEmit captura no histórico (capture-only)', /if\(delivered\)\{ try\{ if\(typeof notifHistoryAppend==='function'\) notifHistoryAppend\(p\); \}catch\(_\)\{\} \}/.test(html));
ok('onNotifToast também captura no histórico', /onNotifToast\(function\(p\)\{[\s\S]*?if\(typeof notifHistoryAppend==='function'\) notifHistoryAppend\(p\);/.test(html));
// F3.4.7 — RE-ÂNCORA AUTORIZADA: o canal notif-toast passa a rotear TODOS os eventos pela guarda
// única once-por-dedupKey (notifToastOnce) — o toast premium segue idêntico; muda só a porta.
ok('toast premium via guarda única once-por-dedupKey (notifToastOnce)', /onNotifToast\(function\(p\)\{ notifToastOnce\(p\);/.test(html) && /function notifToastOnce\(p\)\{[\s\S]*?notifShowToast\(p\)/.test(html));
// F3.3.10-FIX — toast de atribuição (Social → Designer): compensação cirúrgica, deduplicada, escopada
ok('compensação: notifAttrToastOnce chama notifShowToast', /function notifAttrToastOnce\(p\)\{[\s\S]*?notifShowToast\(p\)/.test(html));
ok('compensação: só designer_assigned/task_assigned', /function notifIsAttrEvent\(p\)\{ var e=p&&p\.eventType; return e==='designer_assigned'\|\|e==='task_assigned'; \}/.test(html));
ok('compensação: dedup por dedupKey (não duplica)', /if\(notifAttrToastSeen\[k\]\) return false; notifAttrToastSeen\[k\]=1;/.test(html));
// F3.4.7 — RE-ÂNCORA AUTORIZADA: a compensação via captura cobre TODOS os eventos (era só atribuição),
// mantendo o gate de janela visível (minimizado/bandeja = nativa/bg-window). Corrige a amarela/vermelha
// que o canal notif-toast às vezes não renderizava com a janela aberta.
ok('compensação (captura) p/ todos os eventos só com janela visível', /onNotifHistory\(function\(p\)\{[\s\S]*?if\(typeof document==='undefined'\|\|document\.visibilityState!=='hidden'\) notifToastOnce\(p\)/.test(html));
ok('tab Notificações aditiva', /\{k:'notificacoes',l:'Notifica[çc][õo]es',i:'bell'\}/.test(html));
ok('render() roteia notificacoes', /else if\(state\.tab==='notificacoes'\)\{c\.innerHTML=renderNotifCentral\(\);afterNotifCentral\(\);\}/.test(html));
ok('badge de não-lidas no nav (aditivo)', /notifNavBadge\(t\.k\)/.test(html));

// ── captura main.ts: capture-only ──
ok('main.ts encaminha notif-history (capture)', /webContents\.send\("notif-history", p\)/.test(mainTs));
ok('main.ts captura em try/catch (não afeta entrega)', /try \{ mainWin\?\.webContents\.send\("notif-history", p\); \} catch/.test(mainTs));
ok('main.ts: toast premium aprovado intacto', /webContents\.send\("notif-toast", p\)/.test(mainTs) && /channel: "toast"/.test(mainTs));
// F3.4.7 — RE-ÂNCORA AUTORIZADA: showBgNotify agora recebe onNoRender (fallback do no-ACK); a janela
// premium segue primária (bg-window) e a nativa (nativeNotify) segue como fallback.
ok('main.ts: nativa preservada como FALLBACK + janela premium primaria (bg-window)', /new Notification\(/.test(mainTs) && /showBgNotify\(p, \(\) => \{/.test(mainTs) && /"bg-window"/.test(mainTs));
ok('main.ts: windowActive (regra de canal) intacta', /function windowActive\(\)/.test(mainTs) && /isVisible\(\) && !w\.isMinimized\(\)/.test(mainTs));
ok('main.ts: backgroundThrottling:false (timers em background)', /backgroundThrottling:\s*false/.test(mainTs));
ok('main.ts: switches anti-backgrounding (SLA confiável minimizado/bandeja)', /disable-background-timer-throttling/.test(mainTs) && /disable-renderer-backgrounding/.test(mainTs) && /disable-backgrounding-occluded-windows/.test(mainTs));
ok('main.ts: setAppUserModelId (toast nativo Windows confiável)', /setAppUserModelId\("br\.com\.idseven\.agenda\.desktop"\)/.test(mainTs));
ok('preload expõe onNotifHistory', /onNotifHistory:\s*\(cb/.test(preloadTs));
ok('preload: onNotifToast aprovado intacto', /onNotifToast:\s*\(cb/.test(preloadTs));

console.log(`\nF3.3.10 NOTIF-CENTRAL: ${pass} PASS / ${fail} FAIL`);
if (fail) { console.error('::error:: central de notificações divergiu do contrato'); process.exit(1); }
console.log('OK — histórico local determinístico (dedup/lida/filtros/busca/retenção); captura CAPTURE-ONLY no renderer/main/preload; toast premium e nativa aprovados intactos; zero escrita/provider/Firestore.');
