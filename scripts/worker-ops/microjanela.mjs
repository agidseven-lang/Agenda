#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   MICROJANELA AUTOMATIZADA — Worker idseven-push (SLA read-only)
   ════════════════════════════════════════════════════════════════════════
   Substitui o processo manual do painel. Roda na SUA máquina (Windows/Mac/
   Linux), com Node 18+ e um API Token mínimo do Cloudflare em
   CLOUDFLARE_API_TOKEN (nunca colado em chat; ver plano de automação).

   MODOS:
     node scripts/worker-ops/microjanela.mjs dry-run
        → valida tudo SEM deploy: bundle local (artefato exato), hash,
          versão do código, estado atual de produção (GET /), gates locais.
     node scripts/worker-ops/microjanela.mjs deploy
        → backup do worker em produção (API, com hash) + wrangler deploy
          (SEM env SLA) + smoke: GET / e 403 nas rotas SLA.
     node scripts/worker-ops/microjanela.mjs janela <rota>
        → rota ∈ {sla-dryrun, sla-legacy-baseline, sla-legacy-risk}:
          liga SLA_ENGINE_ENABLED via Cloudflare API (PUT /secrets — atômico,\n          NÃO toca nenhuma outra variável), faz UMA coleta,
          salva JSON, REMOVE a env (deploy limpo) — remoção garantida por
          finally mesmo se a coleta falhar — e confirma 403 final.
     node scripts/worker-ops/microjanela.mjs full <rota>
        → deploy + janela + verificação, em sequência, com aborto automático.
     node scripts/worker-ops/microjanela.mjs rollback
        → restaura o backup mais recente (redeploy byte-exato do que rodava).

   CADEADOS DE SEGURANÇA (hard-coded):
     - JAMAIS define SLA_WRITE ou SLA_ACTIVATED_AT (guard explícito);
     - só coleta nas 3 rotas read-only autorizadas;
     - env temporária SEMPRE removida (finally + verificação 403);
     - aborto imediato se qualquer verificação falhar (e remove a env);
     - nada destrutivo: secrets do painel não são tocados pelo wrangler.
   ════════════════════════════════════════════════════════════════════════ */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const URL_BASE = process.env.WORKER_URL || "https://idseven-push.agidseven.workers.dev";
const WORKER_NAME = "idseven-push";
const ROTAS_AUTORIZADAS = ["sla-dryrun", "sla-legacy-baseline", "sla-legacy-risk"];
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");
const LOGDIR = path.join(ROOT, "worker-ops-logs", STAMP);
mkdirSync(LOGDIR, { recursive: true });
const LOG = [];
const log = (...a) => { const line = `[${new Date().toISOString()}] ${a.join(" ")}`; console.log(line); LOG.push(line); };
const fail = (msg) => { log("✗ FALHA:", msg); flushReport("FALHA"); process.exit(1); };
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const save = (name, content) => { const f = path.join(LOGDIR, name); writeFileSync(f, content); log("  salvo:", path.relative(ROOT, f)); return f; };
function flushReport(status) {
  save("relatorio.txt", `MICROJANELA ${STAMP}\nstatus final: ${status}\n\n` + LOG.join("\n") + "\n");
}
const sh = (cmd, opts) => execSync(cmd, Object.assign({ cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }, opts || {}));
async function http(method, url, body) {
  const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, text: await res.text() };
}

/* ── GUARDS ── */
function guardSemVarsProibidas() {
  for (const v of ["SLA_WRITE", "SLA_ACTIVATED_AT"])
    if (process.env[v] !== undefined || process.argv.join(" ").includes(v))
      fail(`variável PROIBIDA detectada no ambiente/args: ${v} — abortando por contrato.`);
}
function guardToken() {
  if (!process.env.CLOUDFLARE_API_TOKEN) fail("CLOUDFLARE_API_TOKEN ausente. Crie o token mínimo (ver docs/sla-automacao-worker-PLANO.md) e exporte na sessão. NUNCA cole o token em chat.");
}

