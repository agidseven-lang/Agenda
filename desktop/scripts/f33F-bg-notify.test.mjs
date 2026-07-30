#!/usr/bin/env node
/* F3.3.10-BG — TESTE: backgroundNotificationWindow (camada própria de notificação em background).
 *
 * Prova (estático, sobre o FONTE real) que a entrega em background NÃO depende só da nativa do SO:
 *  - bgNotify.ts cria janela frameless/transparente/alwaysOnTop("screen-saver")/skipTaskbar/sem foco,
 *    no canto inferior direito (workArea/DPI), showInactive (não rouba foco), auto-resize, IPC
 *    (open/resize/empty/rendered), carrega bgnotify.html;
 *  - bgnotify.html renderiza o card PREMIUM (atribuição + SLA), CTA "Abrir tarefa", auto-dismiss,
 *    dedup, reporta altura e esvazia;
 *  - bgnotify-preload expõe a bridge bgAPI;
 *  - main.ts roteia o BACKGROUND para showBgNotify (primário) e mantém a nativa como FALLBACK,
 *    com initBgNotify (reabrir mainWindow + deep link) e stopBgNotify no realQuit;
 *  - Central (notif-history) e dedup (_notifSeen) seguem cobrindo o canal bg.
 * Puro Node (sem Chromium/electron): rapido e CI-safe.
 * Rodar: /opt/node22/bin/node desktop/scripts/f33F-bg-notify.test.mjs */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = path.resolve(__dirname, '..', 'src');
