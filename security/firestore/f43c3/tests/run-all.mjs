// =====================================================================
// F4.3C3 — Agregador de suítes de teste das Rules-alvo no Emulator.
// Carrega o env uma vez, roda cada suíte, limpa dados entre suítes,
// imprime o resumo numerado e sai != 0 se qualquer asserção falhar.
// =====================================================================
import { getEnv } from "./_harness.mjs";

const SUITES = [
  "./01-anonimo.mjs",
  "./02-users.mjs",
  "./03-tasks.mjs",
  "./04-events.mjs",
  "./05-chats.mjs",
  "./06-campos-mass-assignment.mjs",
  "./07-desktop-1.0.191.mjs",
  "./08-f43c2-identidades.mjs",
];

const env = await getEnv();
let totalPass = 0, totalFail = 0;
const allFailures = [];

for (const path of SUITES) {
  let mod;
  try {
    mod = await import(path);
  } catch (e) {
    console.error(`!! suíte ausente/erro ${path}: ${(e && e.message) || e}`);
    continue;
  }
  await env.clearFirestore();               // isolamento entre suítes
  const sum = await mod.run(env);
  totalPass += sum.pass;
  totalFail += sum.fail;
  console.log(`[${sum.suiteName}] ${sum.pass}/${sum.total} ok`);
  for (const f of sum.failures) allFailures.push(`${sum.suiteName} :: ${f}`);
}

await env.cleanup();
console.log("");
console.log(`F4.3C3 RULES (emulator): ${totalPass} OK, ${totalFail} FALHOU (total ${totalPass + totalFail})`);
if (allFailures.length) {
  console.log("--- falhas ---");
  for (const f of allFailures) console.log("  " + f);
  process.exit(1);
}
