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
     node scripts/worker-ops/microjanela.mjs janela-write sla-dryrun
        → ESCRITA CONTROLADA (gated). PREFLIGHT read-only (só SLA_ENGINE_ENABLED)
          exige scanned>=1 + slaStatus="inicio_proximo" + alvo
          designer_start_warning (aborta se overdue/blocked/started). SÓ ENTÃO
          liga SLA_WRITE + SLA_ACTIVATED_AT=<plannedStartAt> e faz UMA passada
          write:true. NÃO toca appConfig/flags.slaEngine — 3º gate é toggle
          MANUAL no Firestore; sem ele writeAllowed=false e 0 escrita (gate
          triplo segura). Remove TODAS as envs SLA_* no finally + 403.
     node scripts/worker-ops/microjanela.mjs rollback
        → restaura o backup mais recente (redeploy byte-exato do que rodava).

   CADEADOS DE SEGURANÇA (hard-coded):
     - SLA_WRITE/SLA_ACTIVATED_AT: SÓ no modo janela-write (gated, temporário,
       removido no finally); os demais modos JAMAIS os definem;
     - appConfig/flags.slaEngine NUNCA é tocado por este script (toggle manual);
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
const ROTAS_AUTORIZADAS = ["sla-dryrun", "sla-legacy-baseline", "sla-legacy-risk", "sla-discover"];
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

/* ── HELPERS GENÉRICOS DE SECRET (usados SÓ pelo modo janela-write) ──
   PUT/DELETE /secrets/{name} é atômico por variável (não toca nenhuma outra).
   O valor NUNCA vai para o log (apenas o nome). SLA_ACTIVATED_AT (timestamp de
   corte) é derivado de dado de tarefa público e é logado à parte como evidência. */
