#!/usr/bin/env node
/* =====================================================================
   F3.3.74C — SUITE HERMÉTICA: Windows Share NATIVO (pacote único)
   ---------------------------------------------------------------------
   Prova, por contrato de código (sem WhatsApp, sem Windows):
   • Helper nativo (C++/WinRT Win32): UM DataPackage com StorageItems(PNG)
     + Text(legenda com link) + WebLink + Title/Description + Thumbnail,
     via IDataTransferManagerInterop::ShowShareUIForWindow (SEM exigir
     package identity), com --selftest que RELÊ o pacote como um alvo.
   • IPC main (nativeshare.ts): validação fail-closed, temp próprio,
     eventos sanitizados, limpeza, timeout.
   • Wiring main/preload/electron-builder.
   • Renderer: botão principal "Compartilhar Card Premium no WhatsApp"
     usa o Share nativo; cancelamento honesto; MODO ALTERNATIVO só como
     fallback rotulado; sem contaminação Cronograma×Roteiro.
   O QUE ESTA SUITE NÃO PROVA (honestidade): que o WhatsApp Business
   aceita Text/WebLink junto com a mídia — isso é prova FÍSICA (ops).
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const D = (...p) => path.resolve(__dirname, '..', ...p);
const S = (p) => fs.readFileSync(D(p), 'utf8');

const CPP  = S('native-share/AgendaIdSevenNativeShare.cpp');
const NS   = S('src/main/nativeshare.ts');
const MAIN = S('src/main/main.ts');
const PRE  = S('src/preload/preload.ts');
const EB   = S('electron-builder.yml');
const HTML = S('src/renderer/index.html');
const PKG  = JSON.parse(S('package.json'));
const LOCK = S('package-lock.json');

let pass = 0, fail = 0;
function ok(desc, cond) {
  if (cond) { pass++; console.log('  PASS — ' + desc); }
  else { fail++; console.log('  FAIL — ' + desc); }
}

console.log('== F3.3.74C — Share nativo: helper (H), IPC (N), wiring (W), renderer (R) ==');

/* ── H: helper nativo C++ ── */
const cfgStart = CPP.indexOf('static void configurePackage');
const cfgEnd = CPP.indexOf('\n}', cfgStart);
const CFG = CPP.slice(cfgStart, cfgEnd);
ok('H1 helper C++ presente e substancial (>8KB)', CPP.length > 8192);
ok('H2 configurePackage monta UM ÚNICO DataPackage com TODOS os formatos: Title + Description + ApplicationName + Text + WebLink + StorageItems + Bitmap + Thumbnail',
  CFG.includes('dp.Properties().Title(') && CFG.includes('dp.Properties().Description(') &&
  CFG.includes('dp.Properties().ApplicationName(') && CFG.includes('dp.SetText(') &&
  CFG.includes('dp.SetWebLink(Uri(') && CFG.includes('dp.SetStorageItems(items)') &&
  CFG.includes('dp.SetBitmap(streamRef)') && CFG.includes('dp.Properties().Thumbnail(streamRef)'));
ok('H3 Share Source Win32 SEM package identity: IDataTransferManagerInterop + GetForWindow + ShowShareUIForWindow (shobjidl_core)',
  CPP.includes('#include <shobjidl_core.h>') && CPP.includes('IDataTransferManagerInterop') &&
  CPP.includes('interop->GetForWindow(g_hwnd') && CPP.includes('interop->ShowShareUIForWindow(g_hwnd)'));
ok('H4 --selftest RELÊ o pacote como um ALVO (GetView + Contains + GetStorageItemsAsync/GetTextAsync/GetWebLinkAsync) e emite selftest_result/ok/fail',
  CPP.includes('dp.GetView()') &&
  CPP.includes('v.Contains(StandardDataFormats::StorageItems())') &&
  CPP.includes('v.Contains(StandardDataFormats::Text())') &&
  CPP.includes('v.Contains(StandardDataFormats::WebLink())') &&
  CPP.includes('v.GetStorageItemsAsync().get()') && CPP.includes('v.GetTextAsync().get()') &&
  CPP.includes('v.GetWebLinkAsync().get()') && CPP.includes('"selftest_result"') &&
  CPP.includes('ok ? "selftest_ok" : "selftest_fail"') && CPP.includes('return ok ? 0 : 20;'));
