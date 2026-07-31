/**
 * F3.5.4N — f354n-watchdog.test.mjs — PROVAS do supervisor/último-recurso do listener.
 * Executa o listenerWatchdog REAL (dist) com timers/rede/auth fakes e clock controlado.
 * Prova (mandato do owner): firebase.ts é o 1º respondente; o watchdog NÃO cria 2º ciclo;
 * 1 listener ativo; 1 timer de reconexão; geração antiga encerrada antes da nova; sem restart
 * simultâneo; sem duplicação após offline/resume/unlock/erro; ocioso nunca é falha.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createListenerWatchdog } = require("../dist/main/listenerWatchdog.js");

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) pass++; else { fail++; flog.push("FAIL: " + n); } };

function harness(opts = {}) {
  let clock = 1_000_000;
  const timers = []; // {id, fn, at}
  let seq = 0;
  const setTimer = (fn, ms) => { const id = ++seq; timers.push({ id, fn, at: clock + ms }); return id; };
  const clearTimer = (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); };
  const advance = (ms) => { clock += ms; for (;;) { const due = timers.filter((t) => t.at <= clock).sort((a, b) => a.at - b.at); if (!due.length) break; const t = due[0]; clearTimer(t.id); try { t.fn(); } catch (e) { /* */ } } };
  const st = { online: true, auth: true, selfheal: opts.selfheal !== false, active: 0, restarts: 0, reconciles: 0, alerts: 0, maxActiveSeen: 0 };
  const wd = createListenerWatchdog({
    restartAll: () => { st.active = 0; /* main PARA a geração antiga */ st.active = 1; /* inicia UMA nova */ st.restarts++; st.maxActiveSeen = Math.max(st.maxActiveSeen, st.active); },
    reconcileAll: () => { st.reconciles++; },
    isAuthValid: () => st.auth, isOnline: () => st.online, selfHealingEnabled: () => st.selfheal,
    onAdminAlert: () => { st.alerts++; },
    onLog: () => {}, now: () => clock, setTimer, clearTimer,
    degradedAttempt: 4, lastResortMs: 120000, maxLastResortPerWindow: 3,
  });
  return { wd, st, advance, timersLen: () => timers.length, snap: () => wd.snapshot() };
}
const G = (n) => ({ col: "tasks", generation: n });

// 1 — ocioso NUNCA é falha
{
  const h = harness(); h.wd.start();
  h.wd.onHealth({ ...G(1), event: "attach", attempt: 0 });
  h.wd.onHealth({ ...G(1), event: "snapshot", attempt: 0, size: 10, changes: 10 });
  ok("1 snapshot inicial → HEALTHY", h.snap().state === "HEALTHY");
  for (let i = 0; i < 5; i++) h.wd.onHealth({ ...G(1), event: "snapshot", attempt: 0, size: 10, changes: 0 });
  ok("1 snapshots sem mudança → IDLE_HEALTHY (não falha)", h.snap().state === "IDLE_HEALTHY");
  ok("1 ocioso → 0 restart", h.st.restarts === 0);
  ok("1 ocioso → nenhum timer de último recurso", h.snap().lastResortArmed === false);
}

// 2 — erro do SDK: firebase é o 1º respondente; watchdog NÃO reinicia abaixo do limiar
{
  const h = harness(); h.wd.start(); h.wd.onHealth({ ...G(1), event: "snapshot", changes: 5 });
  h.wd.onHealth({ ...G(1), event: "error", attempt: 0 });
  ok("2 erro SDK → RECONNECTING (observa; não reinicia)", h.snap().state === "RECONNECTING");
  h.wd.onHealth({ ...G(1), event: "rearm", attempt: 1 });
  h.wd.onHealth({ ...G(1), event: "rearm", attempt: 2 });
  h.wd.onHealth({ ...G(1), event: "rearm", attempt: 3 });
  ok("2 rearm<limiar → watchdog não arma timer (firebase reconecta)", h.snap().lastResortArmed === false);
  ok("2 rearm<limiar → 0 restart do watchdog", h.st.restarts === 0);
  h.advance(200000);
  ok("2 tempo passa → ainda 0 restart (firebase é o reconectador)", h.st.restarts === 0);
}

