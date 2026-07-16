/* =====================================================================
   F3.3.73I6C18C + C20 + C23 + C24C — PREWARM do Card Premium (processo MAIN).
   Prepara e VALIDA o link /share ANTES de o renderer abrir o WhatsApp.
   C23: a URL pública é servida por SHARE SNAPSHOT imutável (o renderer publica o
   snapshot via POST /share-snapshot autenticado ANTES deste prewarm); aqui exige-se
   também X-Share-Snapshot=ready nos DOIS GETs — sem snapshot publicado não há sucesso.
   C24C (QA): BUILD DE QA — HOST aponta para o Worker QA (idseven-push-qa). O prewarm
   agora retorna um OBJETO ESTRUTURADO {ok, stage, reason, status, taskState, shareType,
   snapshotState, cacheState, imageState, timings} (sem token/URL) para diagnóstico
   sanitizado, e propaga um X-QA-Trace-Id opaco (correlação; nunca contém token/tarefa).
   CONTRATO (cumulativo — QUALQUER divergência = falha, WhatsApp fechado):
     GET#1: 200 + text/html + X-Share-Task=resolved + X-Share-Type=<tipo
            esperado> + X-Share-Snapshot=ready + OG completo (title/description/
            image/url) + og:url EXATO + og:image:width=1200 + og:image:height=630 +
            confirmação textual do tipo;
     IMAGEM: og:image acessível (200 + image/jpeg|png) no MESMO domínio;
     GET#2: mesmas exigências + X-Share-Cache=hit (o WhatsApp NUNCA deve
            raspar antes de existir HIT tipado) + mesmo X-Share-Type.
   not_found/error NUNCA viram sucesso (nem por velocidade); NÃO existe
   sucesso alternativo sem prova de cache (o antigo atalho sem header foi REMOVIDO).
   SEGURANÇA: só https://idseven-push-qa.agidseven.workers.dev/share/cronograma/<token>
   (sem bridge genérica); token NUNCA logado (<token-redacted>); GET read-only;
   redirect 3xx rejeitado; timeout NUNCA é sucesso.
   ===================================================================== */
import { ipcMain } from "electron";
import { diag } from "./diag";

const SHARE_PATH = "/share/cronograma/";
const HOST = "idseven-push-qa.agidseven.workers.dev"; // F3.3.73I6C24C — BUILD QA (Worker QA exclusivo)
const TIMEOUT_MS = 12000;
const QA_TRACE_RE = /^[A-Za-z0-9-]{8,64}$/;

export function redactShareUrl(u: unknown): string {
  try { const x = new URL(String(u)); return x.origin + SHARE_PATH + "<token-redacted>"; }
  catch { return "<url-invalida>"; }
}

export function isAllowedShareUrl(u: unknown): boolean {
  let x: URL; try { x = new URL(String(u)); } catch { return false; }
  if (x.protocol !== "https:") return false;
  if (x.hostname !== HOST) return false;
  if (x.port && x.port !== "443") return false;
  if (x.username || x.password || x.search || x.hash) return false;
  if (!x.pathname.startsWith(SHARE_PATH)) return false;
  const token = x.pathname.slice(SHARE_PATH.length).replace(/\/$/, "");
  return /^[A-Za-z0-9_-]{4,128}$/.test(token);
}

/* imagem OG: mesmo host, https, path /og/*.jpg|png — nada além disso é buscável */
export function isAllowedOgImageUrl(u: unknown): boolean {
  let x: URL; try { x = new URL(String(u)); } catch { return false; }
  return x.protocol === "https:" && x.hostname === HOST && !x.search && !x.hash &&
    /^\/og\/[A-Za-z0-9._-]+\.(jpg|png)$/.test(x.pathname);
}

function sanitizeTrace(t: unknown): string {
  const v = String(t || "");
  return QA_TRACE_RE.test(v) ? v : "";
}

export function validateOgHtml(html: unknown, url: unknown, expectedType: unknown): { ok: boolean; reason?: string } {
  const h = String(html || "");
  const u = String(url || "");
  if (h.indexOf('property="og:title"') < 0) return { ok: false, reason: "og_incompleto_title" };
  if (h.indexOf('property="og:description"') < 0) return { ok: false, reason: "og_incompleto_description" };
  if (h.indexOf('property="og:image"') < 0) return { ok: false, reason: "og_incompleto_image" };
  if (h.indexOf('property="og:url"') < 0) return { ok: false, reason: "og_incompleto_url" };
  if (h.indexOf('property="og:url" content="' + u + '"') < 0) return { ok: false, reason: "og_url_divergente" };
  // C24C: dimensões corretas exigidas pelo contrato do card (1200×630).
  if (h.indexOf('og:image:width" content="1200"') < 0) return { ok: false, reason: "og_dimensao_largura" };
  if (h.indexOf('og:image:height" content="630"') < 0) return { ok: false, reason: "og_dimensao_altura" };
  const temRoteiro = h.indexOf("Aprovar roteiro") >= 0 || h.indexOf("Roteiro de gravação de vídeos") >= 0;
  const temCronograma = h.indexOf("Aprovar cronograma") >= 0;
  if (expectedType === "roteiro") {
    if (temRoteiro) return { ok: true };
    return { ok: false, reason: temCronograma ? "roteiro_recebeu_og_de_cronograma" : "tipo_nao_confirmado" };
  }
  if (temCronograma) return { ok: true };
  return { ok: false, reason: "tipo_nao_confirmado" };
}

