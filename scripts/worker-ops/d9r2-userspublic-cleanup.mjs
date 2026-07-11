#!/usr/bin/env node
/* =====================================================================
   F3.3.70D9R2 — Limpeza PINADA do usersPublic (Admin SDK; 3 docs exatos).
   Marca status:"removido" SOMENTE nos 3 documentos de teste/canario/
   duplicado identificados e provados no gate read-only da fase:
     - canary-pwa-staging-notifprefs  (Canary PWA Staging NotifPrefs, tester)
     - SDQzpOTP2aQ4vhEKZtAX           (Teste WebPush, TESTE)
     - pursmoRfjL05WNx3QHw3           (duplicado pendente do owner; admin=false)
   SOFT-DELETE reversivel: renderEquipe/renderChat/stat ocultam 'removido';
   o doc permanece integro para auditoria/rollback (basta restaurar o status
   anterior registrado no BACKUP LOGICO impresso e salvo como artifact).
   GUARDS (qualquer falha => aborta TUDO, zero escrita):
     G1: TARGETS x PROTECTED sem intersecao (estatico).
     G2: cada TARGET existe E name/role/status/admin batem EXATAMENTE com o
         snapshot auditado (o duplicado exige status=pendente e admin=false).
     G3: os 5 PROTECTED existem com status "ativo" ANTES de qualquer escrita
         (em especial o doc REAL do owner dGI6vJ6edf7O3dvXV0lG).
     G4: escreve SOMENTE {status,removedAt,removedReason} via update() pinado.
     G5: read-back: targets=removido; protected byte-identicos (deep compare);
         roster visivel final = exatamente os 5 PROTECTED.
   DRY_RUN=true (default): faz TODAS as leituras/guards/backup e NAO escreve.
   NUNCA imprime segredo. Credencial via GOOGLE_APPLICATION_CREDENTIALS (ADC).
   ===================================================================== */
import { writeFileSync, mkdirSync } from "node:fs";
import admin from "firebase-admin";

const DRY_RUN = (process.env.DRY_RUN ?? "true") !== "false";
const CONFIRM = process.env.CONFIRM_CLEANUP || "";
const REQUIRED = "LIMPAR-USERSPUBLIC-D9R2";
const ARTIFACT_DIR = process.env.ARTIFACT_DIR || "./d9r2-cleanup-artifacts";

const TARGETS = [
  { id: "canary-pwa-staging-notifprefs", expect: { name: "Canary PWA Staging NotifPrefs", role: "tester", status: "ativo", admin: false } },
  { id: "SDQzpOTP2aQ4vhEKZtAX", expect: { name: "Teste WebPush", role: "TESTE", status: "ativo", admin: false } },
  { id: "pursmoRfjL05WNx3QHw3", expect: { name: "Miercohévisk Niheb Ferreira Nascimento Carlôto", role: "ceo", status: "pendente", admin: false } },
];
const PROTECTED = [
  "KwFUNcQE5jjNFsbMUPX8", // Felipe Teodozio
  "dGI6vJ6edf7O3dvXV0lG", // Miercohévisk (owner REAL)
  "fkRsLaYg4c692MmUgdJl", // Arydyjany Carlôto
  "tN8ZDZrXSc1Ef4GYnJQ5", // Tatiana Gomes
  "u5Odknlf5Qil58lCj0j7", // Boaz Macêdo
];
const OWNER_REAL = "dGI6vJ6edf7O3dvXV0lG";

function saveArtifact(name, obj) {
  try { mkdirSync(ARTIFACT_DIR, { recursive: true }); writeFileSync(ARTIFACT_DIR + "/" + name, JSON.stringify(obj, null, 2)); } catch (_) { }
}
function die(msg, extra) {
  console.error("NO-GO: " + msg);
  if (extra) console.error(JSON.stringify(extra, null, 2));
  process.exit(1);
}

