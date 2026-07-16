/* =====================================================================
   F3.3.74C — IPC do compartilhamento NATIVO (Windows Share Contract).
   O renderer entrega o sharePackage (bytes do PNG + legenda + URL + tipo);
   este módulo grava o PNG num diretório temporário PRÓPRIO, escreve o
   arquivo de requisição (TSV com campos base64) e spawna o helper nativo
   AgendaIdSeven.NativeShare.exe (empacotado em resources/native-share),
   que monta UM ÚNICO DataPackage (StorageItems+Text+WebLink+Title/Desc)
   e abre o Windows Share UI. Eventos JSON do helper (stdout, sanitizados)
   são repassados ao renderer no resultado. Limpeza: os temporários do
   pedido são removidos ao final; varredura remove sobras com >1h (o alvo
   pode ler o arquivo de forma tardia — nunca apagar imediatamente antes
   de o helper encerrar). NUNCA loga legenda/URL completa/token/JWT.
   ===================================================================== */
import { ipcMain, app } from "electron";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { diag } from "./diag";

type NativeShareRequest = {
  type: "SCHEDULE" | "VIDEO_SCRIPT";
  imageBytes: ArrayBuffer | Uint8Array;
  captionText: string;
  approvalUrl: string;
  title: string;
  description: string;
  clientName?: string;
  contentHash?: string;
  traceId?: string;
};
type HelperEvent = { evt: string; [k: string]: unknown };
type NativeShareResult = {
  ok: boolean; stage: string; canceled: boolean; timeout: boolean;
  target: string; reason: string; events: HelperEvent[]; helperExit: number | null;
};

const SHARE_TMP_DIR = () => path.join(app.getPath("temp"), "agenda-idseven-share");

export function helperPath(): string {
  // empacotado: resources/native-share/AgendaIdSeven.NativeShare.exe; dev: desktop/native-share/publish
  const packed = path.join(process.resourcesPath || "", "native-share", "AgendaIdSeven.NativeShare.exe");
  if (process.resourcesPath && fs.existsSync(packed)) return packed;
  const dev = path.join(app.getAppPath(), "native-share", "publish", "AgendaIdSeven.NativeShare.exe");
  return dev;
}

function sweepStale(dir: string): void {
  try {
    if (!fs.existsSync(dir)) return;
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      try { if (fs.statSync(p).mtimeMs < cutoff) fs.unlinkSync(p); } catch { /* melhor-esforço */ }
    }
  } catch { /* melhor-esforço */ }
}

