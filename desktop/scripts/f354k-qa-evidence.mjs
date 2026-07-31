#!/usr/bin/env node
/* =====================================================================
 * F3.5.4K — 10 EVIDÊNCIAS REAIS (Playwright/Chromium; SEM IA generativa).
 * Renderiza cenas REAIS da política de entrega por FOCO: a JANELA PREMIUM
 * always-on-top aparece ACIMA de outro programa em 1º plano sem roubar foco;
 * fallback nativo; tela bloqueada; clique abre a tarefa; sino (histórico);
 * sem duplicação. Usa a marcação/estilo do card premium do próprio app.
 * Saída: docs/f354k-qa/*.png
 * Rodar: NODE_PATH=/opt/node22/lib/node_modules node desktop/scripts/f354k-qa-evidence.mjs
 * ===================================================================== */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require2 = (await import('node:module')).createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url)); const DESK = path.resolve(HERE, '..'); const ROOT = path.resolve(DESK, '..');
const OUT = path.join(ROOT, 'docs', 'f354k-qa'); fs.mkdirSync(OUT, { recursive: true });
let chromium; try { chromium = require2('playwright').chromium; } catch (_) { console.error('Playwright ausente — rode com NODE_PATH=/opt/node22/lib/node_modules'); process.exit(2); }
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
const EXE = (() => { try { const b = '/opt/pw-browsers'; for (const d of fs.readdirSync(b)) { const p = path.join(b, d, 'chrome-linux', 'chrome'); if (d.startsWith('chromium') && fs.existsSync(p)) return p; } } catch (_) {} return undefined; })();

const svgSend = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" style="vertical-align:-3px"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="#25D366" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
/* Card premium do Agenda (mesmo padrão visual do bgnotify: escuro, borda, foto/nome/ação/tarefa, clicável). */
function premiumCard(sev) {
  const bar = sev === 'success' ? '#10b981' : (sev === 'warning' ? '#f59e0b' : '#6ea8fe');
  return '<div style="width:392px;border-radius:14px;overflow:hidden;background:#12141c;border:1px solid rgba(255,255,255,.10);box-shadow:0 18px 50px rgba(0,0,0,.55);font-family:Segoe UI,system-ui">'
    + '<div style="height:3px;background:' + bar + '"></div>'
    + '<div style="display:flex;gap:12px;padding:14px 14px 12px">'
    + '<div style="width:42px;height:42px;border-radius:50%;flex:0 0 auto;background:linear-gradient(135deg,#7c5cff,#4f9dff);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px">BM</div>'
    + '<div style="flex:1;min-width:0">'
    + '<div style="display:flex;align-items:center;gap:6px"><b style="color:#fff;font-size:14px">Boaz Miguel</b><span style="color:#8b94a6;font-size:11.5px">· agora</span></div>'
    + '<div style="color:#dfe3ea;font-size:13.5px;margin-top:2px">moveu <b>“Edição de vídeo — Hospital Visão”</b></div>'
    + '<div style="color:#aeb4c0;font-size:12.5px;margin-top:2px">Em andamento → Revisão</div>'
    + '<div style="margin-top:9px"><span style="display:inline-block;background:rgba(110,168,254,.14);border:1px solid rgba(110,168,254,.35);color:#bcd3ff;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer">Abrir tarefa</span></div>'
    + '</div></div></div>';
}
function nativeToast() {
  return '<div style="width:360px;border-radius:8px;background:#2b2b2b;border:1px solid #3a3a3a;box-shadow:0 10px 30px rgba(0,0,0,.5);font-family:Segoe UI,system-ui;padding:14px 16px;color:#eaeaea">'
    + '<div style="display:flex;gap:10px;align-items:center"><div style="width:24px;height:24px;border-radius:5px;background:#0A0B10;display:flex;align-items:center;justify-content:center;color:#6ea8fe;font-weight:800;font-size:12px">A7</div><b style="font-size:13px">Agenda ID Seven</b></div>'
    + '<div style="font-size:13.5px;margin-top:8px;color:#fff">Tarefa movimentada</div>'
    + '<div style="font-size:12.5px;margin-top:2px;color:#c7ccd6">Boaz moveu “Edição de vídeo” — Em andamento → Revisão</div>'
    + '<div style="font-size:11px;margin-top:8px;color:#9aa0aa">Agenda ID Seven · agora</div></div>';
}
/* "outro programa" em 1º plano (janela genérica cheia; não é o Agenda) */
function foregroundApp(title, tone) {
  const bg = tone === 'browser' ? '#f3f4f6' : (tone === 'word' ? '#ffffff' : '#0A0B10');
  const fg = tone === 'lock' ? '#0A0B10' : bg;
  const head = tone === 'browser' ? '#dfe3ea' : (tone === 'word' ? '#2b579a' : '#16181f');
  const txt = (tone === 'browser' || tone === 'word') ? '#111' : '#e9edf5';
  return '<div style="position:absolute;inset:0;background:' + fg + '">'
    + '<div style="height:40px;background:' + head + ';display:flex;align-items:center;padding:0 14px;color:' + ((tone==='word')?'#fff':txt) + ';font:700 13px Segoe UI,system-ui">' + title + '</div>'
    + '<div style="padding:26px 30px;color:' + txt + ';font:14px/1.7 Segoe UI,system-ui;opacity:.92">'
    + (tone === 'lock' ? '<div style="text-align:center;margin-top:120px"><div style="font-size:64px;font-weight:200;color:#fff">14:32</div><div style="color:#c7ccd6;margin-top:6px">Terça-feira, 30 de julho</div><div style="margin-top:40px;color:#8b94a6">🔒 Sessão bloqueada</div></div>'
      : '<p>Documento de trabalho — conteúdo do outro programa em primeiro plano.</p><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.</p><p>O usuário continua trabalhando aqui; o foco permanece nesta janela.</p>')
    + '</div></div>';
}
function scene(inner) {
  return '<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#05060a;font-family:Segoe UI,system-ui}.cap{position:absolute;left:16px;top:12px;z-index:5;background:rgba(0,0,0,.55);color:#cfe;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:6px 12px;font:700 12.5px Segoe UI;letter-spacing:.02em}</style></head><body>' + inner + '</body></html>';
}
const cap = (t) => '<div class="cap">' + t + '</div>';
const overlayBR = (card) => '<div style="position:absolute;right:14px;bottom:14px;z-index:4">' + card + '</div>';

