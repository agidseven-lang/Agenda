/**
 * F3.5.4M — f354m-visual-fix.test.mjs — PROVA GEOMÉTRICA do acabamento do lembrete central.
 * =====================================================================================
 * Renderiza o PRÓPRIO src/renderer/slareminder.html no Chromium, injeta um slaAPI falso p/ acionar
 * onCard e capturar a altura enviada por api.resize(), redimensiona o viewport EXATAMENTE p/ essa
 * altura (= a janela real do Electron, dimensionada ao #wrap) e então MEDE o layout, provando:
 *   1) avatar 100% visível (rect dentro do viewport; topo >= 0 => NÃO é cortado pela borda da janela);
 *   2) avatar sobreposto ao topo do card (transborda acima E encaixa dentro), sem cortar texto;
 *   3) avatar centralizado no card;
 *   4) avatar é IRMÃO do card (fora do card) — pré-requisito p/ o card poder usar overflow:hidden;
 *   5) faixa superior ENCAIXADA: card overflow:hidden + border-radius => a ::before é clipada aos
 *      cantos arredondados (impossível vazar) e sua cor corresponde ao tema (amber/vermelho);
 *   6) paridade amarelo × vermelho; estabilidade em DPI 100%/125%/150%.
 * Sem IA. É uma medição real do HTML empacotado.
 */
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const require2 = (await import("node:module")).createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url)); const DESK = path.resolve(HERE, "..");
let chromium; try { chromium = require2("playwright").chromium; } catch (_) { console.error("Playwright ausente — rode com NODE_PATH=/opt/node22/lib/node_modules"); process.exit(2); }
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
const EXE = (() => { try { const b = "/opt/pw-browsers"; for (const d of fs.readdirSync(b)) { const p = path.join(b, d, "chrome-linux", "chrome"); if (d.startsWith("chromium") && fs.existsSync(p)) return p; } } catch (_) {} return undefined; })();

const HTML = "file://" + path.join(DESK, "src", "renderer", "slareminder.html");
const AV = "data:image/svg+xml;base64," + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><rect width="72" height="72" fill="#2563EB"/><text x="36" y="46" font-size="30" fill="#fff" text-anchor="middle" font-family="Arial">MS</text></svg>').toString("base64");
const WIDTH = 460; // == WIDTH da BrowserWindow (slaReminderWindow.ts)

function view(o) {
  return Object.assign({
    key: "k", base: "t:u", level: "warning", title: "ATENÇÃO",
    actorName: "Marcos Silva", actorAvatar: AV, taskTitle: "Edição do vídeo", clientName: "Dra. Ana",
    body: "Faltam 30 minutos para o prazo.", context: "Prazo: 14:30 · Vence em 30:00",
    deep: "detail/t1", queueLen: 1, soundDataUri: "data:audio/wav;base64,UklGRA==",
  }, o);
}
const CRIT = { level: "critical", title: "URGENTE", body: "Faltam 10 minutos para o prazo.", context: "Prazo crítico · Vence em 10:00" };

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) { pass++; } else { fail++; flog.push("FAIL: " + n); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--force-color-profile=srgb"] });

async function measure(level, dpr) {
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 700 }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__resizeH = 0; window.__cb = null;
    window.slaAPI = { onCard: (cb) => { window.__cb = cb; }, rendered: () => {}, resize: (h) => { window.__resizeH = h; }, ok: () => {}, open: () => {} };
  });
  await page.goto(HTML);
  await page.evaluate((v) => { if (window.__cb) window.__cb(v); }, level === "critical" ? view(CRIT) : view({}));
  // a janela real é dimensionada à altura enviada por api.resize() (== #wrap). Reproduzimos isso:
  const h = Math.max(1, Math.ceil(await page.evaluate(() => window.__resizeH)));
  await page.setViewportSize({ width: WIDTH, height: h });
  await page.evaluate((v) => { if (window.__cb) window.__cb(v); }, level === "critical" ? view(CRIT) : view({})); // re-render p/ estabilizar
  const m = await page.evaluate(() => {
    const card = document.getElementById("card"), av = document.getElementById("av"), wrap = document.getElementById("wrap"), kicker = document.getElementById("kicker");
    const cr = card.getBoundingClientRect(), ar = av.getBoundingClientRect(), kr = kicker.getBoundingClientRect();
    const cs = getComputedStyle(card), csB = getComputedStyle(card, "::before");
    return {
      vw: window.innerWidth, vh: window.innerHeight,
      card: { top: cr.top, left: cr.left, right: cr.right, bottom: cr.bottom, cx: cr.left + cr.width / 2 },
      av: { top: ar.top, left: ar.left, right: ar.right, bottom: ar.bottom, cx: ar.left + ar.width / 2, w: ar.width, h: ar.height },
      kickerTop: kr.top,
      cardOverflow: cs.overflow, cardRadius: parseFloat(cs.borderTopLeftRadius) || 0,
      barBg: csB.backgroundColor, barTop: csB.top, avParentIsWrap: av.parentElement === wrap, avParentIsCard: av.parentElement === card,
      kickerText: kicker.textContent,
    };
  });
  await ctx.close();
  return { h, m };
}

