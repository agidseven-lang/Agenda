/**
 * F3.5.4N — f354n-startup.test.mjs — PROVAS do startupPrefs (iniciar com o Windows).
 * Executa o startupPrefs REAL (dist) com sys (login item) e store (JSON) fakes.
 * Prova: default-ON aplicado UMA vez; nunca reescreve/reativa depois (não briga com a bandeja);
 * setOpenAtLogin reflete no SO; verify lê o SO real; não-Windows é no-op; wasOpenedAtLogin.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createStartupPrefs } = require("../dist/main/startupPrefs.js");

let pass = 0, fail = 0; const flog = [];
const ok = (n, c) => { if (c) pass++; else { fail++; flog.push("FAIL: " + n); } };

function fakeSys(platform) {
  const os = { openAtLogin: false, args: [], wasOpenedAtLogin: false };
  return {
    platform,
    get: (_opts) => ({ openAtLogin: os.openAtLogin, executableWillLaunchAtLogin: os.openAtLogin, wasOpenedAtLogin: os.wasOpenedAtLogin }),
    set: (opts) => { os.openAtLogin = !!opts.openAtLogin; os.args = opts.args || []; },
    _peek: () => os,
    _setWasOpened: (v) => { os.wasOpenedAtLogin = !!v; },
  };
}
function fakeStore() {
  let data = {};
  return { read: () => JSON.parse(JSON.stringify(data)), write: (o) => { data = JSON.parse(JSON.stringify(o || {})); }, _peek: () => data };
}

// 1 — 1ª execução: default-ON aplicado UMA vez (openAtLogin + --hidden), marca defaultsApplied
{
  const sys = fakeSys("win32"); const store = fakeStore();
  const sp = createStartupPrefs({ sys, store, argv: () => ["app.exe"] });
  const r = sp.applyDefaultsOnce();
  ok("1 default-ON aplicado (changed)", r.openAtLogin === true && r.changed === true);
  ok("1 SO ligado com --hidden", sys._peek().openAtLogin === true && sys._peek().args.includes("--hidden"));
  ok("1 marcador defaultsApplied persistido", store._peek().defaultsApplied === true);
  ok("1 read reflete o SO (hiddenStart sempre true)", sp.read().openAtLogin === true && sp.read().hiddenStart === true);
}

// 2 — 2ª execução: applyDefaultsOnce é no-op e NÃO reativa o que o usuário desligou (não briga)
{
  const sys = fakeSys("win32"); const store = fakeStore();
  const sp = createStartupPrefs({ sys, store, argv: () => ["app.exe"] });
  sp.applyDefaultsOnce();                                  // 1ª execução liga
  sys.set({ openAtLogin: false, args: ["--hidden"] });     // usuário DESLIGA pela bandeja (autostart.ts → SO)
  const r2 = sp.applyDefaultsOnce();                       // 2ª execução NÃO deve reativar
  ok("2 2ª execução é no-op (changed=false)", r2.changed === false);
  ok("2 respeita o desligamento do usuário (não reativa)", sys._peek().openAtLogin === false);
  ok("2 read reflete o SO desligado (não JSON velho)", sp.read().openAtLogin === false);
}

// 3 — setOpenAtLogin liga/desliga o SO, marca defaultsApplied e nunca é revertido pelo default
{
  const sys = fakeSys("win32"); const store = fakeStore();
  const sp = createStartupPrefs({ sys, store, argv: () => ["app.exe"] });
  sp.setOpenAtLogin(true);
  ok("3 setOpenAtLogin(true) → SO ligado + --hidden", sys._peek().openAtLogin === true && sys._peek().args.includes("--hidden"));
  ok("3 marca defaultsApplied", store._peek().defaultsApplied === true);
  sp.setOpenAtLogin(false);
  ok("3 setOpenAtLogin(false) → SO desligado", sys._peek().openAtLogin === false);
  const r = sp.applyDefaultsOnce();
  ok("3 applyDefaultsOnce após decisão do usuário NÃO reativa", r.changed === false && sys._peek().openAtLogin === false);
}

// 4 — verify() lê o estado REAL do SO (prova do registro efetivo)
{
  const sys = fakeSys("win32"); const store = fakeStore();
  const sp = createStartupPrefs({ sys, store, argv: () => ["app.exe"] });
  sp.setOpenAtLogin(true);
  const v = sp.verify();
  ok("4 verify: SO ligado + willLaunch + consistente", v.osOpenAtLogin === true && v.willLaunch === true && v.consistent === true);
}

// 5 — não-Windows: applyDefaultsOnce é no-op e verify consistente
{
  const sys = fakeSys("linux"); const store = fakeStore();
  const sp = createStartupPrefs({ sys, store, argv: () => ["app"] });
  const r = sp.applyDefaultsOnce();
  ok("5 linux → applyDefaultsOnce no-op", r.changed === false && sys._peek().openAtLogin === false);
  ok("5 linux → verify consistente", sp.verify().consistent === true);
}

// 6 — wasOpenedAtLogin: arg --hidden OU wasOpenedAtLogin do SO
{
  const spArg = createStartupPrefs({ sys: fakeSys("win32"), store: fakeStore(), argv: () => ["app.exe", "--hidden"] });
  ok("6 --hidden no argv → wasOpenedAtLogin", spArg.wasOpenedAtLogin() === true);
  const sys2 = fakeSys("win32");
  const spOs = createStartupPrefs({ sys: sys2, store: fakeStore(), argv: () => ["app.exe"] });
  ok("6 sem --hidden e SO não marcou → false", spOs.wasOpenedAtLogin() === false);
  sys2._setWasOpened(true);
  ok("6 SO wasOpenedAtLogin → true", spOs.wasOpenedAtLogin() === true);
}

console.log("\n===== F3.5.4N — STARTUP PREFS (iniciar com o Windows) =====");
if (flog.length) console.log("\n" + flog.join("\n") + "\n");
console.log("F3.5.4N-STARTUP: " + pass + " OK, " + fail + " FAIL");
if (fail) { console.error("::error:: startupPrefs divergiu do contrato (default-ON idempotente / SO-é-a-verdade / verify)"); process.exit(1); }
console.log("OK — default-ON aplicado 1x; nunca reativa depois (não briga com a bandeja); verify lê o SO real; --hidden preservado.");
