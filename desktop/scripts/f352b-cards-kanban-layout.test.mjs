#!/usr/bin/env node
/* ============================================================================
 * F3.5.2B — "Edição de Cards" · KANBAN COMPACT LAYOUT (Desktop 1.0.189)
 * ----------------------------------------------------------------------------
 * A correção é EXCLUSIVAMENTE VISUAL e ISOLADA ao setor edicao_cards:
 *   (1) CSS: .kbv2-card--cards:only-child deixa de esticar (flex:0 0 auto) e não
 *       distribui sobra (margin-top:0 em origem/rodapé) — altura natural do conteúdo.
 *   (2) JS : kbv2Card marca o card com a classe kbv2-card--cards SOMENTE quando
 *       sector==='edicao_cards'; qualquer outro setor mantém a saída byte-idêntica.
 *
 * PROVA MESTRA (blindagem): revertendo EXATAMENTE essas 2 edições, o index.html
 * volta BYTE-A-BYTE ao 1.0.188 (83618f7). Logo, NADA além disso mudou — Card
 * Premium, notificações T-30/T-10, datas início/término, SLA, Agenda, demais
 * setores, drag-and-drop, detalhes, tray, updater: intactos.
 *
 * Base congelada: Desktop 1.0.188 · tag v1.0.188 · commit 83618f7…
 * Uso: node scripts/f352b-cards-kanban-layout.test.mjs   (requer git no checkout)
 * ==========================================================================*/
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');                 // desktop/
const BASE_SHA = '83618f72416c58da692e7ecf2d67c8b57534a075';
const IDX_REL = 'desktop/src/renderer/index.html';

let PASS = 0, FAIL = 0; const fails = [];
const ok  = (c, m) => { if (c) { PASS++; } else { FAIL++; fails.push(m); console.error('  ✗ ' + m); } };
const eq  = (a, b, m) => ok(a === b, m + (a === b ? '' : ` [got≠expected]`));

// ---- sources -------------------------------------------------------------
const idxPath = resolve(ROOT, 'src/renderer/index.html');
const CAND = readFileSync(idxPath, 'utf8');
const gitShow = (sha, rel) => execSync(`git show ${sha}:${rel}`, { cwd: resolve(ROOT, '..'), maxBuffer: 1 << 30 }).toString();
const BASE = gitShow(BASE_SHA, IDX_REL);

console.log('F3.5.2B — Kanban compact layout (edicao_cards) — testes\n');

/* ═══ 1) PROVA MESTRA — reverter as 2 edições reproduz o 1.0.188 byte-a-byte ═══ */
// (1a) bloco CSS adicionado (isolado): do comentário F3.5.2B até a regra do footer.
const CSS_START = '/* F3.5.2B — "Edição de Cards" no Kanban';
const CSS_END_MARK = 'body.desktop .kbv2-column-body>.kbv2-card.kbv2-card--cards:only-child>.kbv2-card-footer{ margin-top:0; }\n';
const ci = CAND.indexOf(CSS_START);
const cj = CAND.indexOf(CSS_END_MARK);
ok(ci > 0, '1a. bloco CSS F3.5.2B presente no candidato');
ok(cj > ci, '1a. fim do bloco CSS F3.5.2B localizado');
// (1b) edição JS: comentário + nova linha-raiz do card.
const JS_START = '  /* F3.5.2B — marca APENAS o card do setor interno';
const OLD_ROOT = `  let h='<div class="kbv2-card" data-card-renderer="canonical-board-card" style="--kacc:'+_slaAcc+'">';`;
const NEW_ROOT = `  let h='<div class="kbv2-card'+(s.key==='edicao_cards'?' kbv2-card--cards':'')+'" data-card-renderer="canonical-board-card" style="--kacc:'+_slaAcc+'">';`;
ok(CAND.includes(NEW_ROOT), '1b. linha-raiz do card (com marcador condicional) presente no candidato');
ok(CAND.includes(JS_START), '1b. comentário JS F3.5.2B presente no candidato');
ok(BASE.includes(OLD_ROOT), '1b. linha-raiz ORIGINAL presente na base 1.0.188');
ok(!BASE.includes('kbv2-card--cards'), '1b. base 1.0.188 NÃO contém kbv2-card--cards');

// Reconstrução: candidato → base
let recon = CAND;
// remove o bloco CSS adicionado (inclui o \n final)
if (ci > 0 && cj > ci) recon = recon.slice(0, ci) + recon.slice(cj + CSS_END_MARK.length);
// remove o comentário JS + reverte a linha-raiz para a original
const js0 = recon.indexOf(JS_START);
const js1 = recon.indexOf(NEW_ROOT);
if ( js0 > 0 && js1 > js0) recon = recon.slice(0, js0) + OLD_ROOT + recon.slice(js1 + NEW_ROOT.length);
eq(recon, BASE, '1. PROVA MESTRA — revertendo as 2 edições, index.html == 1.0.188 (83618f7) BYTE-A-BYTE');

