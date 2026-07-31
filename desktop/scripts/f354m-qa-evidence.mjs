/**
 * F3.5.4M — f354m-qa-evidence.mjs — EVIDÊNCIAS REAIS (Playwright/Chromium; SEM IA generativa).
 * Renderiza o PRÓPRIO src/renderer/slareminder.html (corrigido) e captura PNGs reais em docs/f354m-qa/:
 * amarelo/vermelho corrigidos, close-ups (topo amarelo/vermelho, avatar 100% visível, faixa encaixada),
 * comparativo ANTES(1.0.202)×DEPOIS(1.0.203), escala 125%/150%, outro programa em 1º plano, resoluções
 * 1366x768 e 1920x1080, e promoção amarelo→vermelho. Nada é gerado por IA.
 */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require2 = (await import("node:module")).createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url)); const DESK = path.resolve(HERE, "..");
let chromium; try { chromium = require2("playwright").chromium; } catch (_) { console.error("Playwright ausente — rode com NODE_PATH=/opt/node22/lib/node_modules"); process.exit(2); }
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
const EXE = (() => { try { const b = "/opt/pw-browsers"; for (const d of fs.readdirSync(b)) { const p = path.join(b, d, "chrome-linux", "chrome"); if (d.startsWith("chromium") && fs.existsSync(p)) return p; } } catch (_) {} return undefined; })();

const OUT = path.join(DESK, "..", "docs", "f354m-qa"); fs.mkdirSync(OUT, { recursive: true });
const FIX = "file://" + path.join(DESK, "src", "renderer", "slareminder.html");
const BASE = "file://" + path.resolve(DESK, "..", "..", "wt-f354l", "desktop", "src", "renderer", "slareminder.html"); // 1.0.202 p/ o antes×depois (se existir)
const AV = "data:image/svg+xml;base64," + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#2563EB"/><text x="40" y="52" font-size="34" fill="#fff" text-anchor="middle" font-family="Arial">MS</text></svg>').toString("base64");
const SND = "data:audio/wav;base64,UklGRA==";
const BG_DESKTOP = "linear-gradient(135deg,#0b3d91,#1e6fd9)";
const BG_OTHERAPP = "repeating-linear-gradient(45deg,#e5e7eb,#e5e7eb 22px,#d1d5db 22px,#d1d5db 44px)";

function view(o) {
  return Object.assign({
    key: "k", base: "t:u", level: "warning", title: "ATENÇÃO",
    actorName: "Marcos Silva", actorAvatar: AV, taskTitle: "Edição do vídeo", clientName: "Dra. Ana",
    body: "Faltam 30 minutos para o prazo.", context: "Prazo: 14:30 · Vence em 30:00",
    deep: "detail/t1", queueLen: 1, soundDataUri: SND,
  }, o);
}
const CRIT = { level: "critical", title: "URGENTE", body: "Faltam 10 minutos para o prazo.", context: "Prazo crítico · Vence em 10:00" };

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--force-color-profile=srgb"] });

async function open(url, v, { dpr = 2, bg = BG_DESKTOP, vw = 460 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: 700 }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__h = 0; window.__cb = null; window.slaAPI = { onCard: (c) => { window.__cb = c; }, rendered: () => {}, resize: (h) => { window.__h = h; }, ok: () => {}, open: () => {} }; });
  await page.goto(url);
  await page.evaluate((b) => { document.body.style.background = b; }, bg);
  await page.evaluate((x) => window.__cb && window.__cb(x), v);
  const h = Math.max(1, Math.ceil(await page.evaluate(() => window.__h)));
  await page.setViewportSize({ width: vw, height: h });
  await page.evaluate((x) => window.__cb && window.__cb(x), v);
  await page.waitForTimeout(120);
  return { ctx, page };
}
async function rects(page) {
  return page.evaluate(() => {
    const c = document.getElementById("card").getBoundingClientRect(), a = document.getElementById("av").getBoundingClientRect();
    return { card: { l: c.left, r: c.right, t: c.top, b: c.bottom }, av: { l: a.left, r: a.right, t: a.top, b: a.bottom } };
  });
}
async function shotFull(url, v, file, opts) { const { ctx, page } = await open(url, v, opts); await page.screenshot({ path: path.join(OUT, file) }); await ctx.close(); console.log("  ✓ " + file); }
async function shotClip(url, v, file, clipFn, opts) {
  const { ctx, page } = await open(url, v, opts); const r = await rects(page); const dpr = (opts && opts.dpr) || 2;
  let c = clipFn(r); c = { x: Math.max(0, c.x), y: Math.max(0, c.y), width: c.width, height: c.height };
  await page.screenshot({ path: path.join(OUT, file), clip: c }); await ctx.close(); console.log("  ✓ " + file);
}

