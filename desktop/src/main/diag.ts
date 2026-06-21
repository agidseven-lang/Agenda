// F3.3.10-DIAG — Logger LOCAL de diagnóstico (build instrumentada). SOMENTE arquivo local:
// não envia nada à rede, não grava Firestore, não faz deploy, não altera a lógica aprovada.
// Serve apenas para PROVAR, num teste real em Windows, onde a notificação de atribuição para
// (listener do main recebe? canal toast/nativa? Notification criada?). Removível antes do build final.
import { app } from "electron";
import fs from "fs";
import os from "os";
import path from "path";

let _file = "";
function logFile(): string {
  if (_file) return _file;
  let dir = "";
  try { dir = app.getPath("userData"); } catch { dir = os.tmpdir(); }
  _file = path.join(dir, "idseven-notif-diag.log");
  return _file;
}
export function diagPath(): string { return logFile(); }
export function diag(tag: string, data?: unknown): void {
  try {
    const line = `[${new Date().toISOString()}] ${tag}` + (data !== undefined ? " " + JSON.stringify(data) : "") + "\n";
    fs.appendFileSync(logFile(), line);
  } catch { /* o log NUNCA pode quebrar o app */ }
}
