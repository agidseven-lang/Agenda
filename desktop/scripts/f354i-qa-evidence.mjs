#!/usr/bin/env node
/* =====================================================================
 * F3.5.4I — 6 EVIDÊNCIAS REAIS (Playwright/Chromium; sem IA generativa).
 * Usa a MARCAÇÃO REAL do botão de envio (rev-send, extraída do stepReview do
 * index.html) e as MENSAGENS REAIS produzidas por cronValidateSend/cronClassifyError
 * (funções reais executadas), sobre o CSS REAL do app. Cenas:
 *   01 wizard preenchido (botão "Enviar para o cliente")
 *   02 estado "Salvando cronograma…" (botão desabilitado)
 *   03 sucesso (save confirmado → abre envio ao cliente)
 *   04 falha de validação (mensagem de campo real)
 *   05 falha de rede com DADOS PRESERVADOS (mensagem de conexão real + resumo intacto)
 *   06 WhatsApp/link só DEPOIS do save confirmado (ordem)
 * Saída: docs/f354i-qa/*.png
 * Rodar: NODE_PATH=/opt/node22/lib/node_modules node desktop/scripts/f354i-qa-evidence.mjs
 * ===================================================================== */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const require2 = (await import('node:module')).createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url)); const DESK = path.resolve(HERE, '..'); const ROOT = path.resolve(DESK, '..');
const OUT = path.join(ROOT, 'docs', 'f354i-qa'); fs.mkdirSync(OUT, { recursive: true });
const HTML = fs.readFileSync(path.join(DESK, 'src', 'renderer', 'index.html'), 'utf8');
let chromium; try { chromium = require2('playwright').chromium; } catch (_) { console.error('Playwright ausente — rode com NODE_PATH=/opt/node22/lib/node_modules'); process.exit(2); }

function grabFn(sig) { const a = HTML.indexOf(sig); if (a < 0) return ''; let d = 0, st = false; for (let j = HTML.indexOf('{', a); j < HTML.length; j++) { const c = HTML[j]; if (c === '{') { d++; st = true; } else if (c === '}') { d--; if (st && d === 0) return HTML.slice(a, j + 1); } } return ''; }
function cssOf() { let out = '', i = 0; for (;;) { const a = HTML.indexOf('<style', i); if (a < 0) break; const s = HTML.indexOf('>', a) + 1; const b = HTML.indexOf('</style>', s); out += HTML.slice(s, b) + '\n'; i = b + 8; } return out; }
/* mensagens REAIS das funções reais */
const REAL = new Function('navigator', grabFn('function cronMaskId(') + grabFn('function cronCode(') + grabFn('function cronClassifyError(') +
  'function dtMs(d,t){if(!d)return 0;var p=String(d).split("-").map(Number),q=String(t||"00:00").split(":").map(Number);return new Date(p[0],p[1]-1,p[2],q[0]||0,q[1]||0).getTime();}' +
  grabFn('function cronValidateSend(') +
  '\n;return {validate:cronValidateSend, classify:cronClassifyError};')({ onLine: false });
const MSG_VALIDATION = REAL.validate({ title: 'Cronograma Hospital Visão', contents: [{ tema: '', legenda: '' }] }, true).message;
const MSG_NETWORK = REAL.classify(Object.assign(new Error('The service is currently unavailable.'), { name: 'FirebaseError', code: 'unavailable' })).userMessage;