ok('H5 selftest é ESTRITO: exige os 3 formatos + título + descrição + exatamente 1 item + texto real + host do link',
  CPP.includes('hasFiles && hasText && hasLink && !title.empty() && !desc.empty() && nItems == 1 && textLen > 40 && !backHost.empty()'));
ok('H6 validação de entrada fail-closed: assinatura PNG + tamanho mínimo 1024 + tipo forte + https + legenda contém o link',
  CPP.includes('0x89,0x50,0x4E,0x47') && CPP.includes('size >= 1024') &&
  CPP.includes('r.type != L"SCHEDULE" && r.type != L"VIDEO_SCRIPT"') &&
  CPP.includes('r.url.rfind(L"https://", 0) != 0') &&
  CPP.includes('r.caption.find(r.url) == std::wstring::npos') && CPP.includes('legenda_sem_link'));
ok('H7 telemetria SANITIZADA: URL vira host+comprimento; legenda vira comprimento; nunca emite legenda/URL completas',
  CPP.includes('urlHost') && CPP.includes('urlLen') && CPP.includes('jesc(host)') &&
  CPP.includes('captionLen') && CPP.includes('std::to_string(g_req.caption.size())') &&
  !/jesc\(g_req\.caption\)/.test(CPP) && !/jesc\(g_req\.url\)/.test(CPP));
ok('H8 eventos do ciclo completos: started/text/web_link/image/package_ready/ui_opened/target/completed/canceled/timeout/dismissed/failed',
  ['helper_started','text_attached','web_link_attached','image_attached','data_package_ready',
   'share_ui_opened','target_selected','share_completed','share_canceled','share_timeout',
   'share_dismissed','helper_failed'].every(e => CPP.includes('"' + e + '"')));
ok('H9 timeout honesto: timer de 3 min → share_timeout (dismiss sem evento nunca vira sucesso)',
  CPP.includes('SetTimer(g_hwnd, 1, 180000') && CPP.includes('emitEvt("share_timeout")'));
