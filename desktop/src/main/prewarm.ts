/* =====================================================================
   F3.3.73I6C18C + F3.3.73I6C20 — PREWARM do Card Premium (processo MAIN).
   Prepara e VALIDA o link /share ANTES de o renderer abrir o WhatsApp.
   CONTRATO C20 (cumulativo — QUALQUER divergência = falha, WhatsApp fechado):
     GET#1: 200 + text/html + X-Share-Task=resolved + X-Share-Type=<tipo
            esperado> + OG completo (title/description/image/url) + og:url
            EXATO + confirmação textual do tipo;
     IMAGEM: og:image acessível (200 + image/jpeg) no MESMO domínio;
     GET#2: mesmas exigências + X-Share-Cache=hit (o WhatsApp NUNCA deve
            raspar antes de existir HIT tipado) + mesmo X-Share-Type.
   not_found/error NUNCA viram sucesso (nem por velocidade); NÃO existe
   sucesso alternativo sem prova de cache (o antigo atalho sem header foi REMOVIDO).
   SEGURANÇA: só https://aprovar.agendaidseven.com.br/share/cronograma/<token>
   (sem bridge genérica); token NUNCA logado (<token-redacted>); GET read-only;
   redirect 3xx rejeitado; timeout NUNCA é sucesso.
   ===================================================================== */
import { ipcMain } from "electron";
import { diag } from "./diag";

const SHARE_PATH = "/share/cronograma/";
const HOST = "aprovar.agendaidseven.com.br";
const TIMEOUT_MS = 12000;

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

/* imagem OG: mesmo host, https, path /og/*.jpg — nada além disso é buscável */
export function isAllowedOgImageUrl(u: unknown): boolean {
  let x: URL; try { x = new URL(String(u)); } catch { return false; }
  return x.protocol === "https:" && x.hostname === HOST && !x.search && !x.hash &&
    /^\/og\/[A-Za-z0-9._-]+\.jpg$/.test(x.pathname);
}

export function validateOgHtml(html: unknown, url: unknown, expectedType: unknown): { ok: boolean; reason?: string } {
  const h = String(html || "");
  const u = String(url || "");
  if (h.indexOf('property="og:title"') < 0) return { ok: false, reason: "og_incompleto_title" };
  if (h.indexOf('property="og:description"') < 0) return { ok: false, reason: "og_incompleto_description" };
  if (h.indexOf('property="og:image"') < 0) return { ok: false, reason: "og_incompleto_image" };
  if (h.indexOf('property="og:url"') < 0) return { ok: false, reason: "og_incompleto_url" };
  if (h.indexOf('property="og:url" content="' + u + '"') < 0) return { ok: false, reason: "og_url_divergente" };
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

type ShareFetch = { ok: boolean; reason?: string; status?: number; contentType?: string; xShareCache?: string; xShareTask?: string; xShareType?: string; elapsedMs: number; html?: string };

async function fetchShare(url: string, timeoutMs: number): Promise<ShareFetch> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(url, { method: "GET", redirect: "manual", signal: ac.signal });
    const elapsedMs = Date.now() - t0;
    const status = res.status;
    const contentType = String(res.headers.get("content-type") || "");
    const xShareCache = String(res.headers.get("x-share-cache") || "");
    const xShareTask = String(res.headers.get("x-share-task") || "");
    const xShareType = String(res.headers.get("x-share-type") || "");
    if (status >= 300 && status < 400) return { ok: false, reason: "redirect_bloqueado", status, elapsedMs };
    // contrato C20: not_found/error são estados EXPLÍCITOS — nunca sucesso.
    if (xShareTask === "not_found") return { ok: false, reason: "task_not_found", status, xShareTask, elapsedMs };
    if (xShareTask === "error") return { ok: false, reason: "task_error", status, xShareTask, elapsedMs };
    if (status !== 200) return { ok: false, reason: "http_" + status, status, elapsedMs };
    if (contentType.indexOf("text/html") < 0) {
      return { ok: false, reason: contentType.indexOf("application/json") >= 0 ? "resposta_json" : "content_type_invalido", status, contentType, elapsedMs };
    }
    const html = await res.text();
    return { ok: true, status, contentType, xShareCache, xShareTask, xShareType, elapsedMs, html };
  } catch {
    // rede caiu OU o timeout abortou — timeout NUNCA é tratado como sucesso
    return { ok: false, reason: "rede_ou_timeout", elapsedMs: Date.now() - t0 };
  } finally { clearTimeout(timer); }
}

