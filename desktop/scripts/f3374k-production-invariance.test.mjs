#!/usr/bin/env node
/* =====================================================================
   F3.3.74K — GATE DE INVARIÂNCIA FUNCIONAL (candidata de produção; F3.3.77B: 1.0.177).
   Prova que a candidata difere da fonte funcional fisicamente APROVADA (F3.3.77B:
   1.0.177-QA.4, commit 960d8ed) SOMENTE em empacotamento: versão e remoção do banner QA.
   NENHUMA função funcional aprovada pode divergir. Fail-closed.
   (Rebase de baseline por fase via QA_BASELINE_SHA; default = fonte QA aprovada da fase corrente.)

   Baseline lido via `git show 960d8ed:<arquivo>` (funciona local e no CI
   com fetch-depth 0). Sem rede, sem build, sem escrita.
   ===================================================================== */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');            // desktop/
const QA_SHA = process.env.QA_BASELINE_SHA || '960d8ed';   // F3.3.77B: fonte QA fisicamente aprovada (1.0.177-QA.4)

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.error('  FAIL — ' + n); } };
const baseline = (rel) => execSync(`git show ${QA_SHA}:desktop/${rel}`, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
const current = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// extrai `function <name>(...) { ... }` por chaves balanceadas
function fnSrc(SRC, name) {
  const m = SRC.match(new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\('));
  if (!m) return null;
  const st = SRC.indexOf(m[0]); let d = 0;
  for (let j = SRC.indexOf('{', st); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{') d++; else if (c === '}') { d--; if (!d) return SRC.slice(st, j + 1); }
  }
  return null;
}

console.log(`F3.3.74K — invariância funcional (candidata 1.0.177 vs QA ${QA_SHA})`);

const qaHtml = baseline('src/renderer/index.html');
const cuHtml = current('src/renderer/index.html');

// 1) A ÚNICA diferença no renderer é a remoção da linha do banner QA.
const qaLines = qaHtml.split('\n');
const bannerIdx = qaLines.findIndex((l) => l.includes('banner permanente de QA') && l.includes('AMBIENTE QA'));
ok('K1 baseline QA contém exatamente 1 linha de banner QA', bannerIdx >= 0 && qaLines.filter((l) => l.includes('AMBIENTE QA')).length === 1);
const qaMinusBanner = qaLines.filter((_, i) => i !== bannerIdx).join('\n');
ok('K2 renderer da candidata === baseline QA SEM a linha do banner (nenhuma outra mudança)', qaMinusBanner === cuHtml);
ok('K3 candidata SEM "AMBIENTE QA" / "NÃO USAR COM CLIENTES" / "banner permanente de QA"',
  !cuHtml.includes('AMBIENTE QA') && !cuHtml.includes('NÃO USAR COM CLIENTES') && !cuHtml.includes('banner permanente de QA'));

// 2) Funções funcionais aprovadas — byte-idênticas entre QA e candidata.
const FUNCS = ['buildClientMessage', 'buildShareClientUrl', 'ensureReviewToken', 'copyMsgClean',
  'openWhatsAppWebOnly', 'persistClientSend', 'runPrewarm', 'withWhatsAppPreviewBust', 'validateShareUrl'];
for (const fn of FUNCS) {
  const a = fnSrc(qaHtml, fn), b = fnSrc(cuHtml, fn);
  if (a === null && b === null) { ok(`K-fn ${fn} (ausente em ambos — n/a)`, true); continue; }
  ok(`K-fn ${fn} byte-idêntica QA×candidata` + (a && b && a === b ? '' : ' [DIVERGE/ausente]'), a !== null && b !== null && a === b);
}

// 3) Blocos-chave do contrato restaurado presentes e intactos (mesma âncora do gate de build).
for (const anchor of [
  'Acesse o link abaixo para revisar os temas, aprovar ou solicitar ajustes:',
  'https://aprovar.agendaidseven.com.br',
  '/share/cronograma/',
  "return CLIENT_LINK_BASE+'/share/cronograma/'+t;",
  'F3.3.74D — CONTRATO RESTAURADO',
]) ok(`K-anchor presente: ${anchor.slice(0, 48)}`, cuHtml.includes(anchor));

// 4) Regressões que NÃO podem reaparecer no caminho principal (74E-1..12).
ok('K-reg botão NÃO nasce disabled', !cuHtml.includes('id="btnOpenWaMain" disabled'));
ok('K-reg sem gate prepReady no clique', !cuHtml.includes('if(!prepReady){ flashToast'));
ok('K-reg prewarm não desabilita o botão', !cuHtml.includes("$('btnOpenWaMain'); if(b){ b.disabled=true; }"));
ok('K-reg falha de prewarm não aborta envio', !cuHtml.includes('if(!_pw||!_pw.ok){ flashToast'));
ok('K-reg cache-bust fora do envio', !cuHtml.includes('withWhatsAppPreviewBust(buildShareClientUrl') && !cuHtml.includes('url=withWhatsAppPreviewBust('));
ok('K-reg native-share fora do caminho principal', !cuHtml.includes('nativeShare'));
ok('K-reg Windows Share UI fora', !cuHtml.includes('buildNativeShareRequest'));
ok('K-reg Canvas/PNG nativo fora', !cuHtml.includes('buildPremiumCardImage') && !cuHtml.includes('CARD_ART_B64_BY_TYPE'));

// 5) Processo principal byte-idêntico ao QA (nenhuma mudança de processo). F3.3.77B: inclui os
//    módulos do relógio canônico (clockSync) e o produtor único (notifier), além de bgNotify/firebase/auth-core.
for (const rel of ['src/main/main.ts', 'src/preload/preload.ts', 'src/main/clockSync.ts',
  'src/main/notifier.ts', 'src/main/bgNotify.ts', 'src/main/firebase.ts', 'src/main/auth-core.ts']) {
  ok(`K-proc ${rel} byte-idêntico ao QA`, baseline(rel) === current(rel));
}

// 6) package.json difere SOMENTE na versão; electron-builder.yml intacto.
{
  const qa = JSON.parse(baseline('package.json')), cu = JSON.parse(current('package.json'));
  ok('K-pkg versão QA=1.0.177-QA.4 → candidata=1.0.177', qa.version === '1.0.177-QA.4' && cu.version === '1.0.177');
  const qb = { ...qa, version: null }, cb = { ...cu, version: null };
  ok('K-pkg package.json idêntico exceto version', JSON.stringify(qb) === JSON.stringify(cb));
  ok('K-builder electron-builder.yml byte-idêntico ao QA', baseline('electron-builder.yml') === current('electron-builder.yml'));
}

console.log(`\n74K-invariance: PASS=${pass} FAIL=${fail}`);
process.exit(fail ? 1 : 0);