export function extractOgImage(html: unknown): string {
  const m = String(html || "").match(/property="og:image" content="([^"]+)"/);
  return m ? m[1] : "";
}

type ShareFetch = { ok: boolean; reason?: string; status?: number; contentType?: string; xShareCache?: string; xShareTask?: string; xShareType?: string; xShareSnapshot?: string; elapsedMs: number; html?: string };

async function fetchShare(url: string, timeoutMs: number, traceId: string): Promise<ShareFetch> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const headers: Record<string, string> = {};
    if (traceId) headers["X-QA-Trace-Id"] = traceId;
    const res = await fetch(url, { method: "GET", redirect: "manual", signal: ac.signal, headers });
    const elapsedMs = Date.now() - t0;
    const status = res.status;
    const contentType = String(res.headers.get("content-type") || "");
    const xShareCache = String(res.headers.get("x-share-cache") || "");
    const xShareTask = String(res.headers.get("x-share-task") || "");
    const xShareType = String(res.headers.get("x-share-type") || "");
    const xShareSnapshot = String(res.headers.get("x-share-snapshot") || "");
    if (status >= 300 && status < 400) return { ok: false, reason: "redirect_bloqueado", status, xShareTask, xShareType, xShareSnapshot, elapsedMs };
    // contrato C20/C23: not_found/error são estados EXPLÍCITOS — nunca sucesso.
    if (xShareTask === "not_found") return { ok: false, reason: "task_not_found", status, xShareTask, elapsedMs };
    if (xShareTask === "error") return { ok: false, reason: "task_error", status, xShareTask, elapsedMs };
    if (status !== 200) return { ok: false, reason: "http_" + status, status, elapsedMs };
    if (contentType.indexOf("text/html") < 0) {
      return { ok: false, reason: contentType.indexOf("application/json") >= 0 ? "resposta_json" : "content_type_invalido", status, contentType, elapsedMs };
    }
    const html = await res.text();
    return { ok: true, status, contentType, xShareCache, xShareTask, xShareType, xShareSnapshot, elapsedMs, html };
  } catch {
    // rede caiu OU o timeout abortou — timeout NUNCA é tratado como sucesso
    return { ok: false, reason: "rede_ou_timeout", elapsedMs: Date.now() - t0 };
  } finally { clearTimeout(timer); }
}

type ImgResult = { ok: boolean; contentType?: string; status?: number };
async function fetchOgImage(imgUrl: string, timeoutMs: number): Promise<ImgResult> {
  if (!isAllowedOgImageUrl(imgUrl)) return { ok: false };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(imgUrl, { method: "GET", redirect: "manual", signal: ac.signal });
    const ct = String(res.headers.get("content-type") || "");
    const ok = res.status === 200 && (ct.indexOf("image/jpeg") >= 0 || ct.indexOf("image/png") >= 0);
    return { ok, contentType: ct, status: res.status };
  } catch { return { ok: false }; } finally { clearTimeout(timer); }
}

function legReason(g: ShareFetch, url: string, expectedType: string): { ok: boolean; reason?: string } {
  if (!g.ok) return { ok: false, reason: g.reason };
  if (g.xShareTask !== "resolved") return { ok: false, reason: "task_nao_resolvida" };
  if (g.xShareType !== expectedType) return { ok: false, reason: "tipo_header_divergente" };
  // C23: o card SÓ é confiável se veio de snapshot PUBLICADO (nunca de resolução dinâmica).
  if (g.xShareSnapshot !== "ready") return { ok: false, reason: "snapshot_nao_confirmado" };
  const v = validateOgHtml(g.html, url, expectedType);
  if (!v.ok) return { ok: false, reason: v.reason };
  return { ok: true };
}

/* F3.3.73I6C24C — objeto ESTRUTURADO de resultado (sem token/URL). Descreve o
   primeiro ponto de falha e o estado observado de cada elo do contrato. */
type PrewarmResult = {
  ok: boolean; stage: string; reason: string;
  status: number | null; taskState: string; shareType: string;
  snapshotState: string; cacheState: string; imageState: string;
  timings: { get1Ms: number | null; imgMs: number | null; get2Ms: number | null };
};
function baseResult(): PrewarmResult {
  return { ok: false, stage: "init", reason: "nao_executou", status: null, taskState: "unknown",
    shareType: "unknown", snapshotState: "unknown", cacheState: "unknown", imageState: "unknown",
    timings: { get1Ms: null, imgMs: null, get2Ms: null } };
}

