#!/usr/bin/env node
/* =====================================================================
   F3.3.73E — Testes HERMÉTICOS (texto/fonte) do BOARD/KANBAN CANÔNICO
   do Android alinhado ao Desktop 1.0.159 (71C7):
     - colunas/estados/labels/cores/descrições batem com o STATUS canônico;
     - setores idênticos, com copywriting DESCONTINUADO na criação
       (histórico preservado: hub/Board/alias/templates continuam resolvendo);
     - Chat FORA do fluxo principal (sem aba, sem rota; telas viram dead code);
     - decisão de leitura/escrita de tasks: Firestore direto PRESERVADO
       (paridade com a produção; Rules atuais permitem — evidência no gate);
     - regressões 73C/73D (login server-side, usersPublic, self) intactas.
   Lê Kotlin como TEXTO — NÃO compila, NÃO gera APK, NÃO chama rede, NÃO escreve.
   Vive em desktop/scripts/ (fora de android-native-beta/**) → não dispara workflow.
   Compilação real: android-compile-check.yml (compileDebugKotlin, sem APK).
   ===================================================================== */
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AND = path.resolve(__dirname, "..", "..", "android-native-beta", "app");
const rd = (p) => fs.readFileSync(path.join(AND, p), "utf8");
const P = "src/main/java/br/com/idseven/agenda/nativebeta";
const TYPES = rd(`${P}/domain/Types.kt`);
const TASKREPO = rd(`${P}/data/TaskRepo.kt`);
const CONTRACT = rd(`${P}/data/TaskContract.kt`);
const TASKS = rd(`${P}/features/tasks/TasksScreen.kt`);
const HUB = rd(`${P}/features/tasks/BoardsHubScreen.kt`);
const FORM = rd(`${P}/features/tasks/TaskFormScreen.kt`);
const TPLS = rd(`${P}/features/tasks/TaskTemplates.kt`);
const SCAFFOLD = rd(`${P}/core/MainScaffold.kt`);
const AUTH = rd(`${P}/data/AuthRepo.kt`);
const USERS = rd(`${P}/data/UsersRepo.kt`);
const PROFILE = rd(`${P}/features/profile/ProfileScreen.kt`);

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log("  PASS — " + n); } else { fail++; console.error("  FAIL — " + n); } };

console.log("F3.3.73E — Board/Kanban canônico Android (hermético por texto)");

/* ── A: colunas/estados canônicos (Desktop 1.0.159 STATUS) ── */
ok("A1 4 colunas canônicas afazer/andamento/revisao/concluido",
  /COLUMNS = listOf\("afazer", "andamento", "revisao", "concluido"\)/.test(TYPES));
ok("A2 labels canônicos (A Fazer/Em andamento/Revisão/Concluído)",
  /"andamento" -> "Em andamento"/.test(TYPES) && /"revisao" -> "Revisão"/.test(TYPES) &&
  /"concluido" -> "Concluído"/.test(TYPES) && /else -> "A Fazer"/.test(TYPES));
ok("A3 cores canônicas por coluna (9BA0AB/F59E0B/60A5FA/34D399)",
  /0xFFF59E0B/.test(TYPES) && /0xFF60A5FA/.test(TYPES) && /0xFF34D399/.test(TYPES) && /0xFF9BA0AB/.test(TYPES));
ok("A4 descrições canônicas por coluna",
  /"Em execução agora"/.test(TYPES) && /"Aguardando revisão"/.test(TYPES) &&
  /"Tarefas finalizadas"/.test(TYPES) && /"Aguardando início"/.test(TYPES));
ok("A5 board itera as colunas canônicas (pager + seletor)",
  /rememberPagerState\(pageCount = \{ TaskStatus\.COLUMNS\.size \}\)/.test(TASKS) &&
  /TaskStatus\.COLUMNS\[page\]/.test(TASKS));

/* ── B: setores canônicos + copywriting descontinuado (paridade 71C7) ── */
ok("B1 5 setores canônicos presentes",
  ["edicao_midia", "cronograma", "copywriting", "roteiro", "programacao_posts"].every(k => TYPES.includes(`"${k}"`)));
ok("B2 copywriting marcado descontinuado = true",
  /Sec\("copywriting"[\s\S]{0,120}descontinuado = true\)/.test(TYPES));
ok("B3 flag descontinuado com default false (demais setores ativos)",
  /val descontinuado: Boolean = false/.test(TYPES));
