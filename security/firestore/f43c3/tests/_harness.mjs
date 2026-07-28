// =====================================================================
// F4.3C3 — Harness de testes das Firestore Rules no Emulator Suite.
// ---------------------------------------------------------------------
// - Carrega as Rules-alvo (firestore.f43c3-target.rules) no emulador.
// - Project ID FICTÍCIO obrigatório: demo-agenda-id-seven-f43c3.
// - Sem produção, sem secrets, sem dados reais. Fixtures 100% sintéticas.
// - Identidades via Auth do emulador (uid = request.auth.uid) — espelha o
//   fluxo F4.3C2: login -> sessão -> Custom Token -> request.auth.uid.
// =====================================================================
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";

const __dir = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ID = "demo-agenda-id-seven-f43c3";
export const RULES_PATH = join(__dir, "..", "firestore.f43c3-target.rules");

let _env = null;
export async function getEnv() {
  if (_env) return _env;
  const rules = readFileSync(RULES_PATH, "utf8");
  const host = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
  _env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: host[0], port: Number(host[1]), rules },
  });
  return _env;
}

// Contexto autenticado (uid vem SÓ de request.auth). token opcional (claims).
export function authed(env, uid, token) {
  return env.authenticatedContext(uid, token || {}).firestore();
}
export function anon(env) {
  return env.unauthenticatedContext().firestore();
}

// Semeia documentos IGNORANDO as Rules (fixtures sintéticas de partida).
export async function seed(env, fn) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore());
  });
}

export { assertFails, assertSucceeds };

// Mini-framework de asserção numerada (relatório determinístico, sem libs).
export function makeReporter(suiteName) {
  let pass = 0, fail = 0;
  const failures = [];
  async function t(num, desc, fnAsync) {
    try {
      await fnAsync();
      pass++;
      // console.log(`  ok  ${num}. ${desc}`);
    } catch (e) {
      fail++;
      failures.push(`${num}. ${desc} :: ${(e && e.message) || e}`);
      console.error(`  ✗ FALHOU ${num}. ${desc} :: ${(e && e.message || e).toString().slice(0, 200)}`);
    }
  }
  function summary() {
    return { suiteName, pass, fail, total: pass + fail, failures };
  }
  return { t, summary };
}