const bg = fs.readFileSync(path.resolve(R, 'main', 'bgNotify.ts'), 'utf8');
const html = fs.readFileSync(path.resolve(R, 'renderer', 'bgnotify.html'), 'utf8');
const pre = fs.readFileSync(path.resolve(R, 'preload', 'bgnotify-preload.ts'), 'utf8');
const mainTs = fs.readFileSync(path.resolve(R, 'main', 'main.ts'), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL:', n); } };

// ── bgNotify.ts: janela ──
ok('bg: BrowserWindow frameless', /frame:\s*false/.test(bg));
ok('bg: transparente', /transparent:\s*true/.test(bg));
ok('bg: skipTaskbar (não aparece na barra)', /skipTaskbar:\s*true/.test(bg));
ok('bg: focusable:false (não rouba foco)', /focusable:\s*false/.test(bg));
ok('bg: resizable:false', /resizable:\s*false/.test(bg));
ok('bg: alwaysOnTop + nível screen-saver (acima de outras janelas)', /alwaysOnTop:\s*true/.test(bg) && /setAlwaysOnTop\(true,\s*"screen-saver"\)/.test(bg));
ok('bg: showInactive (mostra sem ativar/roubar foco)', /showInactive\(\)/.test(bg));
ok('bg: canto inferior direito via workArea (respeita DPI/escala)', /screen\.getPrimaryDisplay\(\)\.workArea/.test(bg) && /wa\.width\s*-\s*WIDTH/.test(bg) && /wa\.height\s*-\s*height/.test(bg));
ok('bg: carrega bgnotify.html', /loadFile\([\s\S]*?"bgnotify\.html"/.test(bg));
ok('bg: preload dedicado bgnotify-preload.js', /"bgnotify-preload\.js"/.test(bg));
ok('bg: IPC open/resize/empty/rendered', /ipcMain\.on\("bgnotify-open"/.test(bg) && /ipcMain\.on\("bgnotify-resize"/.test(bg) && /ipcMain\.on\("bgnotify-empty"/.test(bg) && /ipcMain\.on\("bgnotify-rendered"/.test(bg));
ok('bg: envia card via "bg-card"', /webContents\.send\("bg-card",\s*p\)/.test(bg));
ok('bg: exports showBgNotify/initBgNotify/stopBgNotify', /export function showBgNotify/.test(bg) && /export function initBgNotify/.test(bg) && /export function stopBgNotify/.test(bg));
ok('bg: read-side puro (sem Firestore/rede/write)', !/onSnapshot|collection\(|initializeApp|writeFileSync|\.update\(|\.add\(\{|fetch\(/.test(bg));

// ── bgnotify-preload.ts ──
ok('preload: expõe bgAPI', /exposeInMainWorld\("bgAPI"/.test(pre));
ok('preload: onCard/resize/empty/open/rendered', /onCard:/.test(pre) && /resize:/.test(pre) && /empty:/.test(pre) && /open:/.test(pre) && /rendered:/.test(pre));

// ── bgnotify.html: card premium ──
ok('html: card premium (.ntf-card) + barra de severidade', /\.ntf-card\{/.test(html) && /\.ntf-critical\{/.test(html) && /\.ntf-warning\{/.test(html));
ok('html: atribuição "atribuiu uma tarefa"', /atribuiu uma tarefa/.test(html));
ok('html: CTA "Abrir tarefa" -> bgAPI.open', /Abrir tarefa/.test(html) && /bgAPI\.open/.test(html));
ok('html: auto-dismiss por severidade (crit 11s / warn 8s / info 6s)', /11000/.test(html) && /8000/.test(html) && /6000/.test(html));
ok('html: dedup de cards (seen)', /seen\[key\]/.test(html));
ok('html: reporta altura (bgAPI.resize) e esvazia (bgAPI.empty)', /bgAPI\.resize/.test(html) && /bgAPI\.empty/.test(html));
ok('html: foto real ou iniciais (avatar)', /background-image:url/.test(html) && /initials\(/.test(html));
ok('html: prova de render (bgAPI.rendered)', /bgAPI\.rendered/.test(html));

// ── main.ts: roteamento ──
ok('main: importa bgNotify', /import \{[\s\S]*?\} from "\.\/bgNotify"/.test(mainTs) && /showBgNotify/.test(mainTs) && /initBgNotify/.test(mainTs) && /stopBgNotify/.test(mainTs));
ok('main: app aberto/visível mantém TOAST premium', /if \(windowActive\(\)\) \{[\s\S]*?send\("notif-toast", p\)[\s\S]*?channel: "toast"/.test(mainTs));
// F3.4.7 — RE-ÂNCORA AUTORIZADA: showBgNotify agora recebe onNoRender (fallback do no-ACK). A janela
// premium segue PRIMÁRIA em background; deixou de ser otimista — sem prova de render (ACK), cai p/ a nativa.
ok('main: background -> showBgNotify (primário, com fallback no-ACK)', /const bgOk = showBgNotify\(p, \(\) => \{/.test(mainTs));
// F3.4.7 — a nativa (helper nativeNotify) é FALLBACK: imediato quando a janela premium falha (!bgOk)
// E tardio quando a premium foi agendada mas não provou render (no-ACK → onNoRender chama nativeNotify).
ok('main: nativa do Windows é FALLBACK (bg indisponível OU sem prova de render)',
  /if \(!bgOk\) nativeOk = nativeNotify\(p, key, deep\);/.test(mainTs)
  && /const lateOk = nativeNotify\(p, key, deep\);/.test(mainTs)
  && /function nativeNotify\([\s\S]*?new Notification\(/.test(mainTs));
ok('main: canal bg-window', /channel = bgOk \? "bg-window"/.test(mainTs));
ok('main: initBgNotify delega a bringToFrontAndOpen (traz à frente + deep-link) — F3.5.4K', /initBgNotify\(\([^)]*\) => \{[\s\S]*?bringToFrontAndOpen\(deep\)/.test(mainTs));
ok('main: stopBgNotify no realQuit', /function realQuit\(\)[\s\S]*?stopBgNotify\(\)/.test(mainTs));
ok('main: Central (notif-history) cobre o canal bg (antes da decisão)', /send\("notif-history", p\)[\s\S]*?if \(windowActive\(\)\)/.test(mainTs));
ok('main: dedup _notifSeen segue guardando antes do canal', /_notifSeen\.has\(key\)[\s\S]*?_notifSeen\.add\(key\)/.test(mainTs));

console.log('\nF3.3.10-BG BACKGROUND-WINDOW: ' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { console.error('::error:: backgroundNotificationWindow divergiu do contrato'); process.exit(1); }
console.log('OK — janela premium própria em background (frameless/alwaysOnTop/sem foco, canto inf. dir.), card premium + CTA, nativa = fallback, Central + dedup cobertos. App aberto mantém toast premium.');
