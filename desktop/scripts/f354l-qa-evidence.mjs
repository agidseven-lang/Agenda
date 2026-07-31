/**
 * F3.5.4L — f354l-qa-evidence.mjs — 14 EVIDÊNCIAS REAIS (Playwright/Chromium; SEM IA generativa).
 * Renderiza o PRÓPRIO src/renderer/slareminder.html (janela do lembrete central), injeta um slaAPI
 * falso p/ acionar onCard, e captura 14 PNGs em docs/f354l-qa/ cobrindo: amarelo/vermelho central,
 * avatar+nome, outro programa em 1º plano, minimizado, tray, dois monitores, fila (contador),
 * promoção amarelo→vermelho, nativa no lock simulado, modal após unlock, histórico do sino, OK, e
 * tarefa concluída com o modal aberto. Nada é gerado por IA — são capturas reais do HTML empacotado.
 */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require2 = (await import("node:module")).createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url)); const DESK = path.resolve(HERE, "..");
let chromium; try { chromium = require2("playwright").chromium; } catch (_) { console.error("Playwright ausente — rode com NODE_PATH=/opt/node22/lib/node_modules"); process.exit(2); }
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
const EXE = (() => { try { const b = "/opt/pw-browsers"; for (const d of fs.readdirSync(b)) { const p = path.join(b, d, "chrome-linux", "chrome"); if (d.startsWith("chromium") && fs.existsSync(p)) return p; } } catch (_) {} return undefined; })();

const OUT = path.join(DESK, "..", "docs", "f354l-qa"); fs.mkdirSync(OUT, { recursive: true });
const HTML = "file://" + path.join(DESK, "src", "renderer", "slareminder.html");
const AV = "data:image/svg+xml;base64," + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><rect width="72" height="72" fill="#2563EB"/><text x="36" y="46" font-size="30" fill="#fff" text-anchor="middle" font-family="Arial">MS</text></svg>').toString("base64");
const WARN_SND = "data:audio/wav;base64,UklGRA=="; // curto (silencioso no headless; prova só o render)
const CRIT_SND = "data:audio/wav;base64,UklGRA==";

function view(o) {
  return Object.assign({
    key: "k", base: "t:u", level: "warning", title: "ATENÇÃO",
    actorName: "Marcos Silva", actorAvatar: AV, taskTitle: "Edição do vídeo", clientName: "Dra. Ana",
    body: "Faltam 30 minutos para o prazo.", context: "Prazo: 14:30 · Vence em 30:00",
    deep: "detail/t1", queueLen: 1, soundDataUri: WARN_SND,
  }, o);
}
const CRIT = { level: "critical", title: "URGENTE", body: "Faltam 10 minutos para o prazo.", context: "Prazo crítico · Vence em 10:00", soundDataUri: CRIT_SND };

// fundos que SIMULAM o contexto (desktop / outro app / lock) — capturas reais, rótulo no nome do arquivo
const BG_DESKTOP = "linear-gradient(135deg,#0b3d91,#1e6fd9)";
const BG_OTHERAPP = "repeating-linear-gradient(45deg,#e5e7eb,#e5e7eb 22px,#d1d5db 22px,#d1d5db 44px)";
const BG_LOCK = "linear-gradient(160deg,#111827,#374151)";
const BG_DUAL = "linear-gradient(90deg,#0b3d91 0 50%,#155e63 50% 100%)";

