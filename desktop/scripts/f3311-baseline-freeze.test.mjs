#!/usr/bin/env node
/* F3.3.11 — BASELINE FREEZE (blindagem anti-regressão).
 *
 * Teste ESTÁTICO e READ-ONLY: lê os fontes aprovados e CONGELA os invariantes da baseline.
 * NÃO altera produto, NÃO roda rede/Firestore/build. Se qualquer funcionalidade aprovada for
 * mexida numa fase futura, este teste FALHA e aponta o quê. Cobre:
 *   A) Card Premium WhatsApp + cache-bust ?v= (somente no link da mensagem)
 *   B) Notificações em background (toast aberto / backgroundNotificationWindow minimizado-bandeja)
 *   C) Worker/OG/card (contrato read-only — detecta alteração indevida do Worker)
 *   D) Central de notificações + SLA laranja/vermelho/crítico
 * Rodar: /opt/node22/bin/node desktop/scripts/f3311-baseline-freeze.test.mjs */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESK = path.resolve(__dirname, '..');
const ROOT = path.resolve(DESK, '..');
const rd = (p) => fs.readFileSync(p, 'utf8');
const DH   = rd(path.join(DESK, 'src', 'renderer', 'index.html'));
const MAIN = rd(path.join(DESK, 'src', 'main', 'main.ts'));
const BG   = rd(path.join(DESK, 'src', 'main', 'bgNotify.ts'));
const FB   = rd(path.join(DESK, 'src', 'main', 'firebase.ts'));
const WK   = rd(path.join(ROOT, 'cloudflare-worker.js'));

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('FAIL:', n); } };

