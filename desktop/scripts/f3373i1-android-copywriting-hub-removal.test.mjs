#!/usr/bin/env node
/* =====================================================================
   F3.3.73I1 — Testes HERMÉTICOS (texto/fonte) do corte de COPYWRITING do
   hub principal Tarefas → Quadros (NO-GO do owner-run físico da 73I):
     - hub renderiza SOMENTE setores ativos (card e contagem da pílula);
     - NADA é apagado/migrado: definição/alias/template de Copywriting
       permanecem para tarefas HISTÓRICAS (detalhe/edição continuam);
     - criação segue sem Copywriting (filtro + guarda 73E intactos);
     - Chat segue fora do fluxo; regressões 73C–73H intactas.
   Lê Kotlin como TEXTO — NÃO compila, NÃO gera APK, NÃO chama rede, NÃO escreve.
   Vive em desktop/scripts/ (fora de android-native-beta/**) → não dispara workflow.
   Compilação real: android-compile-check.yml (compileDebugKotlin, sem APK).
   ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AND = path.resolve(__dirname, "..", "..", "android-native-beta", "app");
const rd = (p) => fs.readFileSync(path.join(AND, p), "utf8");
const P = "src/main/java/br/com/idseven/agenda/nativebeta";
const HUB = rd(`${P}/features/tasks/BoardsHubScreen.kt`);
const TYPES = rd(`${P}/domain/Types.kt`);
const TPLS = rd(`${P}/features/tasks/TaskTemplates.kt`);
const FORM = rd(`${P}/features/tasks/TaskFormScreen.kt`);
const TASKREPO = rd(`${P}/data/TaskRepo.kt`);
const SCAFFOLD = rd(`${P}/core/MainScaffold.kt`);
const AUTH = rd(`${P}/data/AuthRepo.kt`);
const USERS = rd(`${P}/data/UsersRepo.kt`);
const FCMAPI = rd(`${P}/data/FcmApi.kt`);
const SVC = rd(`${P}/core/AppFirebaseMessagingService.kt`);

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  PASS — " + n); } else { fail++; console.error("  FAIL — " + n); } };

console.log("F3.3.73I1 — Copywriting fora do hub Quadros (hermético por texto)");

/* ── A: hub sem Copywriting ── */
ok("A1 hub lista SOMENTE setores ativos (filtro descontinuado nos cards)",
  /items\(Sectors\.ALL\.filter \{ !it\.descontinuado \}, key = \{ it\.key \}\)/.test(HUB));
ok("A2 pílula de total conta SÓ tarefas de setores ativos (fluxo visual coerente)",
  /val shown = all\.filter \{ !Sectors\.of\(it\.sector\)\.descontinuado \}/.test(HUB) &&
  /\$\{shown\.size\} tarefas/.test(HUB));
ok("A3 contagem por card usa a mesma lista filtrada",
  /val list = shown\.filter \{ Sectors\.of\(it\.sector\)\.key == s\.key \}/.test(HUB));
ok("A4 copywriting é o ÚNICO setor descontinuado (ativos: edição/cronograma/roteiro/posts)",
  /Sec\("copywriting"[\s\S]{0,120}descontinuado = true\)/.test(TYPES) &&
  (TYPES.match(/descontinuado = true/g) || []).length === 1);

/* ── B: histórico preservado (nada apagado/migrado) ── */
ok("B1 definição de Copywriting permanece em Sectors (labels/cores p/ tarefas antigas)",
  /Sec\("copywriting", "Copywriting"/.test(TYPES));
ok("B2 alias legado copy→copywriting preservado",
  /"copy" to "copywriting"/.test(TYPES));
ok("B3 template de Copywriting preservado (edição de tarefa histórica)",
  /"copywriting" to SectorTpl\(/.test(TPLS));
ok("B4 nenhuma exclusão/migração de dados no patch (TaskRepo intocado; hub é só render)",
  /collection\("tasks"\)\.addSnapshotListener/.test(TASKREPO) && !/descontinuado/.test(TASKREPO) &&
  !/delete|migra/i.test(HUB.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "")));

/* ── C: criação segue sem Copywriting (73E intacta) ── */
ok("C1 passo Setor filtra descontinuado",
  /Sectors\.ALL\.filter \{ !it\.descontinuado \}\.forEach/.test(FORM));
ok("C2 guarda de initialSector descontinuado preservada",
  /takeIf \{ !it\.descontinuado \}/.test(FORM));

/* ── D: Chat fora do fluxo + regressões 73C–73H ── */
ok("D1 Chat segue fora (sem aba, sem rota, deep-link ignorado)",
  !/Tab\("chat"/.test(SCAFFOLD) && !/composable\("chat"\)/.test(SCAFFOLD) &&
  /dl\.startsWith\("chat:"\) -> return@LaunchedEffect/.test(SCAFFOLD));
ok("D2 login server-side intacto", /FN_LOGIN_URL/.test(AUTH));
ok("D3 Perfil getUserSelf intacto", /FN_SELF_URL/.test(AUTH));
ok("D4 Equipe usersPublic intacta", /collection\("usersPublic"\)/.test(USERS));
ok("D5 Agenda intacta", /collection\("events"\)\.addSnapshotListener/.test(rd(`${P}/data/EventRepo.kt`)));
ok("D6 FCM token server-side intacto (registerFcmToken)",
  /REGISTER_FCM_TOKEN_URL/.test(FCMAPI) && /FcmApi\.register\(applicationContext, token\)/.test(SVC));
ok("D7 push foreground/background intacto (supressão só task + canal immediate)",
  /AppForeground\.isForeground && data\["type"\] == "task"/.test(SVC) && /CH_IMMEDIATE/.test(SVC));
ok("D8 Board/Kanban intacto (4 colunas canônicas)",
  /COLUMNS = listOf\("afazer", "andamento", "revisao", "concluido"\)/.test(TYPES));

console.log("\nRESULTADO: " + pass + "/" + (pass + fail) + " PASS" + (fail ? " — HÁ FALHAS" : " — SUITE OK"));
process.exit(fail ? 1 : 0);