function validReq(r: NativeShareRequest): string {
  if (!r || (r.type !== "SCHEDULE" && r.type !== "VIDEO_SCRIPT")) return "tipo_invalido";
  const len = r.imageBytes ? (r.imageBytes as ArrayBuffer).byteLength ?? (r.imageBytes as Uint8Array).length : 0;
  if (!len || len < 1024) return "imagem_ausente";
  if (!r.captionText || r.captionText.length < 20) return "legenda_ausente";
  if (!r.approvalUrl || !/^https:\/\//.test(r.approvalUrl)) return "url_invalida";
  if (r.captionText.indexOf(r.approvalUrl) < 0) return "legenda_sem_link";
  if (!r.title) return "titulo_ausente";
  return "";
}

export function registerNativeShareIpc(): void {
  ipcMain.handle("native-share", async (_e, req: NativeShareRequest): Promise<NativeShareResult> => {
    const R: NativeShareResult = { ok: false, stage: "init", canceled: false, timeout: false, target: "", reason: "", events: [], helperExit: null };
    const bad = validReq(req);
    if (bad) { R.stage = "validate"; R.reason = bad; diag("nativeshare.reject", { reason: bad }); return R; }
    const exe = helperPath();
    if (process.platform !== "win32") { R.stage = "platform"; R.reason = "somente_windows"; return R; }
    if (!fs.existsSync(exe)) { R.stage = "helper"; R.reason = "helper_ausente"; diag("nativeshare.helper_missing", {}); return R; }
    const dir = SHARE_TMP_DIR();
    sweepStale(dir);
    try { fs.mkdirSync(dir, { recursive: true }); } catch { /* já existe */ }
    const stamp = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    const png = path.join(dir, "card-" + stamp + ".png");
    const reqFile = path.join(dir, "req-" + stamp + ".tsv");
    try {
      fs.writeFileSync(png, Buffer.from(req.imageBytes as ArrayBuffer));
      const b64 = (s: string) => Buffer.from(String(s || ""), "utf8").toString("base64");
      const tsv = [
        "type\t" + req.type,
        "image\t" + png,
        "captionB64\t" + b64(req.captionText),
        "url\t" + req.approvalUrl,
        "titleB64\t" + b64(req.title),
        "descB64\t" + b64(req.description || ""),
        "trace\t" + String(req.traceId || "").replace(/[^A-Za-z0-9-]/g, ""),
      ].join("\n") + "\n";
      fs.writeFileSync(reqFile, tsv, "utf8");
    } catch (e: any) {
      R.stage = "tempfile"; R.reason = "temp_falhou";
      diag("nativeshare.tempfail", { err: String(e && e.message).slice(0, 80) });
      return R;
    }
    diag("nativeshare.start", { type: req.type, trace: req.traceId || "", png: "card-" + stamp + ".png" });
    const result = await new Promise<NativeShareResult>((resolve) => {
      let buf = "";
      const child = spawn(exe, ["share", reqFile], { windowsHide: false, stdio: ["ignore", "pipe", "pipe"] });
      const timer = setTimeout(() => { try { child.kill(); } catch { /* */ } }, 200000);
      child.stdout.on("data", (d: Buffer) => {
        buf += d.toString("utf8");
        let idx: number;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx).trim(); buf = buf.slice(idx + 1);
          if (!line) continue;
          try {
            const ev = JSON.parse(line) as HelperEvent;
            R.events.push(ev);
            if (ev.evt === "target_selected") R.target = String((ev as any).targetName || "");
            if (ev.evt === "share_completed") { R.ok = true; R.stage = "share_completed"; if ((ev as any).target) R.target = R.target || String((ev as any).target); }
            if (ev.evt === "share_canceled") { R.canceled = true; R.stage = "share_canceled"; }
            if (ev.evt === "share_timeout" || ev.evt === "share_dismissed") { R.timeout = true; R.stage = String(ev.evt); }
            if (ev.evt === "helper_failed") { R.stage = "helper_failed"; R.reason = String((ev as any).reason || "helper_failed"); }
            diag("nativeshare.evt", { evt: ev.evt, target: R.target ? "sim" : "", trace: req.traceId || "" });
          } catch { /* linha não-JSON: ignora */ }
        }
      });
      child.stderr.on("data", () => { /* nunca logar conteúdo bruto */ });
      child.on("error", () => { R.stage = "helper"; R.reason = "spawn_falhou"; clearTimeout(timer); resolve(R); });
      child.on("close", (code) => {
        clearTimeout(timer);
        R.helperExit = code;
        if (!R.ok && !R.canceled && !R.timeout && !R.reason) R.reason = "sem_confirmacao";
        // limpeza dos temporários DESTE pedido (helper já encerrou; alvo já consumiu ou desistiu)
        try { fs.unlinkSync(reqFile); } catch { /* */ }
        try { fs.unlinkSync(png); } catch { /* */ }
        diag("nativeshare.done", { ok: R.ok, stage: R.stage, exit: code, trace: req.traceId || "" });
        resolve(R);
      });
    });
    return result;
  });
  // FASE 3 — capability probe (usado pela UI p/ decidir fluxo principal × fallback)
  ipcMain.handle("native-share-available", () => {
    return { available: process.platform === "win32" && fs.existsSync(helperPath()) };
  });
}