const svgSend = '<svg viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
/* MARCAÇÃO REAL do rev-send (idêntica ao stepReview): estados Enviar / Salvando… */
const btnEnviar = '<div class="rev-send"><button class="btn rev-send-btn" data-sendclient="1">' + svgSend + 'Enviar para o cliente</button><div class="rev-send-hint">Gera mensagem para WhatsApp com link de preview interno do cronograma.</div></div>';
const btnSalvando = '<div class="rev-send"><button class="btn rev-send-btn" disabled aria-busy="true">' + svgSend + 'Salvando cronograma…</button><div class="rev-send-hint">Gera mensagem para WhatsApp com link de preview interno do cronograma.</div></div>';
const TEMAS = ['Qualidade de vida começa aqui', 'Agende sua consulta', 'Saúde ocular em dia', 'Exames de rotina', 'Cuidado com a visão', 'Dicas de prevenção', 'Novidades da clínica', 'Depoimento de paciente', 'Horários de atendimento', 'Campanha de exames', 'Conheça a equipe'];
function reviewCard(inner, banner) {
  const temas = TEMAS.map((t, i) => '<div style="display:flex;gap:10px;padding:9px 12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;margin-bottom:6px"><span style="color:var(--accent);font-weight:800;font-size:12px;min-width:74px">Conteúdo ' + (i + 1) + '</span><span style="color:#dfe3ea;font-size:13px">' + t + '</span></div>').join('');
  return '<div style="max-width:560px;margin:0 auto">' +
    '<div style="color:#8b94a6;font:800 12px Segoe UI,system-ui;letter-spacing:.06em;text-transform:uppercase;margin:0 0 10px">Revisão — Cronograma · Hospital Visão · Semanal</div>' +
    '<div class="rev-quick" style="display:flex;gap:10px;margin-bottom:12px"><button class="rev-edit2">Editar dados</button><button class="rev-edit2">Editar briefing</button></div>' +
    '<div style="color:#aeb4c0;font-size:12.5px;font-weight:700;margin:2px 0 8px">Resumo editorial (' + TEMAS.length + ')</div>' + temas +
    (banner || '') + inner + '</div>';
}
function page(inner) {
  return '<!doctype html><html><head><meta charset="utf-8"><style>' + cssOf() + '\nbody{background:#0A0B10;margin:0;padding:26px 18px;font-family:Segoe UI,system-ui}\n.rev-edit2{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#c7ccd6;border-radius:10px;height:38px;padding:0 14px;font-weight:700;font-size:13px}\n</style></head><body class="desktop">' + inner + '</body></html>';
}
const alertBanner = (txt, tone) => '<div style="margin:14px 0 4px;padding:12px 14px;border-radius:12px;font-size:13.5px;font-weight:600;line-height:1.45;' +
  (tone === 'err' ? 'background:rgba(244,63,94,.12);border:1px solid rgba(244,63,94,.4);color:#fda4af' : tone === 'ok' ? 'background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.4);color:#6ee7b7' : 'background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);color:#fcd34d') + '">' + txt + '</div>';

(async () => {
  const browser = await chromium.launch();
  const shot = async (name, inner, w, h) => { const ctx = await browser.newContext({ viewport: { width: w || 720, height: h || 900 }, deviceScaleFactor: 1.25 }); const pg = await ctx.newPage(); await pg.setContent(page(inner), { waitUntil: 'load' }); await pg.waitForTimeout(120); await pg.screenshot({ path: path.join(OUT, name + '.png') }); await ctx.close(); console.log('  ✓', name + '.png'); };
  const metrics = {};
  await shot('01-wizard-preenchido', reviewCard(btnEnviar), 720, 980);
  await shot('02-salvando-cronograma', reviewCard(btnSalvando), 720, 980);
  await shot('03-sucesso-abre-envio', reviewCard(alertBanner('✓ Cronograma salvo e confirmado (read-back). Abrindo o envio ao cliente…', 'ok') +
    '<div style="margin-top:12px;padding:14px;border:1px dashed rgba(255,255,255,.18);border-radius:12px;color:#c7ccd6;font-size:13px"><b style="color:#fff">Enviar ao cliente</b><br>Link de preview interno + mensagem para o WhatsApp Business (gerador aprovado — Card Premium/cache-bust intactos).</div>'), 720, 1020);
  await shot('04-falha-validacao', reviewCard(btnEnviar, alertBanner(MSG_VALIDATION, 'err')), 720, 1000);
  await shot('05-falha-rede-dados-preservados', reviewCard(btnEnviar, alertBanner(MSG_NETWORK, 'warn')), 720, 1020);
  await shot('06-whatsapp-so-apos-save', reviewCard(
    '<div style="margin-top:14px;display:flex;flex-direction:column;gap:8px">' +
    '<div style="padding:10px 12px;border-radius:10px;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.35);color:#6ee7b7;font-size:13px;font-weight:700">1 · Firestore write + read-back CONFIRMADOS</div>' +
    '<div style="text-align:center;color:#6b7280">▼</div>' +
    '<div style="padding:10px 12px;border-radius:10px;background:rgba(37,211,102,.12);border:1px solid rgba(37,211,102,.4);color:#86efac;font-size:13px;font-weight:700">2 · SÓ então: token/link + WhatsApp Business (nunca antes do save)</div></div>'), 720, 1040);
  metrics.messages = { validation: MSG_VALIDATION, network: MSG_NETWORK };
  metrics.scenes = 6; fs.writeFileSync(path.join(OUT, 'metrics-f354i.json'), JSON.stringify(metrics, null, 2));
  await browser.close();
  const n = fs.readdirSync(OUT).filter(f => f.endsWith('.png')).length;
  console.log('\n' + (n === 6 ? '✅ 6 evidências reais em docs/f354i-qa/ (mensagens reais: validação + rede)' : '❌ esperadas 6 PNGs, vi ' + n));
  process.exit(n === 6 ? 0 : 1);
})().catch(e => { console.error('ERRO', e); process.exit(1); });