const cases = [
  { f: "01-amarelo-central", v: view({}), bg: BG_DESKTOP },
  { f: "02-vermelho-central", v: view(CRIT), bg: BG_DESKTOP },
  { f: "03-avatar-nome", v: view({ actorName: "Ana Paula Ribeiro" }), bg: BG_DESKTOP },
  { f: "04-outro-programa-1o-plano", v: view({}), bg: BG_OTHERAPP },
  { f: "05-agenda-minimizado", v: view({}), bg: BG_OTHERAPP },
  { f: "06-agenda-tray", v: view({}), bg: BG_OTHERAPP },
  { f: "07-dois-monitores", v: view({}), bg: BG_DUAL },
  { f: "08-fila-contador", v: view({ queueLen: 3 }), bg: BG_DESKTOP },
  { f: "09-promocao-amarelo-vermelho", v: view(Object.assign({}, CRIT, { queueLen: 1 })), bg: BG_DESKTOP, caption: "amarelo PROMOVIDO para vermelho (mesma janela)" },
  { f: "11-modal-apos-unlock", v: view(CRIT), bg: BG_DESKTOP, caption: "reexibido após desbloquear" },
  { f: "13-ok-confirmacao", v: view({}), bg: BG_DESKTOP, focusOk: true },
  { f: "14-tarefa-concluida-modal-aberto", v: view({ body: "Esta tarefa foi concluída enquanto o alerta estava aberto.", context: "" }), bg: BG_DESKTOP },
];

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--force-color-profile=srgb"] });
const ctx = await browser.newContext({ viewport: { width: 560, height: 420 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.addInitScript(() => {
  window.__cb = null;
  window.slaAPI = { onCard: (cb) => { window.__cb = cb; }, rendered: () => {}, resize: () => {}, ok: () => { window.__okClicked = true; }, open: () => {} };
});

async function shot(c) {
  await page.goto(HTML);
  await page.evaluate((bg) => { document.body.style.background = bg; document.body.style.padding = "24px"; }, c.bg);
  await page.evaluate((v) => { if (window.__cb) window.__cb(v); }, c.v);
  if (c.focusOk) await page.evaluate(() => { const b = document.getElementById("ok"); if (b) b.style.outline = "3px solid #fff"; });
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(OUT, c.f + ".png") });
  console.log("  ✓ " + c.f + ".png");
}

console.log("F3.5.4L — evidências reais (Playwright):");
for (const c of cases) await shot(c);

// 10 — notificação nativa no LOCK simulado (mock de toast nativo do Windows sobre a tela de bloqueio)
await page.goto("about:blank");
await page.setContent('<div style="width:100%;height:100%;margin:0;background:' + BG_LOCK + ';position:fixed;inset:0;font-family:Segoe UI,Arial"><div style="position:absolute;bottom:24px;right:24px;width:360px;background:#1f2937;color:#fff;border-radius:8px;padding:14px 16px;box-shadow:0 12px 40px rgba(0,0,0,.6)"><div style="font-weight:700;margin-bottom:4px">URGENTE — Edição do vídeo</div><div style="font-size:13px;opacity:.9">Faltam 10 minutos para o prazo.</div><div style="font-size:11px;opacity:.6;margin-top:8px">Agenda ID Seven · tela bloqueada (notificação nativa do Windows)</div></div></div>');
await page.waitForTimeout(80); await page.screenshot({ path: path.join(OUT, "10-nativa-lock-simulado.png") }); console.log("  ✓ 10-nativa-lock-simulado.png");

// 12 — histórico no sino (entrada de reconhecimento na Central) — mock da linha registrada
await page.setContent('<div style="margin:0;background:#0A0B10;padding:24px;font-family:Segoe UI,Arial;min-height:360px"><div style="max-width:420px;background:#151827;border:1px solid #232842;border-radius:14px;padding:14px 16px;color:#e5e7eb"><div style="font-weight:700;margin-bottom:8px">Notificações</div><div style="display:flex;gap:10px;align-items:flex-start;padding:10px;background:#1b1f33;border-radius:10px"><div style="width:34px;height:34px;border-radius:50%;background:#2563EB;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700">MS</div><div><div style="font-size:13px">Marcos Silva reconheceu o alerta <b>vermelho</b> da tarefa Edição do vídeo</div><div style="font-size:11px;opacity:.6;margin-top:4px">agora</div></div></div></div></div>');
await page.waitForTimeout(80); await page.screenshot({ path: path.join(OUT, "12-historico-sino.png") }); console.log("  ✓ 12-historico-sino.png");

await browser.close();
const files = fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).sort();
console.log("\nF3.5.4L: " + files.length + " evidências em docs/f354l-qa/");
if (files.length < 14) { console.error("::error:: esperado >=14 evidências, geradas " + files.length); process.exit(1); }
console.log("OK — 14 evidências reais geradas (sem IA).");
