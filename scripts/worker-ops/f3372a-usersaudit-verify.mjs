#!/usr/bin/env node
/* =====================================================================
   F3.3.72A — Verificacao SERVER-SIDE (SOMENTE LEITURA) da auditoria de
   troca de e-mail em `usersAudit`.
   - Le ate 200 docs da colecao (Admin SDK, ADC via GOOGLE_APPLICATION_
     CREDENTIALS). NENHUM write: o script nao contem add/set/update/delete.
   - Conta eventos por type; detalha SOMENTE email_change_self/_admin.
   - SANITIZACAO: e-mails SEMPRE mascarados (1o char + ***@ + 1o char do
     dominio + *** + TLD); valores de outros campos NAO sao impressos —
     apenas presenca/booleano; chaves proibidas (pass/senha/hash/salt/
     token/secret/segredo) sao procuradas recursivamente e reportadas
     por CAMINHO, nunca por valor. UIDs (by/target) sao impressos para
     rastreabilidade (nao sao segredo).
   Shape esperado (codigo deployado @ a2087eb):
     { type, by, target, emailOld, emailNew, reason, at:number(ms),
       phase:"F3.3.71A" }
   ===================================================================== */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const FORBIDDEN = [/pass/i, /senha/i, /\bhash/i, /salt/i, /token/i, /secret/i, /segredo/i];
const REQUIRED = ["type", "by", "target", "emailOld", "emailNew", "at", "phase"];

function maskEmail(e) {
  if (typeof e !== "string" || !e.includes("@")) return "(invalido/ausente)";
  const [l, d] = e.split("@");
  const dp = d.split(".");
  const tld = dp.length > 1 ? dp.slice(1).join(".") : "";
  return (l[0] || "?") + "***@" + (dp[0][0] || "?") + "***" + (tld ? "." + tld : "");
}
function scanForbiddenKeys(o, path) {
  path = path || [];
  let bad = [];
  if (!o || typeof o !== "object") return bad;
  for (const [k, v] of Object.entries(o)) {
    if (FORBIDDEN.some((r) => r.test(k))) bad.push(path.concat(k).join("."));
    if (v && typeof v === "object" && typeof v.toDate !== "function") bad = bad.concat(scanForbiddenKeys(v, path.concat(k)));
  }
  return bad;
}
function isoAt(v) {
  if (typeof v === "number" && isFinite(v)) return new Date(v).toISOString();
  if (v && typeof v.toDate === "function") return v.toDate().toISOString();
  return "(ausente/nao-numerico)";
}

async function main() {
  initializeApp({ credential: applicationDefault() });
  const db = getFirestore();
  const snap = await db.collection("usersAudit").limit(200).get(); // LEITURA UNICA
  const byType = {};
  const details = [];
  let forbiddenTotal = 0;
  for (const doc of snap.docs) {
    const x = doc.data() || {};
    const t = String(x.type || "(sem type)");
    byType[t] = (byType[t] || 0) + 1;
    if (t === "email_change_self" || t === "email_change_admin") {
      const bad = scanForbiddenKeys(x);
      forbiddenTotal += bad.length;
      details.push({
        docId: doc.id,
        type: t,
        by: typeof x.by === "string" ? x.by : "(ausente)",
        target: typeof x.target === "string" ? x.target : "(ausente)",
        emailOld: maskEmail(x.emailOld),
        emailNew: maskEmail(x.emailNew),
        at: isoAt(x.at),
        phase: typeof x.phase === "string" ? x.phase : "(ausente)",
        reasonLen: typeof x.reason === "string" ? x.reason.length : null,
        camposObrigatoriosPresentes: REQUIRED.every((k) => k in x),
        camposFaltantes: REQUIRED.filter((k) => !(k in x)),
        chavesProibidasEncontradas: bad,
      });
    }
  }
  details.sort((a, b) => (a.at < b.at ? -1 : 1));
  const report = {
    colecaoEncontrada: snap.size > 0,
    totalDocsLidos: snap.size,
    limiteLeitura: 200,
    contagemPorTipo: byType,
    email_change_self: byType["email_change_self"] || 0,
    email_change_admin: byType["email_change_admin"] || 0,
    todosCamposObrigatoriosPresentes: details.length > 0 && details.every((d) => d.camposObrigatoriosPresentes),
    chavesProibidasNosEventos: forbiddenTotal,
    rastreabilidade: details.length > 0 && details.every((d) => d.by !== "(ausente)" && d.target !== "(ausente)"),
    eventos: details,
    writesExecutados: 0,
  };
  console.log("== USERSAUDIT-72A ==");
  console.log(JSON.stringify(report, null, 2));
  console.log("== FIM USERSAUDIT-72A ==");
}
main().catch((e) => { console.error("ERRO-LEITURA:", e && e.message ? e.message : e); process.exit(1); });
