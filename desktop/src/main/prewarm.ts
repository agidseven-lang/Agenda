/* =====================================================================
   F3.3.73I6C18C — PREWARM do Card Premium (processo MAIN; IPC restrito).
   Prepara e VALIDA o link /share ANTES de o renderer abrir o WhatsApp:
     GET#1 (status/Content-Type/OG completo/og:url exato/TIPO esperado)
     → GET#2 (confirma cache: X-Share-Cache=hit preferencial; alternativa
       DOCUMENTADA somente se o header não vier).
   SEGURANÇA:
     - operação LIMITADA a https://aprovar.agendaidseven.com.br/share/cronograma/<token>
       (sem bridge genérica de rede; qualquer outra URL é rejeitada);
     - token NUNCA é logado — logs usam /share/cronograma/<token-redacted>;
     - somente GET read-only; sem Firestore; sem escrita; sem aprovação;
     - redirect (3xx) é REJEITADO (redirect:"manual");
     - timeout por tentativa NUNCA vira sucesso;
     - PROIBIDO fallback que classifique Roteiro como Cronograma: se uma
       tarefa de Roteiro receber OG de Cronograma, a preparação FALHA.
   ===================================================================== */
import { ipcMain } from "electron";
import { diag } from "./diag";

const SHARE_PATH = "/share/cronograma/";
const TIMEOUT_MS = 12000;

export function redactShareUrl(u: unknown): string {
  try { const x = new URL(String(u)); return x.origin + SHARE_PATH + "<token-redacted>"; }
  catch { return "<url-invalida>"; }
}

export function isAllowedShareUrl(u: unknown): boolean {
  let x: URL; try { x = new URL(String(u)); } catch { return false; }
  if (x.protocol !== "https:") return false;
  if (x.hostname !== "aprovar.agendaidseven.com.br") return false;
  if (x.port && x.port !== "443") return false;
  if (x.username || x.password || x.search || x.hash) return false;
  if (!x.pathname.startsWith(SHARE_PATH)) return false;
  const token = x.pathname.slice(SHARE_PATH.length).replace(/\/$/, "");
  return /^[A-Za-z0-9_-]{4,128}$/.test(token);
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

type ShareFetch = { ok: boolean; reason?: string; status?: number; contentType?: string; xShareCache?: string; elapsedMs: number; html?: string };

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
    if (status >= 300 && status < 400) return { ok: false, reason: "redirect_bloqueado", status, elapsedMs };
    if (status !== 200) return { ok: false, reason: "http_" + status, status, elapsedMs };
    if (contentType.indexOf("text/html") < 0) {
      return { ok: false, reason: contentType.indexOf("application/json") >= 0 ? "resposta_json" : "content_type_invalido", status, contentType, elapsedMs };
    }
    const html = await res.text();
    return { ok: true, status, contentType, xShareCache, elapsedMs, html };
  } catch {
    // rede caiu OU o timeout abortou — timeout NUNCA é tratado como sucesso
    return { ok: false, reason: "rede_ou_timeout", elapsedMs: Date.now() - t0 };
  } finally { clearTimeout(timer); }
}

async function prepareCardOnce(url: string, expectedType: string): Promise<Record<string, unknown>> {
  const g1 = await fetchShare(url, TIMEOUT_MS);
  if (!g1.ok) return { ok: false, step: "get1", reason: g1.reason };
  const v1 = validateOgHtml(g1.html, url, expectedType);
  if (!v1.ok) return { ok: false, step: "og1", reason: v1.reason };
  const g2 = await fetchShare(url, TIMEOUT_MS);
  if (!g2.ok) return { ok: false, step: "get2", reason: g2.reason };
  const v2 = validateOgHtml(g2.html, url, expectedType);
  if (!v2.ok) return { ok: false, step: "og2", reason: v2.reason };
  const hit = /hit/i.test(String(g2.xShareCache || ""));
  // PREFERENCIAL: header X-Share-Cache=hit (C18B) prova o cache de borda preparado.
  // ALTERNATIVA DOCUMENTADA (somente se o header NÃO estiver disponível — ex.: proxy
  // corporativo removendo headers): 2ª resposta VÁLIDA, MESMO OG esperado, latência
  // compatível com resposta aquecida (≤ GET#1 e < 1200 ms) e nenhuma nova falha.
  const aquecidoSemHeader = !g2.xShareCache && g2.elapsedMs < 1200 && g2.elapsedMs <= g1.elapsedMs;
  if (!hit && !aquecidoSemHeader) return { ok: false, step: "cache", reason: "cache_nao_confirmado" };
  return { ok: true, cache: hit ? "hit" : "aquecido_sem_header", get1Ms: g1.elapsedMs, get2Ms: g2.elapsedMs };
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
      }
      return last;
    })();
    inflight.set(url, run);
    try { return await run; } finally { inflight.delete(url); }
  });
}