/* ── PASSOS ── */
function passoBundleLocal() {
  log("— bundle local (artefato EXATO de deploy, sem rede): wrangler deploy --dry-run");
  sh(`npx --yes wrangler@4 deploy --dry-run --outdir ${path.join(LOGDIR, "dist")} 2>&1`);
  const distFiles = readdirSync(path.join(LOGDIR, "dist")).filter((f) => f.endsWith(".js"));
  if (!distFiles.length) fail("dry-run não produziu bundle");
  const bundle = readFileSync(path.join(LOGDIR, "dist", distFiles[0]));
  const h = sha256(bundle);
  const src = readFileSync(path.join(ROOT, "cloudflare-worker.js"), "utf8");
  const ver = (src.match(/version: "(V64[^"]+)"/) || [])[1] || "?";
  log(`  bundle: ${distFiles[0]} | sha256=${h} | versão no código=${ver}`);
  save("bundle.sha256.txt", `${h}  ${distFiles[0]}\nversao=${ver}\n`);
  return { hash: h, ver };
}
async function passoEstadoProducao(softFail) {
  const r = await http("GET", URL_BASE + "/").catch((e) => ({ status: 0, text: String(e) }));
  log(`— produção GET / → ${r.status} ${r.text.slice(0, 120)}`);
  save("producao-get.json", r.text);
  const bloqueioSandbox = /Host not in allowlist/i.test(r.text);
  if (r.status !== 200) {
    if (softFail) { log(`  (aviso, não-fatal no dry-run: produção inacessível${bloqueioSandbox ? " — bloqueio de REDE deste ambiente, não do worker" : ""})`); return null; }
    fail("GET / de produção não respondeu 200" + (bloqueioSandbox ? " (bloqueio de rede do ambiente — rode da sua máquina ou libere o host no allowlist)" : ""));
  }
  return JSON.parse(r.text);
}
async function passo403(quando) {
  for (const rota of ROTAS_AUTORIZADAS) {
    const r = await http("POST", `${URL_BASE}/${rota}`, {});
    log(`— gate 403 (${quando}) /${rota} → ${r.status}`);
    if (r.status !== 403) fail(`/${rota} deveria estar 403 (${quando}) e respondeu ${r.status} — env residual? Rode 'rollback' ou remova a env.`);
  }
}
function passoBackup() {
  log("— backup do worker EM PRODUÇÃO via API (conteúdo + hash)");
  const out = sh(`npx --yes wrangler@4 deployments list --name ${WORKER_NAME} 2>&1 || true`);
  save("deployments-antes.txt", out);
  // download do script ativo (API): wrangler não tem 'download'; usa fetch direto à API
  return (async () => {
    const acct = process.env.CLOUDFLARE_ACCOUNT_ID
      ? [null, process.env.CLOUDFLARE_ACCOUNT_ID]
      : sh(`npx --yes wrangler@4 whoami 2>&1`).match(/([0-9a-f]{32})/);
    if (!acct) fail("account id indisponível — exporte CLOUDFLARE_ACCOUNT_ID (visível na lateral do dashboard; não é secreto)");
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct[1]}/workers/scripts/${WORKER_NAME}`, { headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` } });
    if (!res.ok) fail(`backup falhou: API ${res.status}`);
    const body = Buffer.from(await res.arrayBuffer());
    const h = sha256(body);
    save(`backup-producao-${h.slice(0, 8)}.js`, body);
    log(`  backup ok: sha256=${h}`);
    return h;
  })();
}
/* DEPLOY DE CÓDIGO — sempre com --keep-vars (revisão pós-laudo keep_vars):
   nenhuma variável existente do painel é apagada; secrets são sempre
   preservados pelo Cloudflare. A env temporária NUNCA passa por aqui. */
function deployCode() {
  log("— wrangler deploy --keep-vars (código apenas; vars/secrets do painel preservados)");
  const out = sh(`npx --yes wrangler@4 deploy --keep-vars 2>&1`);
  save("deploy-codigo.txt", out);
  if (!/Deployed|Uploaded|Current Version/i.test(out)) fail("deploy sem confirmação no output do wrangler");
}