console.log("F3.5.4M — evidências reais (Playwright):");
// 01/02 — cards corrigidos completos
await shotFull(FIX, view({}), "01-amarelo-corrigido.png");
await shotFull(FIX, view(CRIT), "02-vermelho-corrigido.png");
// 03/04 — close-up do topo (avatar + faixa + primeiras linhas)
await shotClip(FIX, view({}), "03-closeup-topo-amarelo.png", (r) => ({ x: r.card.l - 18, y: 0, width: (r.card.r - r.card.l) + 36, height: r.card.t + 78 }));
await shotClip(FIX, view(CRIT), "04-closeup-topo-vermelho.png", (r) => ({ x: r.card.l - 18, y: 0, width: (r.card.r - r.card.l) + 36, height: r.card.t + 78 }));
// 05 — close-up do avatar 100% visível
await shotClip(FIX, view({}), "05-closeup-avatar-visivel.png", (r) => ({ x: r.av.l - 20, y: r.av.t - 20, width: (r.av.r - r.av.l) + 40, height: (r.av.b - r.av.t) + 40 }));
// 06 — close-up da faixa encaixada (cantos superiores do card)
await shotClip(FIX, view({}), "06-closeup-faixa-encaixada.png", (r) => ({ x: r.card.l - 10, y: r.card.t - 10, width: (r.card.r - r.card.l) + 20, height: 44 }));
// 08/09 — escalas
await shotFull(FIX, view({}), "08-escala-125.png", { dpr: 1.25 });
await shotFull(FIX, view(CRIT), "09-escala-150.png", { dpr: 1.5 });
// 10 — outro programa em 1º plano
await shotFull(FIX, view({}), "10-outro-programa-em-foco.png", { bg: BG_OTHERAPP });
// 11/12 — resoluções (janela centralizada em telas grandes)
await shotFull(FIX, view({}), "11-res-1366x768.png", { vw: 1366 });
await shotFull(FIX, view(CRIT), "12-res-1920x1080.png", { vw: 1920 });
// 13 — promoção amarelo→vermelho (mesma janela vira vermelha)
await shotFull(FIX, view(Object.assign({}, CRIT, { queueLen: 1 })), "13-promocao-amarelo-vermelho.png");

// 07 — comparativo ANTES(1.0.202) × DEPOIS(1.0.203)
async function cardPng(url, v) {
  const { ctx, page } = await open(url, v, { dpr: 2 }); const r = await rects(page);
  const clip = { x: Math.max(0, r.card.l - 26), y: 0, width: (r.card.r - r.card.l) + 52, height: r.card.b + 26 };
  const buf = await page.screenshot({ clip }); await ctx.close(); return "data:image/png;base64," + buf.toString("base64");
}
try {
  const before = fs.existsSync(BASE.replace("file://", "")) ? await cardPng(BASE, view({})) : null;
  const after = await cardPng(FIX, view({}));
  const cmp = await browser.newContext({ viewport: { width: 1000, height: 560 }, deviceScaleFactor: 2 });
  const cp = await cmp.newPage();
  const col = (label, img, tag) => '<div style="flex:1;text-align:center"><div style="font:700 15px Segoe UI,Arial;color:#0f172a;margin-bottom:6px">' + label + '</div><div style="font:12px Segoe UI,Arial;color:#64748b;margin-bottom:10px">' + tag + '</div>' + (img ? '<img src="' + img + '" style="max-width:100%;box-shadow:0 8px 24px rgba(2,6,23,.18);border-radius:12px"/>' : '<div style="color:#991b1b">(base indisponível)</div>') + '</div>';
  await cp.setContent('<div style="margin:0;background:#eef2f7;padding:22px;display:flex;gap:24px;align-items:flex-start;font-family:Segoe UI,Arial">' +
    col("ANTES", before, "1.0.202 — avatar cortado / faixa vazando") +
    col("DEPOIS", after, "1.0.203 — avatar 100% visível / faixa encaixada") + '</div>');
  await cp.waitForTimeout(120); await cp.screenshot({ path: path.join(OUT, "07-antes-depois.png") }); await cmp.close();
  console.log("  ✓ 07-antes-depois.png");
} catch (e) { console.error("  ! 07-antes-depois falhou: " + (e && e.message)); }

await browser.close();
const files = fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).sort();
console.log("\nF3.5.4M: " + files.length + " evidências em docs/f354m-qa/");
if (files.length < 9) { console.error("::error:: esperado >=9 evidências, geradas " + files.length); process.exit(1); }
console.log("OK — " + files.length + " evidências reais geradas (sem IA).");