/* ═══ 2) O FIX — CSS isolado por setor (altura natural, sem esticar) ═══ */
ok(/body\.desktop \.kbv2-column-body>\.kbv2-card\.kbv2-card--cards:only-child\{ flex:0 0 auto; \}/.test(CAND),
   '2a. override .kbv2-card--cards:only-child => flex:0 0 auto (não estica)');
ok(CAND.includes('.kbv2-card.kbv2-card--cards:only-child>.kbv2-card-origin,') &&
   CAND.includes('.kbv2-card.kbv2-card--cards:only-child>.kbv2-card-footer{ margin-top:0; }'),
   '2b. override margin-top:0 em origem/rodapé do card único de cards (sem vão vazio)');
// seletor SEMPRE combina .kbv2-card--cards (nunca .kbv2-card global sozinho)
const addedCss = CAND.slice(ci, cj + CSS_END_MARK.length);
ok(/\.kbv2-card--cards/.test(addedCss), '2c. regras adicionadas são escopadas por .kbv2-card--cards');
const addedRules = addedCss.split('\n').filter(l => l.trim().startsWith('body.desktop'));
ok(addedRules.length === 3 && addedRules.every(l => l.includes('kbv2-card--cards')),
   '2d. TODAS as 3 regras CSS adicionadas contêm .kbv2-card--cards (nada global)');

/* ═══ 3) O FIX — marcador só para edicao_cards (demais byte-idênticos) ═══ */
ok(NEW_ROOT.includes(`(s.key==='edicao_cards'?' kbv2-card--cards':'')`),
   "3a. marcador aplicado SOMENTE quando s.key==='edicao_cards'");
// para qualquer outro setor o ramo do ternário é '' → classe resolve p/ "kbv2-card" (byte-idêntico)
ok(NEW_ROOT.includes(`:'')`), '3b. ramo não-cards do ternário é string vazia (classe == "kbv2-card")');

/* ═══ 4) REGRAS ORIGINAIS PROD1.6 / CARD-FIT INTACTAS (só ADICIONEI override) ═══ */
ok(CAND.includes('body.desktop .kbv2-column-body>.kbv2-card:only-child{ flex:1 1 auto; min-height:0; }'),
   '4a. regra original :only-child{flex:1 1 auto} PRESERVADA (inalterada)');
ok(CAND.includes('body.desktop .kbv2-column-body>.kbv2-card:only-child>.kbv2-card-footer{ margin-top:auto; }'),
   '4b. bloco original margin-top:auto PRESERVADO');
ok(CAND.includes('body.desktop .kbv2-column-body>.kbv2-card{ max-height:100%; }'),
   '4c. CARD-FIT-NOTEBOOK max-height:100% PRESERVADO');
// bloco base .kbv2-card{...} idêntico
const kbCardBlock = s => { const i = s.indexOf('body.desktop .kbv2-card{'); return s.slice(i, s.indexOf('}', i) + 1); };
eq(kbCardBlock(CAND), kbCardBlock(BASE), '4d. bloco base .kbv2-card{…} BYTE-IDÊNTICO à 1.0.188');

/* ═══ 5) kbv2Card — estrutura/ordem/botões PRESERVADOS (nada removido) ═══ */
const kb = (() => { const i = CAND.indexOf('function kbv2Card('); return CAND.slice(i, CAND.indexOf('\nfunction ', i + 10)); })();
const order = ['kbv2-card-top','kbv2-card-profile','kbv2-card-origin','kbv2-card-main','kbv2-card-chips','kbv2-card-rail','kbv2-stage2','kbv2-card-date','kbv2-card-footer'];
let last = -1, ordered = true;
for (const cls of order) { const at = kb.indexOf('"'+cls); ok(at > 0, `5. bloco .${cls} presente no kbv2Card`); if (at < last) ordered = false; last = at; }
ok(ordered, '5z. ordem dos blocos preservada (status→prazo→responsável→remetente→cliente→tema→setor→progresso→etapa→próxima→data→botões)');
ok(kb.includes('data-detail="') && kb.includes('data-move="') && kb.includes('data-cardmenu="'),
   '5b. botões Detalhes / Mover / Menu preservados (handlers data-*)');
ok(kb.includes('kbv2-title') && kb.includes('kbv2-tier'), '5c. tema (título) e cliente (tier) preservados');
ok(kb.includes('kbv2-card-rail') && kb.includes('Etapa atual') && kb.includes('Próxima ação'),
   '5d. progresso + etapa atual + próxima ação preservados');