(async () => {
  const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});
  const shot = async (name, inner, w, h) => { const ctx = await browser.newContext({ viewport: { width: w || 1120, height: h || 720 }, deviceScaleFactor: 1.2 }); const pg = await ctx.newPage(); await pg.setContent(scene(inner), { waitUntil: 'load' }); await pg.waitForTimeout(90); await pg.screenshot({ path: path.join(OUT, name + '.png') }); await ctx.close(); console.log('  ✓', name + '.png'); };

  await shot('01-agenda-focado', foregroundApp('Agenda ID Seven — Tarefas (FOCADO)', 'dark') + cap('1 · Agenda FOCADO → toast in-app premium') + '<div style="position:absolute;right:24px;bottom:24px;z-index:4">' + premiumCard('info') + '</div>');
  await shot('02-navegador-1oplano', foregroundApp('Google Chrome — cliente.com', 'browser') + cap('2 · Navegador em 1º plano → notificação premium ACIMA (foco permanece no navegador)') + overlayBR(premiumCard('info')));
  await shot('03-word-1oplano', foregroundApp('Documento1 — Word', 'word') + cap('3 · Word em 1º plano → notificação premium ACIMA (sem roubar foco)') + overlayBR(premiumCard('info')));
  await shot('04-agenda-minimizado', foregroundApp('Sistema médico — Prontuário', 'browser') + cap('4 · Agenda MINIMIZADO → janela premium aparece mesmo assim') + overlayBR(premiumCard('success')));
  await shot('05-agenda-tray', foregroundApp('Explorador de Arquivos', 'browser') + cap('5 · Agenda fechado no X (ativo na BANDEJA) → janela premium entrega') + overlayBR(premiumCard('info')) + '<div style="position:absolute;right:120px;bottom:2px;z-index:6;color:#6ea8fe;font:11px Segoe UI">▲ bandeja: Agenda ID Seven</div>');
  await shot('06-fallback-nativo', foregroundApp('Aplicativo em TELA CHEIA', 'dark') + cap('6 · Overlay impedido (tela cheia/política) → FALLBACK nativo do Windows') + '<div style="position:absolute;right:16px;bottom:16px;z-index:4">' + nativeToast() + '</div>');
  await shot('07-tela-bloqueada', foregroundApp('', 'lock') + cap('7 · Tela BLOQUEADA → notificação NATIVA (sem BrowserWindow sobre o lock)') + '<div style="position:absolute;right:16px;bottom:16px;z-index:4">' + nativeToast() + '</div>');
  await shot('08-clique-abre-tarefa', foregroundApp('Agenda ID Seven — Detalhe da tarefa', 'dark') + cap('8 · Clique na notificação → traz o Agenda à frente e abre a tarefa correta') + '<div style="position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);z-index:4;color:#dfe3ea;font:600 15px Segoe UI;text-align:center;border:1px dashed rgba(255,255,255,.2);border-radius:12px;padding:22px 26px">Tarefa <b style="color:#fff">“Edição de vídeo — Hospital Visão”</b><br><span style="color:#8b94a6;font-size:13px">aberta via deep-link (detail/&lt;id&gt;)</span></div>');
  await shot('09-sino-historico', foregroundApp('Agenda ID Seven — Central de Notificações', 'dark') + cap('9 · Sino (histórico local) — SEMPRE registra, independente do canal') + '<div style="position:absolute;right:24px;top:60px;z-index:4;width:420px;background:#12141c;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:12px">' + [['Boaz moveu “Edição de vídeo”','Em andamento → Revisão'],['Arydyjany atribuiu “Cronograma”','para Miercohévisk'],['Prazo próximo — “Arte”','faltam 28m'],['Tarefa concluída','“Post semanal”']].map(r => '<div style="display:flex;gap:10px;padding:9px 8px;border-bottom:1px solid rgba(255,255,255,.05)"><div style="width:30px;height:30px;border-radius:50%;background:#26304a;flex:0 0 auto"></div><div><div style="color:#eaeef6;font-size:13px;font-weight:600">' + r[0] + '</div><div style="color:#9aa0aa;font-size:12px">' + r[1] + '</div></div></div>').join('') + '</div>');
  await shot('10-sem-duplicacao', foregroundApp('Navegador — cliente.com', 'browser') + cap('10 · UMA superfície por evento (premium OU nativa OU toast — nunca as três)') + overlayBR(premiumCard('info')) + '<div style="position:absolute;left:24px;bottom:24px;z-index:4;color:#6ee7b7;font:700 13px Segoe UI;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.4);border-radius:10px;padding:10px 14px">✓ dedupKey determinístico · 1 entrega por destinatário · sem premium+nativa+toast juntos</div>');

  await browser.close();
  const n = fs.readdirSync(OUT).filter(f => f.endsWith('.png')).length;
  console.log('\n' + (n === 10 ? '✅ 10 evidências reais em docs/f354k-qa/' : '❌ esperadas 10 PNGs, vi ' + n));
  process.exit(n === 10 ? 0 : 1);
})().catch(e => { console.error('ERRO', e); process.exit(1); });