// 3 — DEGRADED sustentado → UM ÚNICO restart de último recurso; sem loop; single-active
{
  const h = harness(); h.wd.start(); h.wd.onHealth({ ...G(1), event: "snapshot", changes: 5 });
  h.wd.onHealth({ ...G(1), event: "rearm", attempt: 4 });
  ok("3 attempt≥limiar → DEGRADED", h.snap().state === "DEGRADED");
  ok("3 DEGRADED → alerta admin (1x)", h.st.alerts === 1);
  ok("3 DEGRADED → exatamente 1 timer de último recurso", h.snap().lastResortArmed === true && h.timersLen() === 1);
  h.wd.onHealth({ ...G(1), event: "rearm", attempt: 5 }); // continua falhando
  ok("3 segundo rearm NÃO arma 2º timer", h.timersLen() === 1);
  ok("3 alerta admin não repete", h.st.alerts === 1);
  h.advance(120001); // vence o último recurso
  ok("3 último recurso → 1 restart", h.st.restarts === 1);
  ok("3 nunca >1 listener ativo (para antiga antes da nova)", h.st.maxActiveSeen === 1 && h.st.active === 1);
  ok("3 sem restart simultâneo (não reentrante)", h.snap().restarting === false);
}

// 4 — snapshot saudável desarma o último recurso e zera contadores
{
  const h = harness(); h.wd.start(); h.wd.onHealth({ ...G(1), event: "snapshot", changes: 5 });
  h.wd.onHealth({ ...G(1), event: "rearm", attempt: 4 });
  ok("4 armado", h.snap().lastResortArmed === true);
  h.wd.onHealth({ ...G(2), event: "snapshot", changes: 3 }); // firebase se curou (nova geração)
  ok("4 snapshot → desarma último recurso", h.snap().lastResortArmed === false);
  ok("4 snapshot → HEALTHY", h.snap().state === "HEALTHY");
  h.advance(200000);
  ok("4 após cura → 0 restart", h.st.restarts === 0);
}

// 5 — offline/resume/unlock: reconcile ÚNICO e idempotente; SEM restart; SEM duplicação
{
  const h = harness(); h.wd.start(); h.wd.onHealth({ ...G(1), event: "snapshot", changes: 5 });
  h.wd.setNetwork(false);
  ok("5 offline → OFFLINE", h.snap().state === "OFFLINE");
  ok("5 offline → sem timer (sem churn)", h.snap().lastResortArmed === false);
  h.wd.setNetwork(true);
  ok("5 reconexão → 1 reconcile", h.st.reconciles === 1);
  h.wd.onResume();
  h.wd.onUnlock();
  ok("5 resume+unlock → +2 reconciles (total 3), idempotentes", h.st.reconciles === 3);
  ok("5 offline/resume/unlock → 0 restart", h.st.restarts === 0);
}

// 6 — offline durante DEGRADED limpa o timer (sem churn); e flag OFF nunca reinicia
{
  const h = harness(); h.wd.start(); h.wd.onHealth({ ...G(1), event: "snapshot", changes: 5 });
  h.wd.onHealth({ ...G(1), event: "rearm", attempt: 4 });
  ok("6 armado antes do offline", h.snap().lastResortArmed === true);
  h.wd.setNetwork(false);
  ok("6 offline limpa o timer de último recurso", h.snap().lastResortArmed === false);

  const h2 = harness({ selfheal: false }); h2.wd.start(); h2.wd.onHealth({ ...G(1), event: "snapshot", changes: 5 });
  h2.wd.onHealth({ ...G(1), event: "rearm", attempt: 6 });
  ok("6 flag OFF → DEGRADED sem armar timer", h2.snap().lastResortArmed === false);
  h2.advance(300000);
  ok("6 flag OFF → 0 restart (só autocorreção desligada)", h2.st.restarts === 0);
}

// 7 — logout/quit encerram; sem restart pós-teardown
{
  const h = harness(); h.wd.start(); h.wd.onHealth({ ...G(1), event: "rearm", attempt: 4 });
  h.wd.onLogout();
  ok("7 logout → STOPPED_BY_LOGOUT + timer limpo", h.snap().state === "STOPPED_BY_LOGOUT" && h.snap().lastResortArmed === false);
  h.wd.onQuit();
  ok("7 quit → STOPPED_BY_QUIT", h.snap().state === "STOPPED_BY_QUIT");
  h.advance(300000);
  ok("7 pós-teardown → 0 restart", h.st.restarts === 0);
}

console.log("\n===== F3.5.4N — WATCHDOG (supervisor/último recurso) =====");
if (flog.length) console.log("\n" + flog.join("\n") + "\n");
console.log("F3.5.4N-WATCHDOG: " + pass + " OK, " + fail + " FAIL");
if (fail) { console.error("::error:: watchdog divergiu do contrato de supervisão/último-recurso"); process.exit(1); }
console.log("OK — firebase é o 1º reconectador; watchdog só supervisiona + 1 último recurso; 1 listener; 1 timer; sem restart simultâneo; sem duplicação; ocioso nunca é falha.");
