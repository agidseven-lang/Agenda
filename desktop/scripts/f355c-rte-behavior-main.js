/* F3.5.5C — SMOKE COMPORTAMENTAL do núcleo RTE no Chromium REAL do Electron.
 * Extrai as funções REAIS do renderer (esc + núcleo canônico + rteEditableHtml — nenhuma
 * cópia divergente) e roda a bateria f355c-rte-battery.js (91 casos: payloads maliciosos
 * inertes, Word/mso, Google Docs, stWrap, fixpoint, paridade, projeção, desempenho).
 * SRC= aponta o index empacotado p/ o gate do asar. Sai 0 só com 0 FAIL. */
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

app.disableHardwareAcceleration();
process.on("uncaughtException", (e) => { console.error("FATAL " + ((e && e.message) || e)); app.exit(3); });

const IDX = process.env.SRC ? path.resolve(process.env.SRC) : path.join(__dirname, "..", "src", "renderer", "index.html");
const html = fs.readFileSync(IDX, "utf8");
function seg(a, b, n) {
  const i = html.indexOf(a); const j = html.indexOf(b, i + a.length);
  if (i < 0 || j < 0) throw new Error("âncora ausente: " + n);
  return html.slice(i, j);
}
const escFn = html.match(/function esc\(s\)\{[^\n]*\}/)[0];
const core = seg("var RTE_COLORS=", "var _RTE_ICO={", "núcleo RTE");
const editable = seg("function rteEditableHtml", "function rteField", "rteEditableHtml");
const battery = fs.readFileSync(path.join(__dirname, "f355c-rte-battery.js"), "utf8");
const page = '<!doctype html><meta charset="utf-8"><title>f355c-rte-smoke</title><body><script>\n'
  + escFn + "\n" + core + "\n" + editable + "\n" + battery + "\n<\/script></body>";
const P = path.join(os.tmpdir(), "f355c-rte-smoke.html");
fs.writeFileSync(P, page);

let done = false;
const wd = setTimeout(() => { console.error("SMOKE WATCHDOG (180s)"); app.exit(2); }, 180000);
app.whenReady().then(() => {
  const w = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  w.webContents.on("console-message", (_e, _lvl, message) => {
    console.log(message);
    if (message.indexOf("SMOKE_DONE ") === 0 && !done) {
      done = true; clearTimeout(wd);
      let fail = 1; try { fail = JSON.parse(message.slice("SMOKE_DONE ".length)).fail; } catch (_) {}
      setTimeout(() => app.exit(fail ? 1 : 0), 100);
    }
  });
  w.loadFile(P);
});