for (const dpr of [1, 1.25, 1.5]) {
  for (const level of ["warning", "critical"]) {
    const tag = level + "@" + dpr + "x";
    const { m } = await measure(level, dpr);
    // 1) avatar 100% visível dentro da janela (topo >= 0 => sem corte pela borda superior)
    ok(`[${tag}] avatar topo>=0 (NÃO cortado pela janela)`, m.av.top >= -0.5);
    ok(`[${tag}] avatar dentro do viewport (L/R/baixo)`, m.av.left >= -0.5 && m.av.right <= m.vw + 0.5 && m.av.bottom <= m.vh + 0.5);
    // 2) sobreposição elegante: transborda acima do card E encaixa dentro; não cobre o texto (kicker)
    ok(`[${tag}] avatar transborda acima do card`, m.av.top < m.card.top - 1);
    ok(`[${tag}] avatar encaixa dentro do card (straddle)`, m.av.bottom > m.card.top + 1);
    ok(`[${tag}] avatar não sobrepõe o texto (acima do kicker)`, m.av.bottom <= m.kickerTop + 0.5);
    // 3) centralizado no card
    ok(`[${tag}] avatar centralizado no card`, near(m.av.cx, m.card.cx, 1.5));
    // 4) avatar é IRMÃO do card (fora do card)
    ok(`[${tag}] avatar é irmão do card (fora do card)`, m.avParentIsWrap && !m.avParentIsCard);
    // 5) faixa encaixada: overflow:hidden + border-radius => clip garantido; cor do tema correta
    ok(`[${tag}] card overflow:hidden (faixa clipada aos cantos)`, /hidden/.test(m.cardOverflow));
    ok(`[${tag}] card border-radius preservado (>=16)`, m.cardRadius >= 16);
    ok(`[${tag}] faixa no topo (::before top:0)`, m.barTop === "0px");
    const wantBar = level === "critical" ? "rgb(220, 38, 38)" : "rgb(245, 158, 11)";
    ok(`[${tag}] faixa com cor do tema (${wantBar})`, m.barBg === wantBar);
    // 6) título correto por nível
    ok(`[${tag}] kicker correto`, m.kickerText === (level === "critical" ? "URGENTE" : "ATENÇÃO"));
  }
}

// paridade amarelo × vermelho: mesma geometria de avatar/card em 100%
{
  const a = (await measure("warning", 1)).m, b = (await measure("critical", 1)).m;
  ok("paridade amarelo×vermelho: avatar.top idêntico", near(a.av.top, b.av.top, 0.5));
  ok("paridade amarelo×vermelho: card.top idêntico", near(a.card.top, b.card.top, 0.5));
  ok("paridade amarelo×vermelho: avatar.cx idêntico", near(a.av.cx, b.av.cx, 0.5));
}

await browser.close();
console.log("\n===== F3.5.4M — PROVA GEOMÉTRICA DO LEMBRETE CENTRAL =====");
if (flog.length) console.log("\n" + flog.join("\n") + "\n");
console.log("F3.5.4M-VISUAL: " + pass + " OK, " + fail + " FAIL");
if (fail) { console.error("::error:: geometria do lembrete divergiu do acabamento esperado"); process.exit(1); }
console.log("OK — avatar 100% visível e centralizado; faixa encaixada (overflow:hidden+radius); paridade amarelo/vermelho; estável em 100/125/150%.");