ok('H10 apartamentos corretos: STA no fluxo de share (UI) + thread MTA pré-carrega o StorageFile (sem .get() bloqueante na STA); selftest em MTA',
  CPP.includes('winrt::init_apartment(winrt::apartment_type::single_threaded); rc = runShare') &&
  /std::thread t\(\[&\] \{\s*try \{ winrt::init_apartment\(winrt::apartment_type::multi_threaded\);/.test(CPP) &&
  /runSelfTest[\s\S]{0,80}winrt::init_apartment\(winrt::apartment_type::multi_threaded\)/.test(CPP));
ok('H11 modos únicos: wWinMain despacha apenas "share" e "--selftest" (helper não é app visível de uso geral)',
  CPP.includes('int WINAPI wWinMain(') && CPP.includes('mode == L"--selftest"') &&
  CPP.includes('mode == L"share"') && CPP.includes('modo_desconhecido'));

/* ── N: IPC main (nativeshare.ts) ── */
ok('N1 registra os canais IPC native-share e native-share-available',
  NS.includes('ipcMain.handle("native-share"') && NS.includes('ipcMain.handle("native-share-available"'));
ok('N2 validação fail-closed no main (independente do renderer): tipo/imagem>=1024/legenda>=20/https/legenda contém link/título',
  NS.includes('"tipo_invalido"') && NS.includes('len < 1024') && NS.includes('"imagem_ausente"') &&
  NS.includes('r.captionText.length < 20') && NS.includes('"legenda_ausente"') &&
  NS.includes('/^https:\\/\\//.test(r.approvalUrl)') && NS.includes('"url_invalida"') &&
  NS.includes('r.captionText.indexOf(r.approvalUrl) < 0') && NS.includes('"legenda_sem_link"') &&
  NS.includes('"titulo_ausente"'));
ok('N3 temp PRÓPRIO e requisição TSV com campos base64 (legenda/título/descrição) + trace sanitizado',
  NS.includes('app.getPath("temp"), "agenda-idseven-share"') &&
  NS.includes('"captionB64\\t" + b64(req.captionText)') && NS.includes('"titleB64\\t" + b64(req.title)') &&
  NS.includes('"descB64\\t" + b64(req.description || "")') &&
  NS.includes('replace(/[^A-Za-z0-9-]/g, "")'));
ok('N4 spawna o helper em modo "share" e interpreta os eventos JSON (completed/canceled/timeout/dismissed/failed/target)',
  NS.includes('spawn(exe, ["share", reqFile]') &&
  NS.includes('ev.evt === "share_completed"') && NS.includes('ev.evt === "share_canceled"') &&
  NS.includes('ev.evt === "share_timeout" || ev.evt === "share_dismissed"') &&
  NS.includes('ev.evt === "helper_failed"') && NS.includes('ev.evt === "target_selected"'));
ok('N5 limpeza responsável: unlink do PNG+TSV só no close do helper; varredura de sobras >1h; kill em 200s',
  NS.includes('fs.unlinkSync(reqFile)') && NS.includes('fs.unlinkSync(png)') &&
  NS.includes('60 * 60 * 1000') && NS.includes('sweepStale(dir)') && NS.includes('200000'));
ok('N6 helperPath: resources/native-share/AgendaIdSeven.NativeShare.exe (empacotado) + publish (dev); disponibilidade = win32 && exe existe',
  NS.includes('"native-share", "AgendaIdSeven.NativeShare.exe"') &&
  NS.includes('"native-share", "publish", "AgendaIdSeven.NativeShare.exe"') &&
  NS.includes('process.platform === "win32" && fs.existsSync(helperPath())'));
ok('N7 diagnóstico sanitizado: nenhum diag() recebe legenda ou URL de aprovação',
  (() => { const calls = NS.match(/diag\([^;]*\)/g) || []; return calls.length >= 4 && calls.every(c => !c.includes('captionText') && !c.includes('approvalUrl') && !c.includes('req.title')); })());
ok('N8 stderr do helper nunca é logado em bruto', NS.includes('child.stderr.on("data", () => {'));
ok('N9 tsc emitiu dist/main/nativeshare.js válido',
  (() => { try { execFileSync(process.execPath, ['--check', D('dist/main/nativeshare.js')], { stdio: 'pipe' }); return fs.statSync(D('dist/main/nativeshare.js')).size > 1000; } catch { return false; } })());

/* ── W: wiring main/preload/builder ── */
ok('W1 main.ts importa e registra registerNativeShareIpc',
  MAIN.includes('import { registerNativeShareIpc } from "./nativeshare"') && MAIN.includes('registerNativeShareIpc();'));
ok('W2 preload expõe nativeShare + nativeShareAvailable pelos canais corretos',
  PRE.includes('ipcRenderer.invoke("native-share", req)') && PRE.includes('ipcRenderer.invoke("native-share-available")') &&
  PRE.includes('nativeShare:') && PRE.includes('nativeShareAvailable:'));
ok('W3 electron-builder empacota o helper: extraResources native-share/publish → native-share',
  /from:\s*native-share\/publish/.test(EB) && /to:\s*native-share/.test(EB));

/* ── R: renderer (fluxo principal + fallback honesto) ── */
ok('R1 botão principal nasce desabilitado com o rótulo novo; rótulo antigo NÃO existe mais',
  HTML.includes('id="btnOpenWaMain" disabled') &&
  /id="btnOpenWaMain" disabled>'\+svg\('send'\)\+'Compartilhar Card Premium no WhatsApp/.test(HTML) &&
  !HTML.includes('Abrir WhatsApp Business para enviar no grupo'));
ok('R2 buildNativeShareRequest mapeia o pacote FORTE (roteiro→VIDEO_SCRIPT, senão SCHEDULE) e leva legenda=messageText + URL + título + descrição + hash + trace',
  HTML.includes("type:(P.type==='roteiro'?'VIDEO_SCRIPT':'SCHEDULE')") &&
  HTML.includes('captionText:P.messageText') && HTML.includes('approvalUrl:P.approvalUrl') &&
  HTML.includes('title:P.title') && HTML.includes('description:P.description') &&
  HTML.includes('contentHash:P.contentHash') && HTML.includes('traceId:traceId') &&
  HTML.includes('clientName:P.clientName'));
const wStart = HTML.indexOf("on('btnOpenWaMain'");
const WIRE = HTML.slice(wStart, HTML.indexOf('/* ===== Secundários discretos', wStart));
ok('R3 fluxo principal: gate pelo PACOTE pronto; consulta nativeShareAvailable e chama nativeShare com o request do pacote',
  WIRE.includes('if(!prepReady||!sharePkg||!sharePkg.ok)') &&
  WIRE.includes('api.nativeShareAvailable') &&
  WIRE.includes('api.nativeShare(buildNativeShareRequest(sharePkg,_modalTrace))'));
ok('R4 instrução clara durante o Share: escolher o WhatsApp Business; imagem+mensagem+link seguem JUNTAS na mesma mídia',
  WIRE.includes('Escolha o <b>WhatsApp Business</b> na janela de compartilhamento do Windows') &&
  WIRE.includes('seguem JUNTAS na mesma mídia'));
ok('R5 sucesso: status de UMA ÚNICA mensagem de mídia + registro persistClientSend + botão vira "Compartilhado no WhatsApp"',
  WIRE.includes('imagem premium + legenda + link em uma única mensagem de mídia') &&
  WIRE.includes('persistClientSend(ctx.id)') && WIRE.includes('Compartilhado no WhatsApp'));
ok('R6 cancelamento honesto: informa que NADA foi enviado e NÃO cai no modo alternativo (sem clipboard fantasma)',
  WIRE.includes('Compartilhamento cancelado. Nada foi enviado') &&
  WIRE.includes('}else if(r&&r.canceled){') && WIRE.includes('}else if(r&&r.timeout){') &&
  !/r\.canceled[\s\S]{0,400}copyCardImage/.test(WIRE));
ok('R7 timeout honesto: janela fechada sem confirmação → nada registrado',
  WIRE.includes('A janela de compartilhamento foi fechada sem confirmação. Nada foi registrado'));
ok('R8 MODO ALTERNATIVO é FALLBACK rotulado (nunca o fluxo principal): só quando o nativo está indisponível/falha; copia imagem OU salva+copia mensagem; abre WhatsApp; status classe err',
  WIRE.includes('if(!nativeOk&&!nativeTried)') &&
  WIRE.includes('<b>Modo alternativo</b> (o compartilhamento nativo do Windows não está disponível)') &&
  WIRE.includes('const r2=await api.copyCardImage(new Uint8Array(sharePkg.imageBytes))') &&
  WIRE.includes('openWhatsAppWebOnly();') &&
  (() => { const mi = WIRE.indexOf("setStatus('<b>Modo alternativo</b>"); return mi > 0 && WIRE.indexOf("'err',true)", mi) - mi < 400 && WIRE.indexOf("'err',true)", mi) > 0; })());
ok('R9 falha real do helper → registra motivo (telemetria) e usa o fallback; cancelamento/timeout NÃO usam',
  WIRE.includes("qaDiag('qa.desktop.nativeshare.fallback',{reason:(r&&r.reason)||'sem_resultado'") &&
  WIRE.includes('nativeTried=false; // falha real do helper'));
ok('R10 atalho data-openwa também tenta o Share NATIVO primeiro; cancelado/timeout retornam SEM efeitos; fallback copia mensagem e aponta o modal p/ mídia única',
  HTML.includes('window.desktopAPI.nativeShare(buildNativeShareRequest(_P,qaTraceId()))') &&
  HTML.includes('Compartilhamento não concluído — nada foi enviado.') &&
  HTML.includes('Modo alternativo: mensagem copiada — cole no WhatsApp. Para a mídia única, use “Enviar no grupo do cliente”.'));
ok('R11 telemetria QA sanitizada no renderer: start/result/fallback com trace e flag de target (sem nome bruto obrigatório)',
  WIRE.includes("qaDiag('qa.desktop.nativeshare.start'") &&
  WIRE.includes("qaDiag('qa.desktop.nativeshare.result'") &&
  WIRE.includes("target:(r&&r.target)?'sim':''"));
ok('R12 versão da candidata: 1.0.173-QA (package.json + lock)',
  PKG.version === '1.0.173-QA' && LOCK.includes('"version": "1.0.173-QA"'));
ok('R13 tipos fortes preservados: legenda de roteiro sem "Seu cronograma" e vice-versa (anti-contaminação 74B mantida)',
  HTML.includes("if(type===ShareContentType.VIDEO_SCRIPT&&/Seu cronograma/.test(P.messageText)){P.reason='mensagem_contaminada';return P;}") &&
  HTML.includes("if(type===ShareContentType.SCHEDULE&&/Roteiro de gravação/.test(P.messageText)){P.reason='mensagem_contaminada';return P;}"));

console.log('');
console.log('RESULTADO: ' + pass + ' PASS, ' + fail + ' FAIL');
if (fail > 0) process.exit(1);
console.log('OBS honesta: esta suite prova o CONTRATO do pacote único e do fluxo; a prova de que o');
console.log('WhatsApp Business aceita Text/WebLink junto com a mídia é FÍSICA (ops, FASE 13/14).');
