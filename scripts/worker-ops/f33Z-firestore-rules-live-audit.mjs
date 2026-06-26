#!/usr/bin/env node
/*
 * F3.3.20-B1.7-E — Analisador ESTATICO read-only das Firestore Rules live.
 * =====================================================================================
 * Entrada : rules.live.txt  (conteudo das Rules baixado por GET na Firebase Rules API)
 * Saidas  : rules-audit-report.json (estruturado) + rules-audit-summary.md (humano)
 *
 * NAO faz rede, NAO toca Firestore, NAO publica nada. So le um arquivo texto e classifica.
 * Heuristica estatica (parser por chaves + regex de allow): suficiente para auditoria de
 * superficie; nao e um avaliador CEL completo. Marca incerteza explicitamente.
 *
 * Modelo do app (contexto): NAO usa Firebase Auth; autenticacao e custom (users/{uid} com
 * pass/salt) + token HMAC nos endpoints. Logo, `request.auth` e NULL para clientes do app:
 *  - regras baseadas em request.auth(.uid) NAO autenticam o app (efetivamente negam cliente);
 *  - o token HMAC NAO aparece em request.auth — Rules nao conseguem valida-lo;
 *  - isolamento por usuario de notifPrefs depende das Functions, nao das Rules;
 *  - portanto acesso DIRETO a notifPrefs deveria ficar fechado (deny) para clientes.
 */
import crypto from "node:crypto";
import fs from "node:fs";

const inPath = process.argv[2] || "rules.live.txt";
const OUT_JSON = process.env.RULES_AUDIT_JSON || "rules-audit-report.json";
const OUT_MD = process.env.RULES_AUDIT_MD || "rules-audit-summary.md";

const raw = fs.readFileSync(inPath, "utf8");
const sha256 = crypto.createHash("sha256").update(raw, "utf8").digest("hex");

// --- remove comentarios (// linha e /* bloco */) para nao confundir o parser ---
function stripComments(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1"); // evita estragar "https://"
}
const clean = stripComments(raw);