export async function prepareCardOnce(url: string, expectedType: string, traceId: string): Promise<PrewarmResult> {
  const R = baseResult();
  // ── GET#1 ──
  const g1 = await fetchShare(url, TIMEOUT_MS, traceId);
  R.status = g1.status ?? null; R.timings.get1Ms = g1.elapsedMs;
  R.taskState = g1.xShareTask || (g1.reason === "task_not_found" ? "not_found" : g1.reason === "task_error" ? "error" : "unknown");
  R.shareType = g1.xShareType || "unknown";
  R.snapshotState = g1.xShareSnapshot || "unknown";
  const c1 = legReason(g1, url, expectedType);
  diag("qa.desktop.share.get1", { ok: c1.ok, status: g1.status, task: g1.xShareTask, type: g1.xShareType, snap: g1.xShareSnapshot, reason: c1.reason, ms: g1.elapsedMs, trace: traceId, url: redactShareUrl(url) });
  if (!c1.ok) { R.stage = "get1"; R.reason = c1.reason || "get1_falhou"; return R; }
  // ── IMAGEM ──
  const img = extractOgImage(g1.html);
  const im = await fetchOgImage(img, TIMEOUT_MS);
  R.imageState = im.ok ? "ok" : "invalid";
  diag("qa.desktop.share.image", { ok: im.ok, status: im.status, ct: im.contentType, trace: traceId });
  if (!im.ok) { R.stage = "img"; R.reason = "imagem_inacessivel"; return R; }
  // ── GET#2 (cache HIT obrigatório) ──
  const g2 = await fetchShare(url, TIMEOUT_MS, traceId);
  R.timings.get2Ms = g2.elapsedMs;
  const c2 = legReason(g2, url, expectedType);
  R.cacheState = g2.xShareCache || "unknown";
  diag("qa.desktop.share.get2", { ok: c2.ok, status: g2.status, cache: g2.xShareCache, type: g2.xShareType, reason: c2.reason, ms: g2.elapsedMs, trace: traceId });
  if (!c2.ok) { R.stage = "get2"; R.reason = c2.reason || "get2_falhou"; return R; }
  if (g2.xShareType !== g1.xShareType) { R.stage = "get2"; R.reason = "tipo_divergente_entre_gets"; return R; }
  const hit = /hit/i.test(String(g2.xShareCache || ""));
  if (!hit) { R.stage = "cache"; R.reason = "cache_nao_confirmado"; return R; }
  R.ok = true; R.stage = "done"; R.reason = "ok";
  return R;
}

/* single-flight por URL: cliques/chamadas duplicadas reaproveitam a MESMA preparação */
const inflight = new Map<string, Promise<PrewarmResult>>();

export function registerPrewarmIpc(): void {
  ipcMain.handle("card-prewarm", async (_e, url: string, expectedType: string, traceIdRaw?: string) => {
    const traceId = sanitizeTrace(traceIdRaw);
    if (!isAllowedShareUrl(url)) {
      diag("qa.desktop.prewarm.fail", { stage: "url", reason: "url_nao_permitida", trace: traceId, url: redactShareUrl(url) });
      const R = baseResult(); R.stage = "url"; R.reason = "url_nao_permitida"; return R;
    }
    const tipo = expectedType === "roteiro" ? "roteiro" : "cronograma";
    const existing = inflight.get(url);
    if (existing) return existing;
    const run = (async () => {
      const BACKOFF = [0, 800, 1500];  // máx. 3 tentativas, intervalo progressivo — sem loop infinito
      let last: PrewarmResult = baseResult();
      for (let i = 0; i < 3; i++) {
        if (BACKOFF[i] > 0) await new Promise((r) => setTimeout(r, BACKOFF[i]));
        last = await prepareCardOnce(url, tipo, traceId);
        diag("prewarm.tentativa", { n: i + 1, ok: last.ok, stage: last.stage, reason: last.reason, cache: last.cacheState, tipo, trace: traceId, url: redactShareUrl(url) });
        if (last.ok) break;
        // not_found é DEFINITIVO para esta URL (tarefa não existe): retry não muda o fato.
        if (last.reason === "task_not_found") break;
      }
      diag(last.ok ? "qa.desktop.prewarm.ready" : "qa.desktop.prewarm.fail", { stage: last.stage, reason: last.reason, type: last.shareType, snap: last.snapshotState, cache: last.cacheState, img: last.imageState, trace: traceId });
      return last;
    })();
    inflight.set(url, run);
    try { return await run; } finally { inflight.delete(url); }
  });
}