async function fetchOgImageOk(imgUrl: string, timeoutMs: number): Promise<boolean> {
  if (!isAllowedOgImageUrl(imgUrl)) return false;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(imgUrl, { method: "GET", redirect: "manual", signal: ac.signal });
    const ct = String(res.headers.get("content-type") || "");
    return res.status === 200 && ct.indexOf("image/jpeg") >= 0;
  } catch { return false; } finally { clearTimeout(timer); }
}

function checkLeg(g: ShareFetch, url: string, expectedType: string): { ok: boolean; reason?: string } {
  if (!g.ok) return { ok: false, reason: g.reason };
  if (g.xShareTask !== "resolved") return { ok: false, reason: "task_nao_resolvida" };
  if (g.xShareType !== expectedType) return { ok: false, reason: "tipo_header_divergente" };
  const v = validateOgHtml(g.html, url, expectedType);
  if (!v.ok) return { ok: false, reason: v.reason };
  return { ok: true };
}

async function prepareCardOnce(url: string, expectedType: string): Promise<Record<string, unknown>> {
  const g1 = await fetchShare(url, TIMEOUT_MS);
  const c1 = checkLeg(g1, url, expectedType);
  if (!c1.ok) return { ok: false, step: "get1", reason: c1.reason };
  const img = extractOgImage(g1.html);
  const imgOk = await fetchOgImageOk(img, TIMEOUT_MS);
  if (!imgOk) return { ok: false, step: "img", reason: "imagem_inacessivel" };
  const g2 = await fetchShare(url, TIMEOUT_MS);
  const c2 = checkLeg(g2, url, expectedType);
  if (!c2.ok) return { ok: false, step: "get2", reason: c2.reason };
  if (g2.xShareType !== g1.xShareType) return { ok: false, step: "get2", reason: "tipo_divergente_entre_gets" };
  // prova de cache OBRIGATÓRIA: o WhatsApp só pode raspar depois de existir HIT tipado.
  const hit = /hit/i.test(String(g2.xShareCache || ""));
  if (!hit) return { ok: false, step: "cache", reason: "cache_nao_confirmado" };
  return { ok: true, cache: "hit", get1Ms: g1.elapsedMs, get2Ms: g2.elapsedMs };
}

/* single-flight por URL: cliques/chamadas duplicadas reaproveitam a MESMA preparação */
const inflight = new Map<string, Promise<Record<string, unknown>>>();

export function registerPrewarmIpc(): void {
  ipcMain.handle("card-prewarm", async (_e, url: string, expectedType: string) => {
    if (!isAllowedShareUrl(url)) {
      diag("prewarm.url_rejeitada", { url: redactShareUrl(url) });
      return { ok: false, reason: "url_nao_permitida" };
    }
    const tipo = expectedType === "roteiro" ? "roteiro" : "cronograma";
    const existing = inflight.get(url);
    if (existing) return existing;
    const run = (async () => {
      const BACKOFF = [0, 800, 1500];  // máx. 3 tentativas, intervalo progressivo — sem loop infinito
      let last: Record<string, unknown> = { ok: false, reason: "nao_executou" };
      for (let i = 0; i < 3; i++) {
        if (BACKOFF[i] > 0) await new Promise((r) => setTimeout(r, BACKOFF[i]));
        last = await prepareCardOnce(url, tipo);
        diag("prewarm.tentativa", { n: i + 1, ok: last.ok, step: last.step, reason: last.reason, cache: last.cache, get1Ms: last.get1Ms, get2Ms: last.get2Ms, tipo, url: redactShareUrl(url) });
        if (last.ok) break;
        // not_found é DEFINITIVO para esta URL (tarefa não existe): retry não muda o fato.
        if (last.reason === "task_not_found") break;
      }
      return last;
    })();
    inflight.set(url, run);
    try { return await run; } finally { inflight.delete(url); }
  });
}