// ===== A) CARD PREMIUM WHATSAPP + CACHE-BUST (?v=) — congelado =====
ok('A1 helper withWhatsAppPreviewBust existe (?/& + v=Date.now())', /function withWhatsAppPreviewBust\(url\)\{[\s\S]*?indexOf\('\?'\)>-1\?'&':'\?'[\s\S]*?'v='\+Date\.now\(\)/.test(DH));
// F3.3.70D3R10AA (HARD RESTORE, ordem do owner): mensagem volta ao regime VALIDADO de 19/06
// (commit 6d46bce — owner: "sem cache-bust agora"). Link ESTAVEL por cliente na mensagem.
ok('A2 buildClientMessage usa o link /share ESTAVEL (sem cache-bust — D3R10AA/6d46bce)', /const url=buildShareClientUrl\(ctx&&ctx\.token\);/.test(DH));
ok('A3 buildShareClientUrl = /share/cronograma/<token> (rota/dominio congelados)', /function buildShareClientUrl\(token\)\{[\s\S]*?CLIENT_LINK_BASE\+'\/share\/cronograma\/'\+t/.test(DH));
ok('A4 [QA] dominio congelado re-baseline p/ host QA (flavor 1.0.170-QA; link publico = Worker QA)', /const CLIENT_LINK_BASE='https:\/\/idseven-push-qa\.agidseven\.workers\.dev'/.test(DH));
// cache-bust SOMENTE no link da mensagem: exatamente 1 call-site (em buildClientMessage)
ok('A5 cache-bust FORA da mensagem (0 call-sites em buildClientMessage — D3R10AA)', (DH.match(/withWhatsAppPreviewBust\(buildShareClientUrl/g)||[]).length === 0);
// o link SALVO no Firestore (clientReviewUrl) NAO leva cache-bust (usa buildPublicClientUrl puro)
// F3.3.73I6C18H — ensureReviewToken virou alias; o corpo real (que monta o link salvo)
// é ensureStableClientReviewToken. A regra congelada continua a MESMA: link salvo via
// buildPublicClientUrl, SEM cache-bust.
const ensureFn = (DH.match(/async function ensureStableClientReviewToken\(taskId\)\{[\s\S]*?\n\}/)||[''])[0];
ok('A6 link salvo (ensureReviewToken) usa buildPublicClientUrl SEM cache-bust', /const url=buildPublicClientUrl\(token\)/.test(ensureFn) && !/withWhatsAppPreviewBust/.test(ensureFn));
ok('A7 preview usa /share (NAO /cliente) — buildClientMessage', /function buildClientMessage\(ctx\)\{[\s\S]*?buildShareClientUrl[\s\S]*?\n\}/.test(DH) && !/buildClientMessage[\s\S]*?\/cliente\/cronograma/.test((DH.match(/function buildClientMessage\(ctx\)\{[\s\S]*?\n\}/)||[''])[0]));

// ===== B) NOTIFICAÇÕES EM BACKGROUND — congelado =====
ok('B1 app aberto/visivel -> TOAST premium (notif-toast, channel toast)', /if \(windowActive\(\)\) \{[\s\S]*?send\("notif-toast", p\)[\s\S]*?channel: "toast"/.test(MAIN));
ok('B2 background -> backgroundNotificationWindow (showBgNotify, channel bg-window)', /const bgOk = showBgNotify\(p\);/.test(MAIN) && /channel = bgOk \? "bg-window"/.test(MAIN));
ok('B3 nativa do Windows = FALLBACK (so se a janela premium falhar)', /if \(!bgOk\) \{[\s\S]*?new Notification\(/.test(MAIN));
ok('B4 windowActive = visivel e nao-minimizado', /isVisible\(\) && !w\.isMinimized\(\)/.test(MAIN));
ok('B5 X/fechar -> bandeja (hide), processo vivo', /on\("close",[\s\S]*?if \(!quitting\)[\s\S]*?mainWin\?\.hide\(\)/.test(MAIN) && /window-all-closed[\s\S]*?preventDefault/.test(MAIN));
ok('B6 clique reabre mainWindow + deep link (initBgNotify)', /initBgNotify\(\([^)]*\) => \{[\s\S]*?w\.show\(\)[\s\S]*?send\("notif-open", deep\)/.test(MAIN));
ok('B7 AUMID setado (toast nativo do Windows)', /setAppUserModelId\("br\.com\.idseven\.agenda\.desktop"\)/.test(MAIN));
ok('B8 Firestore long-polling no MAIN (realtime em background)', /experimentalForceLongPolling: true/.test(FB));
ok('B9 bgNotify: frameless/transparente/alwaysOnTop/skipTaskbar/sem-foco/showInactive', /frame: false/.test(BG) && /transparent: true/.test(BG) && /alwaysOnTop: true/.test(BG) && /skipTaskbar: true/.test(BG) && /focusable: false/.test(BG) && /showInactive\(\)/.test(BG) && /setAlwaysOnTop\(true, "screen-saver"\)/.test(BG));
ok('B10 bgNotify: read-side puro (sem Firestore/rede/write)', !/onSnapshot|collection\(|initializeApp|writeFileSync|\.update\(|fetch\(/.test(BG));

// ===== C) WORKER / OG / CARD — contrato read-only (detecta alteracao indevida do Worker) =====
ok('C1 Worker: rota GET /share/cronograma/<token> -> shareCardHtml (por pathname; ignora ?v=)', /url\.pathname\.match\(\/\^\\\/share\\\/cronograma\\\//.test(WK) && /shareCardHtml\(url\.origin, shareMatch\[1\]\)/.test(WK));
ok('C2 Worker: og:image versionado /og/wa-card-v64-38.jpg', /const OG_IMG_PATH = "\/og\/wa-card-v64-38\.jpg"/.test(WK));
ok('C3 Worker: og:image dimensoes 1200x630 + secure_url + type image/jpeg', /og:image:width" content="1200"/.test(WK) && /og:image:height" content="630"/.test(WK) && /og:image:secure_url/.test(WK) && /og:image:type" content="image\/jpeg"/.test(WK));
ok('C4 Worker: twitter summary_large_image (card grande)', /twitter:card" content="summary_large_image"/.test(WK));

// ===== D) CENTRAL + SLA — congelado =====
ok('D1 captura p/ Central (notif-history) ANTES da decisao de canal', /send\("notif-history", p\)[\s\S]*?if \(windowActive\(\)\)/.test(MAIN));
ok('D2 SLA laranja/vermelho/critico (notifScanSla + severidades)', /function notifScanSla\(\)/.test(DH) && /sla_warning/.test(DH) && /sla_overdue/.test(DH) && /sla_critical/.test(DH));
ok('D3 Central de Notificacoes (historico local) presente', /function notifHistoryAppend\(/.test(DH));

console.log('\nF3.3.11 BASELINE FREEZE: ' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { console.error('::error:: baseline congelada divergiu — uma funcionalidade APROVADA foi alterada'); process.exit(1); }
console.log('OK — baseline aprovada CONGELADA: cache-bust WhatsApp (so na msg) + notificacoes background (toast/bg-window) + Worker/OG/card intactos + Central/SLA intactos.');