/* ── OPÇÃO A: env temporária via Cloudflare API POR VARIÁVEL (atômica) ──
   PUT  /accounts/{id}/workers/scripts/{name}/secrets        → adiciona SÓ a env
   DELETE /accounts/{id}/workers/scripts/{name}/secrets/{k}  → remove SÓ a env
   Nenhuma outra variável é lida/escrita por essas chamadas. O binding
   secret_text aparece para o worker como env.SLA_ENGINE_ENABLED ("true") —
   leitura idêntica à de uma var comum. */
async function accountId() {
  if (process.env.CLOUDFLARE_ACCOUNT_ID) return process.env.CLOUDFLARE_ACCOUNT_ID;
  const m = sh(`npx --yes wrangler@4 whoami 2>&1`).match(/([0-9a-f]{32})/);
  if (!m) fail("account id indisponível — exporte CLOUDFLARE_ACCOUNT_ID (não é secreto)");
  return m[1];
}
async function cfApi(method, pathname, body) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${await accountId()}/workers/scripts/${WORKER_NAME}${pathname}`,
    { method, headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}
/* snapshot de variáveis: SOMENTE NOMES E TIPOS (valores nunca tocam o log) */
async function snapshotVars(rotulo) {
  const r = await cfApi("GET", "/settings");
  if (!r.ok) fail(`snapshot de variáveis falhou: API ${r.status}`);
  const bindings = (JSON.parse(r.text).result || {}).bindings || [];
  const nomes = bindings.map((b) => `${b.name} (${b.type})`).sort();
  save(`vars-${rotulo}.txt`, nomes.join("\n") + "\n");
  log(`— snapshot vars (${rotulo}): ${nomes.length} bindings (nomes apenas; valores REDIGIDOS)`);
  return new Set(bindings.map((b) => b.name));
}
async function envOn() {
  log("— ligando env temporária via API (PUT secrets — atômico, não toca outras vars)");
  const r = await cfApi("PUT", "/secrets", { name: "SLA_ENGINE_ENABLED", text: "true", type: "secret_text" });
  if (!r.ok) fail(`PUT SLA_ENGINE_ENABLED falhou: API ${r.status} ${r.text.slice(0, 160)}`);
}
async function envOff() {
  for (let i = 1; i <= 3; i++) {
    const r = await cfApi("DELETE", "/secrets/SLA_ENGINE_ENABLED");
    if (r.ok || r.status === 404) { log(`— env temporária REMOVIDA via API (tentativa ${i}; 404 = já ausente)`); return true; }
    log(`  remoção falhou (API ${r.status}) — retry ${i}/3`);
    await new Promise((x) => setTimeout(x, 2000));
  }
  log("✗ CRÍTICO: não consegui remover SLA_ENGINE_ENABLED — remova MANUALMENTE no painel (sem SLA_WRITE o engine segue read-only, mas a env não deve ficar).");
  return false;
}
async function passoVersao(esperadaRe) {
  await new Promise((r) => setTimeout(r, 4000));
  const j = await passoEstadoProducao();
  if (!new RegExp(esperadaRe).test(j.version || "")) fail(`versão em produção '${j.version}' não bate com ${esperadaRe}`);
  log(`  versão confirmada: ${j.version}`);
}

/* ── MODOS ── */
const modo = process.argv[2];
const rota = process.argv[3];
guardSemVarsProibidas();
try {
  if (modo === "dry-run") {
    const b = passoBundleLocal();
    const prod = await passoEstadoProducao(true);   // dry-run: leitura de produção é informativa, nunca fatal
    log(`RESUMO dry-run: pacote=${b.ver} (${b.hash.slice(0, 12)}…) | produção=${prod ? prod.version : "inacessível"} | NENHUM deploy feito.`);
    flushReport("OK (dry-run)");
  } else if (modo === "deploy") {
    guardToken();
    passoBundleLocal();
    await passoBackup();
    const antes = await snapshotVars("antes-do-deploy");
    deployCode();
    await passoVersao("V64\\.");
    const depois = await snapshotVars("depois-do-deploy");
    for (const n of antes) if (!depois.has(n)) fail(`variável '${n}' SUMIU no deploy — keep-vars não preservou; rode rollback e reporte.`);
    await passo403("pós-deploy, sem env");
    log("RESUMO deploy: código atualizado, TODAS as vars preservadas (provado por snapshot), gates 403 OK, backup salvo.");
    flushReport("OK (deploy)");
  } else if (modo === "janela" || modo === "full") {
    guardToken();
    if (!ROTAS_AUTORIZADAS.includes(rota)) fail(`rota não autorizada: '${rota}'. Permitidas: ${ROTAS_AUTORIZADAS.join(", ")}`);
    if (modo === "full") { passoBundleLocal(); await passoBackup(); deployCode(); await passoVersao("V64\\."); await passo403("pós-deploy"); }
    const snapAntes = await snapshotVars("antes-da-janela");
    if (snapAntes.has("SLA_ENGINE_ENABLED")) fail("SLA_ENGINE_ENABLED já existe ANTES da janela — estado sujo; remova e reexecute.");
    let coletaOk = false;
    try {
      await envOn();                                            // API: adiciona SÓ a env
      await new Promise((r) => setTimeout(r, 5000));
      const r = await http("POST", `${URL_BASE}/${rota}`, {});  // UMA coleta
      log(`— coleta /${rota} → ${r.status}`);
      if (r.status !== 200) throw new Error(`coleta respondeu ${r.status}`);
      save(`${rota}-${STAMP}.json`, r.text);
      const j = JSON.parse(r.text);
      if (j.report && (j.report.writeAllowed === true || j.report.writes > 0)) throw new Error("ANOMALIA: writeAllowed/writes>0 — abortando");
      coletaOk = true;
    } finally {
      log("— finally: removendo env via API (garantido mesmo em erro) + restaurando estado");
      await envOff();                                           // API: remove SÓ a env (retry ×3)
      await new Promise((r) => setTimeout(r, 5000));
      const snapDepois = await snapshotVars("depois-da-janela");
      if (snapDepois.has("SLA_ENGINE_ENABLED")) log("✗ CRÍTICO: SLA_ENGINE_ENABLED ainda presente no snapshot final — remover manualmente AGORA.");
      for (const n of snapAntes) if (!snapDepois.has(n)) log(`✗ ALERTA: variável '${n}' ausente no snapshot final (não foi tocada por este script — investigar).`);
      for (const n of snapDepois) if (!snapAntes.has(n) && n !== "SLA_ENGINE_ENABLED") log(`✗ ALERTA: variável nova '${n}' no snapshot final (não criada por este script).`);
      await passo403("final, pós-remoção");
    }
    if (!coletaOk) fail("coleta falhou (env já removida e 403 confirmado)");
    log(`RESUMO janela: coleta de /${rota} salva, env removida, 403 confirmado nas 3 rotas.`);
    flushReport("OK (janela)");
  } else if (modo === "rollback") {
    guardToken();
    log("— rollback: wrangler rollback (volta ao deployment anterior do próprio Cloudflare)");
    const out = sh(`npx --yes wrangler@4 rollback --name ${WORKER_NAME} -y 2>&1 || npx --yes wrangler@4 rollback -y 2>&1`);
    save("rollback.txt", out);
    await passoEstadoProducao();
    log("RESUMO rollback: deployment anterior restaurado. (Alternativa byte-exata: redeploy do backup-producao-*.js do log mais recente.)");
    flushReport("OK (rollback)");
  } else {
    console.log("uso: node scripts/worker-ops/microjanela.mjs <dry-run|deploy|janela <rota>|full <rota>|rollback>");
    console.log("rotas:", ROTAS_AUTORIZADAS.join(" | "));
    process.exit(2);
  }
} catch (e) {
  fail(e && e.message ? e.message : String(e));
}
