// F3.3.20-B1.7-E — teste do fix de estado/payload da UI notifPrefs.
// Prova: render(cur) preserva false; buildNotifPrefsPayload preserva false; e os 4 pontos do fix
// (caller passa cur; setStatus no nó vivo; change-listeners sincronizam draft; logout reseta draft).
// Falha no código ANTIGO (caller sem cur, setStatus por ref, sem listeners/draft) e passa no patched.
import fs from "node:fs";

const html = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const lines = html.split("\n");
const s = lines.findIndex(l => l.includes("__NPC_START__"));
const b = lines.findIndex((l, i) => i > s && l.includes("function bindNotifPrefsPushSection"));
let e = b; while (e < lines.length && lines[e] !== "}") e++;
if (s < 0 || b < 0 || e >= lines.length) { console.error("FAIL: nao localizei o slice notifPrefs"); process.exit(2); }
const slice = lines.slice(s, e + 1).join("\n");

// expõe as funções puras (render/buildNotifPrefsPayload); bind não é chamado (precisa de DOM)
const M = new Function(slice + "\n; return { renderNotifPrefsPushSection, buildNotifPrefsPayload };")();

const R = []; const rec = (n, p, d) => { R.push({ n, p: !!p }); console.log((p ? "PASS" : "FAIL") + " — " + n + (d ? ("  :: " + d) : "")); };

// 1) render(cur task_assigned=false) -> checkbox SEM 'checked'
const h1 = M.renderNotifPrefsPushSection({ enabled: true, byEvent: { task_assigned: false, event_assigned: true, chat_message: true }, byPlatform: { android: true } });
const taskRow1 = (h1.match(/id="np_task_assigned"[^>]*>/) || [""])[0];
rec("render(cur task_assigned=false) -> np_task_assigned SEM checked", !/checked/.test(taskRow1), taskRow1);
rec("render(cur) -> np_event_assigned COM checked", /id="np_event_assigned"[^>]*checked/.test(h1));
rec("render(cur) -> np_android COM checked", /id="np_android"[^>]*checked/.test(h1));

// 2) render() sem cur -> default permissivo (tudo ON) — comportamento de primeira renderização
const h0 = M.renderNotifPrefsPushSection();
rec("render() sem cur -> np_task_assigned COM checked (default ON)", /id="np_task_assigned"[^>]*checked/.test(h0));

// 3) buildNotifPrefsPayload preserva false (não converte para true)
const p = M.buildNotifPrefsPayload({ enabled: true, task_assigned: false, event_assigned: true, chat_message: true, android: true });
rec("buildNotifPrefsPayload preserva byEvent.task_assigned=false", !!(p.byEvent && p.byEvent.task_assigned === false), JSON.stringify(p));
rec("buildNotifPrefsPayload mantém event_assigned=true/android=true", p.byEvent.event_assigned === true && p.byPlatform.android === true);

// 4) regressão no SOURCE — falham no código antigo, passam no patched
rec("caller renderiza com cur (renderNotifPrefsPushSection(notifPrefsDraftState))", html.includes("renderNotifPrefsPushSection(notifPrefsDraftState)"));
rec("setStatus escreve no nó vivo (getElementById np_status)", html.includes('function setStatus(msg,kind){ var el=document.getElementById("np_status")'));
rec("change-listeners sincronizam o draft", /addEventListener\("change"[\s\S]{0,140}notifPrefsDraftState = buildNotifPrefsPayload\(readState\(\)\)/.test(html));
rec("logout reseta notifPrefsDraftState", /function logout\(\)\{[\s\S]{0,200}notifPrefsDraftState = null/.test(html));
rec("declara var notifPrefsDraftState", /var notifPrefsDraftState = null;/.test(html));

const fails = R.filter(x => !x.p);
console.log("\n==== " + (R.length - fails.length) + "/" + R.length + " PASS ====");
console.log(fails.length ? ("FALHAS: " + fails.map(f => f.n).join("; ")) : "GO: fix de estado/payload da UI notifPrefs validado (false preservado).");
process.exit(fails.length ? 1 : 0);