async function main() {
  // G1 — estatico
  for (const t of TARGETS) if (PROTECTED.includes(t.id)) die("TARGET na lista PROTECTED: " + t.id);

  admin.initializeApp(); // ADC via GOOGLE_APPLICATION_CREDENTIALS
  const db = admin.firestore();
  const col = db.collection("usersPublic");

  // G3 — protected primeiro (owner real incluido) — tudo ANTES de qualquer escrita
  const protectedBefore = {};
  for (const id of PROTECTED) {
    const s = await col.doc(id).get();
    if (!s.exists) die("PROTECTED inexistente (abortando tudo): " + id);
    const d = s.data() || {};
    if (d.status !== "ativo") die("PROTECTED nao esta ativo (abortando tudo): " + id + " status=" + d.status);
    protectedBefore[id] = d;
  }
  if (!protectedBefore[OWNER_REAL]) die("doc REAL do owner ausente — jamais tocar o duplicado sem o real presente");
  console.log("G3 OK: 5 PROTECTED existem e estao ativos (owner real confirmado).");

  // G2 — targets com snapshot EXATO
  const backup = [];
  for (const t of TARGETS) {
    const s = await col.doc(t.id).get();
    if (!s.exists) die("TARGET inexistente: " + t.id);
    const d = s.data() || {};
    const got = { name: d.name, role: d.role, status: d.status, admin: d.admin === true };
    const exp = { ...t.expect };
    if (got.name !== exp.name || got.role !== exp.role || got.status !== exp.status || got.admin !== exp.admin)
      die("TARGET diverge do snapshot auditado — NADA sera escrito", { id: t.id, esperado: exp, encontrado: got });
    backup.push({ id: t.id, createTime: s.createTime?.toDate?.()?.toISOString?.(), updateTime: s.updateTime?.toDate?.()?.toISOString?.(), data: d });
  }
  console.log("G2 OK: 3 TARGETS batem exatamente com o snapshot auditado.");

  // BACKUP LOGICO (log + artifact) — base do rollback (status anterior preservado aqui)
  console.log("BACKUP-LOGICO-USERSPUBLIC-D9R2 = " + JSON.stringify(backup));
  saveArtifact("backup-userspublic-d9r2.json", backup);

  const plan = TARGETS.map(t => ({ id: t.id, de: t.expect.status, para: "removido", campos: ["status", "removedAt", "removedReason"] }));
  if (DRY_RUN) {
    console.log("DRY-RUN OK (zero escrita). Plano: " + JSON.stringify(plan));
    saveArtifact("dryrun-plan-d9r2.json", { dryRun: true, plan });
    process.exit(0);
  }

  // APPLY
  if (CONFIRM !== REQUIRED) die("CONFIRM_CLEANUP invalido — nada foi escrito");
  const removedAt = new Date().toISOString();
  for (const t of TARGETS) {
    await col.doc(t.id).update({
      status: "removido",
      removedAt,
      removedReason: "F3.3.70D9R2 — teste/canario/duplicado (limpeza autorizada pelo owner)",
    });
    console.log("APPLY: " + t.id + " status->removido");
  }

  // G5 — read-back + roster final
  for (const t of TARGETS) {
    const d = (await col.doc(t.id).get()).data() || {};
    if (d.status !== "removido") die("read-back falhou em " + t.id);
  }
  for (const id of PROTECTED) {
    const d = (await col.doc(id).get()).data() || {};
    if (JSON.stringify(d) !== JSON.stringify(protectedBefore[id])) die("PROTECTED foi alterado (INESPERADO): " + id);
  }
  const all = await col.get();
  const visiveis = all.docs.map(x => ({ id: x.id, ...x.data() })).filter(u => !["removido", "excluido"].includes(u.status || ""));
  const visIds = visiveis.map(v => v.id).sort();
  const expIds = [...PROTECTED].sort();
  if (JSON.stringify(visIds) !== JSON.stringify(expIds))
    die("roster final diverge dos 5 esperados", { visiveis: visIds, esperados: expIds });
  console.log("G5 OK: roster visivel final = 5 reais: " + visiveis.map(v => v.name).join(" | "));
  saveArtifact("apply-result-d9r2.json", { removedAt, targets: TARGETS.map(t => t.id), rosterFinal: visiveis.map(v => ({ id: v.id, name: v.name, role: v.role, status: v.status })) });
  console.log("===== GO: LIMPEZA USERSPUBLIC D9R2 CONCLUIDA E VERIFICADA =====");
}
main().catch(e => { console.error("ERRO:", e && e.message ? e.message : e); process.exit(1); });