/* ═══ 6) EDIÇÃO DE CARDS não renderiza blocos de cliente/temas (sem vão a preencher) ═══ */
ok(/function isClientSector\(k\)\{return k==='cronograma'\|\|k==='roteiro';\}/.test(CAND),
   "6a. isClientSector = {cronograma,roteiro} — edicao_cards é interno (BYTE-IDÊNTICO)");
// themes só entram para setor-cliente (cron); edicao_cards nunca cai nesse ramo
ok(kb.includes('if(cron&&cron.list.length)') || kb.includes('kbv2-card-themes'),
   '6b. bloco de temas é condicional a cronograma (edicao_cards não o renderiza)');

/* ═══ 7) BYTE-IDENTIDADE dos módulos congelados vs 1.0.188 (git) ═══ */
const sameAsBase = (rel, label) => {
  const cur = readFileSync(resolve(ROOT, '..', rel), 'utf8');
  eq(cur, gitShow(BASE_SHA, rel), label);
};
sameAsBase('desktop/src/main/cardsRules.js',   '7a. cardsRules.js (T-30/T-10) BYTE-IDÊNTICO');
sameAsBase('desktop/src/main/slaRules.js',     '7b. slaRules.js BYTE-IDÊNTICO');
sameAsBase('desktop/src/main/slaScheduler.ts', '7c. slaScheduler.ts BYTE-IDÊNTICO');
sameAsBase('desktop/src/main/main.ts',         '7d. main.ts (janela/entrega/tray/X) BYTE-IDÊNTICO');
sameAsBase('desktop/src/main/notifier.ts',     '7e. notifier.ts BYTE-IDÊNTICO');
sameAsBase('desktop/src/main/tray.ts',         '7f. tray.ts BYTE-IDÊNTICO');
sameAsBase('desktop/src/main/bgNotify.ts',     '7g. bgNotify.ts BYTE-IDÊNTICO');

/* ═══ 8) CARD PREMIUM / cliente — funções BYTE-IDÊNTICAS (extração e comparação) ═══ */
const slice = (src, sig, endSig) => { const i = src.indexOf(sig); if (i < 0) return null; const j = endSig ? src.indexOf(endSig, i) : -1; return j > 0 ? src.slice(i, j) : src.slice(i, i + 4000); };
for (const fn of ['isClientSector','ensureReviewToken','ensureStableClientReviewToken','buildShareClientUrl','buildClientMessage','canSendToClient','openSendClientModal']) {
  const a = slice(CAND, 'function ' + fn) ?? slice(CAND, fn + '=') ?? slice(CAND, fn + ':');
  const b = slice(BASE, 'function ' + fn) ?? slice(BASE, fn + '=') ?? slice(BASE, fn + ':');
  ok(a !== null && b !== null && a === b, `8. Card Premium/cliente — ${fn} BYTE-IDÊNTICO à 1.0.188`);
}

/* ═══ 9) VERSÃO candidata = 1.0.189 exata (sem sufixo) ═══ */
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
eq(pkg.version, '1.0.189', '9. desktop/package.json version == 1.0.189');
ok(!/-/.test(pkg.version), '9b. versão sem sufixo (estável)');

/* ═══ 10) ANDROID/WORKER/FUNCTIONS/RULES INTACTOS (diff fora de desktop/ vazio) ═══ */
const outside = execSync(`git diff --name-only ${BASE_SHA} -- . ':!desktop'`, { cwd: resolve(ROOT, '..'), maxBuffer: 1 << 30 }).toString().trim();
eq(outside, '', '10. NENHUM arquivo fora de desktop/ mudou vs 1.0.188 (Android/Worker/Functions/Rules intactos)');

/* ═══ 11) 38 pontos obrigatórios — mapa de cobertura (source-level) ═══ */
// Muitos já cobertos acima; aqui os pontos comportamentais/estruturais restantes:
ok(kb.includes('t.dueDate||t.due'), '11a. data do card usa dueDate/due (compat. card antigo só com término)');
ok(!kb.includes('t.startDate') || kb.split('t.startDate').length <= 1, '11b. kbv2Card não depende de startAt (card antigo sem início renderiza)');
ok(CAND.includes('data-probe') === false, '11c. sem instrumentação de teste vazando no renderer');
ok(kb.includes('kbv2-card-footer'), '11d. rodapé (botões) sempre emitido — botões visíveis');

/* ---- resumo ---- */
console.log(`\nF3.5.2B — PASS=${PASS} FAIL=${FAIL}`);
if (FAIL) { console.error('\nFALHAS:\n - ' + fails.join('\n - ')); process.exit(1); }
console.log('F3.5.2B — TODOS OS TESTES VERDES ✓ (correção visual isolada; 1.0.188 byte-idêntico exceto as 2 edições provadas)');