// --- extrai blocos match (recursivo, por balanceamento de chaves) ---
// Paths de match contem chaves de wildcard (ex.: /users/{uid}, /{document=**}); por isso o
// inicio do CORPO e o '{' precedido por espaco (o '{' de wildcard e precedido por '/'). O
// balanceamento de chaves funciona mesmo com wildcards (sao pares {} balanceados). Allows
// "diretos" de um match excluem os que estao dentro de matches aninhados (via spans).
function parseScope(scopeText, prefix, out) {
  const re = /match\s+(.+?)\s+\{/g; // path nao-guloso ate ' {' (corpo)
  const spans = [];
  const nodes = [];
  let m;
  while ((m = re.exec(scopeText))) {
    const path = m[1].trim();
    const braceStart = m.index + m[0].length - 1; // posicao do '{' do corpo
    let depth = 0, end = -1;
    for (let i = braceStart; i < scopeText.length; i++) {
      const c = scopeText[i];
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end < 0) break;
    spans.push([braceStart, end]);
    nodes.push({ path, inner: scopeText.slice(braceStart + 1, end) });
    re.lastIndex = end;
  }
  const ar = /allow\s+([a-z,\s]+?)\s*:\s*if\s+([\s\S]*?);/gi;
  let a;
  const direct = [];
  while ((a = ar.exec(scopeText))) {
    const idx = a.index;
    if (!spans.some(([s, e]) => idx > s && idx < e)) {
      direct.push({ ops: a[1].replace(/\s+/g, " ").trim(), cond: a[2].replace(/\s+/g, " ").trim() });
    }
  }
  if (prefix !== "") out.push({ path: prefix, allows: direct }); // registra o match atual
  for (const n of nodes) parseScope(n.inner, (prefix ? prefix + " > " : "") + n.path, out);
}
const matches = [];
parseScope(clean, "", matches);

function classifyCond(cond) {
  const c = cond.trim();
  if (/^true$/i.test(c)) return "OPEN_TRUE";
  if (/^false$/i.test(c)) return "DENY_FALSE";
  const f = [];
  if (/request\.auth\.uid/.test(c)) f.push("UID");
  if (/request\.auth/.test(c)) f.push("AUTH");
  if (/get\(|exists\(/.test(c)) f.push("LOOKUP");
  if (/admin/i.test(c)) f.push("ADMIN");
  return f.length ? f.join("+") : "OTHER";
}
function opsList(ops) {
  const o = ops.toLowerCase();
  if (o.includes("read") || o.includes("write")) {
    // read => get+list ; write => create+update+delete
  }
  return o.split(",").map((x) => x.trim()).filter(Boolean);
}
function collOf(path) {
  if (/\{document=\*\*\}/.test(path)) return "catchAll";
  if (/\/users\b/.test(path) || /\busers\//.test(path)) return "users";
  if (/notifPrefs/.test(path)) return "notifPrefs";
  return "other";
}

const findings = [];
function add(sev, area, detail, path, ops, cond) {
  findings.push({ severity: sev, area, detail, path, ops, cond });
}

for (const mt of matches) {
  const coll = collOf(mt.path);
  for (const al of mt.allows) {
    const cls = classifyCond(al.cond);
    const ops = opsList(al.ops);
    const isWrite = ops.some((o) => ["write", "create", "update", "delete"].includes(o));
    const isRead = ops.some((o) => ["read", "get", "list"].includes(o));
    if (coll === "catchAll" && cls === "OPEN_TRUE") {
      add("CRITICAL", "global", "catch-all aberto (allow " + al.ops + ": if true)", mt.path, al.ops, al.cond);
    } else if (coll === "users" && isWrite && cls === "OPEN_TRUE") {
      add("CRITICAL", "users", "escrita direta aberta em users (pass/salt/admin/role expostos a escrita anonima)", mt.path, al.ops, al.cond);
    } else if (coll === "users" && isRead && cls === "OPEN_TRUE") {
      add("HIGH", "users", "leitura direta aberta em users (PII: pass/salt/fcmTokens/phone/email)", mt.path, al.ops, al.cond);
    } else if (coll === "notifPrefs" && isWrite && cls === "OPEN_TRUE") {
      add("HIGH", "notifPrefs", "escrita direta aberta em notifPrefs (bypass dos endpoints; HMAC nao verificavel por Rules => cross-user)", mt.path, al.ops, al.cond);
    } else if (coll === "notifPrefs" && isRead && cls === "OPEN_TRUE") {
      add("HIGH", "notifPrefs", "leitura direta aberta em notifPrefs (cross-user; bypass de getNotifPrefs)", mt.path, al.ops, al.cond);
    } else if (cls === "OPEN_TRUE") {
      add("MEDIUM", coll, "allow aberto (if true) em coleção '" + coll + "'", mt.path, al.ops, al.cond);
    } else if (cls === "DENY_FALSE") {
      add("INFO", coll, "deny explicito (if false) — acesso direto fechado", mt.path, al.ops, al.cond);
    } else if (/UID/.test(cls)) {
      add("INFO", coll, "regra uid-scoped (request.auth.uid). App sem Firebase Auth => nega cliente direto; exige Functions/Admin", mt.path, al.ops, al.cond);
    } else if (/AUTH/.test(cls)) {
      add("MEDIUM", coll, "regra baseada em request.auth (app sem Firebase Auth => request.auth=null para clientes)", mt.path, al.ops, al.cond);
    } else {
      add("INFO", coll, "condição '" + cls + "' (revisar manualmente)", mt.path, al.ops, al.cond);
    }
  }
}

// --- presenca de guardas de campo sensivel no texto das Rules ---
const sensitive = ["pass", "salt", "fcmTokens", "phone", "email", "role", "admin", "status"];
const fieldGuards = {};
for (const f of sensitive) fieldGuards[f] = new RegExp("\\b" + f + "\\b").test(clean);

const rulesVersion = (raw.match(/rules_version\s*=\s*['"](\d+)['"]/) || [])[1] || "unknown";
const hasFirestoreService = /service\s+cloud\.firestore/.test(clean);
const usesRequestAuth = /request\.auth/.test(clean);
const usesRequestAuthUid = /request\.auth\.uid/.test(clean);
const hasCatchAll = matches.some((mt) => collOf(mt.path) === "catchAll");
const usersMatches = matches.filter((mt) => collOf(mt.path) === "users");
const notifMatches = matches.filter((mt) => collOf(mt.path) === "notifPrefs");

const counts = findings.reduce((acc, f) => { acc[f.severity] = (acc[f.severity] || 0) + 1; return acc; }, {});
const anyCritical = (counts.CRITICAL || 0) > 0;
const anyHigh = (counts.HIGH || 0) > 0;
const verdict = anyCritical || anyHigh ? "NO-GO" : "GO";

const report = {
  phase: "F3.3.20-B1.7-E-RULES-LIVE-AUDIT",
  input: inPath,
  rules_sha256: sha256,
  rules_bytes: Buffer.byteLength(raw, "utf8"),
  rules_version: rulesVersion,
  service_cloud_firestore: hasFirestoreService,
  uses_request_auth: usesRequestAuth,
  uses_request_auth_uid: usesRequestAuthUid,
  has_catch_all: hasCatchAll,
  match_count: matches.length,
  users_match_count: usersMatches.length,
  notifprefs_match_count: notifMatches.length,
  hmac_model_note:
    "App NAO usa Firebase Auth; token HMAC nao aparece em request.auth. Rules nao validam HMAC. " +
    "notifPrefs por-usuario deve ser protegido por Functions; acesso direto a notifPrefs deveria ser deny.",
  sensitive_field_mentions: fieldGuards,
  matches: matches.map((m) => ({ path: m.path, allows: m.allows })),
  findings,
  counts,
  verdict,
};
fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));

// --- summary.md ---
const sevOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
let md = "";
md += "# Firestore Rules — Auditoria estatica (read-only)\n\n";
md += "- Veredito: **" + verdict + "**\n";
md += "- rules_version: `" + rulesVersion + "` · service cloud.firestore: " + hasFirestoreService + "\n";
md += "- SHA-256: `" + sha256 + "` (" + report.rules_bytes + " bytes)\n";
md += "- matches: " + matches.length + " (users: " + usersMatches.length + ", notifPrefs: " + notifMatches.length + ") · catch-all: " + hasCatchAll + "\n";
md += "- request.auth usado: " + usesRequestAuth + " · request.auth.uid: " + usesRequestAuthUid + "\n";
md += "- Contagem por severidade: " + JSON.stringify(counts) + "\n\n";
md += "## Nota HMAC/custom auth\n" + report.hmac_model_note + "\n\n";
md += "## Mencao a campos sensiveis nas Rules\n";
for (const f of sensitive) md += "- " + f + ": " + (fieldGuards[f] ? "mencionado" : "ausente") + "\n";
md += "\n## Achados\n";
for (const sev of sevOrder) {
  const fs2 = findings.filter((f) => f.severity === sev);
  if (!fs2.length) continue;
  md += "\n### " + sev + " (" + fs2.length + ")\n";
  for (const f of fs2) md += "- [" + f.area + "] " + f.detail + "\n  - path: `" + f.path + "` · allow `" + f.ops + ": if " + f.cond + "`\n";
}
md += "\n## Coleções users / notifPrefs (matches detectados)\n";
for (const mt of [...usersMatches, ...notifMatches]) {
  md += "- `" + mt.path + "`\n";
  for (const al of mt.allows) md += "    - allow `" + al.ops + ": if " + al.cond + "`\n";
}
fs.writeFileSync(OUT_MD, md);

console.log("[rules-audit] verdict=" + verdict + " counts=" + JSON.stringify(counts) + " sha256=" + sha256.slice(0, 16) + "…");
console.log("[rules-audit] matches=" + matches.length + " users=" + usersMatches.length + " notifPrefs=" + notifMatches.length + " catchAll=" + hasCatchAll);
// Saida 0 SEMPRE: a auditoria roda com sucesso; o veredito GO/NO-GO esta no relatorio (nao falha o job).
process.exit(0);