ok("B4 alias legado copy→copywriting preservado (histórico resolve)",
  /"copy" to "copywriting"/.test(TYPES));

/* ── C: criação SEM copywriting; histórico PRESERVADO ── */
ok("C1 criação oferece SOMENTE setores ativos (filtra descontinuado)",
  /Sectors\.ALL\.filter \{ !it\.descontinuado \}\.forEach/.test(FORM));
ok("C2 initialSector descontinuado NÃO pré-seleciona a criação (guarda 71C7)",
  /takeIf \{ !it\.descontinuado \}/.test(FORM));
ok("C3 edição de tarefa histórica NÃO força troca de setor (editId preserva t.sector)",
  /sector = Sectors\.of\(t\.sector\)\.key/.test(FORM));
ok("C4 hub Quadros mostra TODOS os setores (histórico visível, igual Desktop)",
  /items\(Sectors\.ALL, key = \{ it\.key \}\)/.test(HUB) && !/filter \{ !it\.descontinuado \}/.test(HUB));
ok("C5 template de copywriting preservado (edição histórica)",
  /"copywriting" to SectorTpl\(/.test(TPLS));
ok("C6 board não filtra tarefas por setor descontinuado (histórico aparece)",
  !/descontinuado/.test(TASKS));

/* ── D: Chat FORA do fluxo principal (paridade 71C7) ── */
ok("D1 aba Chat removida da bottom nav",
  !/Tab\("chat"/.test(SCAFFOLD) && !/ChatBubbleOutline/.test(SCAFFOLD));
ok("D2 rotas chat/chatThread removidas do NavHost",
  !/composable\("chat"\)/.test(SCAFFOLD) && !/composable\("chatThread/.test(SCAFFOLD));
ok("D3 telas de chat não são mais importadas (dead code preservado no repo)",
  !/import .*features\.chat\./.test(SCAFFOLD) &&
  fs.existsSync(path.join(AND, `${P}/features/chat/ChatListScreen.kt`)));
ok("D4 deep-link legado de chat é ignorado (sem navegação)",
  /dl\.startsWith\("chat:"\) -> return@LaunchedEffect/.test(SCAFFOLD));
ok("D5 abas canônicas preservadas (hoje/agenda/tarefas/equipe/perfil)",
  ["hoje", "agenda", "tarefas", "equipe", "perfil"].every(t => SCAFFOLD.includes(`Tab("${t}"`)));

/* ── E: decisão de leitura/escrita — Firestore direto preservado (paridade produção) ── */
ok("E1 leitura de tasks segue Firestore direto (contrato do produto; Rules permitem)",
  /collection\("tasks"\)\.addSnapshotListener/.test(TASKREPO));
ok("E2 escrita/move segue o contrato PWA (statusPatch com startedAt/doneAt/doneBy)",
  /startedAt/.test(CONTRACT) && /doneAt/.test(CONTRACT) && /doneBy/.test(CONTRACT) &&
  /FieldValue\.arrayUnion/.test(TASKREPO));
ok("E3 nenhum endpoint fake/inventado de tasks introduzido",
  !/FN_TASKS_URL/.test(TASKREPO) && !/https:\/\/[a-z]*tasks/i.test(TASKREPO));
ok("E4 movimentos canônicos do Kanban (avançar/voltar/reabrir)",
  /"afazer" -> listOf\(MoveOpt\("Mover para Em andamento", "andamento"/.test(TASKS) &&
  /MoveOpt\("Mover para Concluído", "concluido"/.test(TASKS) &&
  /MoveOpt\("Reabrir tarefa", "andamento"/.test(TASKS));

/* ── F: regressões 73C/73D preservadas ── */
ok("F1 login segue server-side (loginUser), sem Firestore direto no login",
  /FN_LOGIN_URL/.test(AUTH));
ok("F2 Equipe segue usersPublic com filtros (73D intacta)",
  /collection\("usersPublic"\)/.test(USERS) && /isActive\(/.test(USERS));
ok("F3 Perfil segue self/getUserSelf (73D intacta)",
  /self\?\.email/.test(PROFILE) && /FN_SELF_URL/.test(AUTH));
ok("F4 AssigneePicker segue consumindo users ativos (criação de tarefa)",
  /users\.filter \{ it\.isActive\(\) \}/.test(FORM));

console.log("\nRESULTADO: " + pass + "/" + (pass + fail) + " PASS" + (fail ? " — HÁ FALHAS" : " — SUITE OK"));
process.exit(fail ? 1 : 0);