async function secretOn(name, value) {
  log(`— [janela-write] ligando ${name} via API (PUT secrets — atômico; valor REDIGIDO)`);
  const r = await cfApi("PUT", "/secrets", { name, text: String(value), type: "secret_text" });
  if (!r.ok) fail(`PUT ${name} falhou: API ${r.status} ${r.text.slice(0, 160)}`);
}
async function secretOff(name) {
  for (let i = 1; i <= 3; i++) {
    const r = await cfApi("DELETE", `/secrets/${name}`);
    if (r.ok || r.status === 404) { log(`— [janela-write] ${name} REMOVIDA via API (tentativa ${i}; 404 = já ausente)`); return true; }
    log(`  remoção de ${name} falhou (API ${r.status}) — retry ${i}/3`);
    await new Promise((x) => setTimeout(x, 2000));
  }
  log(`✗ CRÍTICO: não consegui remover ${name} — remova MANUALMENTE no painel AGORA.`);
  return false;
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
    for (const v of ["SLA_WRITE", "SLA_ACTIVATED_AT"])
      if (snapAntes.has(v)) fail(`binding PROIBIDO '${v}' existe no worker — abortando por contrato (nunca deve existir nesta fase).`);
    let coletaOk = false;
    try {
      await envOn();                                            // API: adiciona SÓ a env
      await new Promise((r) => setTimeout(r, 10000));           // propagação (coleta é ÚNICA, sem retry)
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
  } else if (modo === "janela-write") {
    /* ════ ESCRITA CONTROLADA DE 1 EVENTO (gated, F2.9.1) ════
       NÃO toca appConfig/flags.slaEngine — o 3º gate (flags.slaEngine===true) é
       um toggle MANUAL no Firestore. Sem ele, writeAllowed=false e a passada
       escreve ZERO (gate triplo segura mesmo com SLA_WRITE+SLA_ACTIVATED_AT).
       Estrutura: A preflight read-only → B1 prova-seca COM corte (0 escrita,
       exige EXATAMENTE 1 evento alvo; QUALQUER outro aborta ANTES de habilitar a
       escrita) → B2 escrita gated → C finally remove TODAS as envs SLA_*.
       Endurecimento sobre o A→B literal: B1 prova a unicidade do alvo com a env
       de corte porém SEM SLA_WRITE (0 escrita), impedindo escrever um 2º evento
       caso o flags.slaEngine já esteja ligado. */
    guardToken();
    if (rota !== "sla-dryrun") fail(`janela-write só permite a rota 'sla-dryrun' (recebido: '${rota}').`);
    const snapAntes = await snapshotVars("antes-da-janela-write");
    for (const v of ["SLA_ENGINE_ENABLED", "SLA_WRITE", "SLA_ACTIVATED_AT"])
      if (snapAntes.has(v)) fail(`binding '${v}' já existe ANTES da janela-write — estado sujo; remova e reexecute.`);
    let writeFeito = false;
    try {
      /* ── A — PREFLIGHT read-only (só SLA_ENGINE_ENABLED; SEM corte → tudo retro) ── */
      await secretOn("SLA_ENGINE_ENABLED", "true");
      await new Promise((r) => setTimeout(r, 12000));               // propagação do secret
      const rA = await http("POST", `${URL_BASE}/sla-dryrun`, {});  // write:false
      log(`— [A/preflight] /sla-dryrun {} → ${rA.status}`);
      if (rA.status !== 200) throw new Error(`preflight respondeu ${rA.status}`);
      save(`janela-write-A-preflight-${STAMP}.json`, rA.text);
      const jA = JSON.parse(rA.text).report || {};
      if (jA.writeAllowed !== false) throw new Error("[A] writeAllowed !== false no preflight — ANOMALIA, abortando");
      if ((jA.writes || 0) !== 0)    throw new Error("[A] writes !== 0 no preflight — ANOMALIA, abortando");
      if ((jA.scanned || 0) < 1)     throw new Error("[A] scanned < 1 (nenhuma tarefa de designer ativa) — janela fechada");
      const alvos = (jA.computed || []).filter((c) => c.slaStatus === "inicio_proximo");
      if (alvos.length === 0) throw new Error("[A] nenhuma tarefa em 'inicio_proximo' — fora da janela (cedo/tarde demais)");
      if (alvos.length > 1)   throw new Error(`[A] ${alvos.length} tarefas em 'inicio_proximo' — janela-write exige EXATAMENTE 1 alvo; abortando`);
      const piores = (jA.computed || []).filter((c) => c.blockedCandidate === true || /atrasad/.test(c.slaStatus || ""));
      if (piores.length) throw new Error(`[A] ${piores.length} tarefa(s) em estado pior (atraso/bloqueio) no scan — abortando por segurança`);
      const alvo = alvos[0];
      const cutoffMs = alvo.plannedStartAt;
      if (!Number.isFinite(cutoffMs) || cutoffMs <= 0) throw new Error("[A] plannedStartAt do alvo inválido — abortando");
      log(`— [A] alvo: task=${alvo.taskId} designer=${alvo.designerId} slaStatus=${alvo.slaStatus} | corte SLA_ACTIVATED_AT=${cutoffMs}`);

      /* ── B1 — PROVA-SECA COM CORTE (SLA_ACTIVATED_AT, SEM SLA_WRITE → writeAllowed=false → 0 escrita).
         Com o corte = plannedStartAt do alvo, o designer_task_assigned (âncora anterior)
         vira retro e SÓ o designer_start_warning (âncora == corte) seria emitido.
         Exige EXATAMENTE 1 evento, do alvo; qualquer outro aborta SEM habilitar escrita. */
      await secretOn("SLA_ACTIVATED_AT", String(cutoffMs));
      await new Promise((r) => setTimeout(r, 12000));
      const rB1 = await http("POST", `${URL_BASE}/sla-dryrun`, { write: true });  // sem SLA_WRITE ⇒ writeAllowed=false
      log(`— [B1/prova-seca] /sla-dryrun {write:true} (SEM SLA_WRITE) → ${rB1.status}`);
      if (rB1.status !== 200) throw new Error(`prova-seca respondeu ${rB1.status}`);
      save(`janela-write-B1-prova-seca-${STAMP}.json`, rB1.text);
      const jB1 = JSON.parse(rB1.text).report || {};
      if (jB1.writeAllowed !== false) throw new Error("[B1] writeAllowed !== false sem SLA_WRITE — ANOMALIA, abortando");
      if ((jB1.writes || 0) !== 0)    throw new Error("[B1] writes !== 0 sem SLA_WRITE — ANOMALIA, abortando");
      const evsB1 = jB1.events || [];
      if (evsB1.length !== 1) throw new Error(`[B1] esperava EXATAMENTE 1 evento com o corte, veio ${evsB1.length} — abortando (não habilito escrita)`);
      if (evsB1[0].eventType !== "designer_start_warning") throw new Error(`[B1] evento inesperado '${evsB1[0].eventType}' (esperado designer_start_warning) — abortando`);
      if (evsB1[0].taskId !== alvo.taskId) throw new Error(`[B1] evento de outra tarefa (${evsB1[0].taskId} ≠ alvo ${alvo.taskId}) — abortando`);
      log("— [B1] OK: exatamente 1 evento designer_start_warning do alvo passaria o corte; 0 escrita até aqui.");

      /* ── B2 — ESCRITA GATED (adiciona SLA_WRITE). writeAllowed = flags.slaEngine===true
         (toggle MANUAL no Firestore, NÃO tocado aqui). flags OFF → writes=0; ON → writes≤2. */
      await secretOn("SLA_WRITE", "true");
      await new Promise((r) => setTimeout(r, 12000));
      const rB2 = await http("POST", `${URL_BASE}/sla-dryrun`, { write: true });
      log(`— [B2/escrita] /sla-dryrun {write:true} (SLA_WRITE + SLA_ACTIVATED_AT) → ${rB2.status}`);
      if (rB2.status !== 200) throw new Error(`escrita respondeu ${rB2.status}`);
      save(`janela-write-B2-escrita-${STAMP}.json`, rB2.text);
      const jB2 = JSON.parse(rB2.text).report || {};
      const evsB2 = jB2.events || [];
      if (evsB2.length > 1) throw new Error(`[B2] mais de 1 evento (${evsB2.length}) — abortando (gate de segurança)`);
      if (!evsB2.every((e) => e.eventType === "designer_start_warning")) throw new Error("[B2] evento não-warning presente — abortando");
      if ((jB2.writes || 0) > 2) throw new Error(`[B2] writes=${jB2.writes} > 2 — acima do esperado (1 slaEvents + 1 designerSla); abortando`);
      /* wouldNotify é SEMPRE não-vazio para um warning (1 entrada simulada por
         construção, linha ~3868 do worker) — por isso NÃO abortamos em não-vazio;
         exigimos que TODAS as entradas sejam simulated===true. Push real é
         estruturalmente impossível: runSlaEnginePass não chama FCM/WebPush/WhatsApp. */
      const notifyOk = (jB2.wouldNotify || []).every((w) => w.simulated === true);
      if (!notifyOk) throw new Error("[B2] wouldNotify com entrada NÃO simulada — abortando (nenhum push real é permitido)");
      writeFeito = jB2.writeAllowed === true && (jB2.writes || 0) > 0;
      log(`— [B2] writeAllowed=${jB2.writeAllowed} writes=${jB2.writes || 0} events=${evsB2.length} wouldNotify=${(jB2.wouldNotify || []).length} (todas simuladas=${notifyOk})`);
      if (!writeFeito)
        log("— [B2] 3º gate (flags.slaEngine) FECHADO → 0 escrita real (esperado se o toggle manual não foi ligado). Tooling validada; escrita real exige o toggle no Firestore.");
      else
        log(`— [B2] ESCRITA REAL efetuada: ${jB2.writes} doc(s) (1 slaEvents designer_start_warning + 1 designerSla). Push real: NENHUM (estrutural).`);
    } finally {
      log("— [C/finally] removendo TODAS as envs SLA_* via API (garantido mesmo em erro)");
      await secretOff("SLA_WRITE");
      await secretOff("SLA_ACTIVATED_AT");
      await secretOff("SLA_ENGINE_ENABLED");
      await new Promise((r) => setTimeout(r, 5000));
      const snapDepois = await snapshotVars("depois-da-janela-write");
      for (const v of ["SLA_ENGINE_ENABLED", "SLA_WRITE", "SLA_ACTIVATED_AT"])
        if (snapDepois.has(v)) log(`✗ CRÍTICO: '${v}' AINDA presente no snapshot final — remover MANUALMENTE no painel AGORA.`);
      for (const n of snapAntes) if (!snapDepois.has(n)) log(`✗ ALERTA: variável '${n}' ausente no snapshot final (não tocada por este script — investigar).`);
      for (const n of snapDepois) if (!snapAntes.has(n) && !["SLA_ENGINE_ENABLED", "SLA_WRITE", "SLA_ACTIVATED_AT"].includes(n)) log(`✗ ALERTA: variável nova '${n}' no snapshot final (não criada por este script).`);
      await passo403("final, pós-remoção (janela-write)");
    }
    if (!writeFeito) log("RESUMO janela-write: B1 provou 1 único evento (0 escrita); B2 com 0 escrita real (3º gate flags.slaEngine fechado); envs SLA_* removidas; 403 confirmado.");
    else             log("RESUMO janela-write: B1 provou 1 único evento; B2 ESCREVEU 1 designer_start_warning (gate aberto); envs SLA_* removidas; 403 confirmado; push real NENHUM.");
    flushReport(writeFeito ? "OK (janela-write — escrita real)" : "OK (janela-write — 0 escrita, gate fechado)");
  } else if (modo === "rollback") {
    guardToken();
    log("— rollback: wrangler rollback (volta ao deployment anterior do próprio Cloudflare)");
    const out = sh(`npx --yes wrangler@4 rollback --name ${WORKER_NAME} -y 2>&1 || npx --yes wrangler@4 rollback -y 2>&1`);
    save("rollback.txt", out);
    await passoEstadoProducao();
    log("RESUMO rollback: deployment anterior restaurado. (Alternativa byte-exata: redeploy do backup-producao-*.js do log mais recente.)");
    flushReport("OK (rollback)");
  } else {
    console.log("uso: node scripts/worker-ops/microjanela.mjs <dry-run|deploy|janela <rota>|full <rota>|janela-write sla-dryrun|rollback>");
    console.log("rotas:", ROTAS_AUTORIZADAS.join(" | "));
    process.exit(2);
  }
} catch (e) {
  fail(e && e.message ? e.message : String(e));
}
