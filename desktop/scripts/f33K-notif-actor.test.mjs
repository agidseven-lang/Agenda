#!/usr/bin/env node
/* F3.3.17-R1 — CONTRATO de AUTORIA da notificação de atribuição (designer_assigned).
 * READ-ONLY sobre 3 arquivos: extrai e EXECUTA as expressões REAIS de
 *   - index.html  → objeto `assignment` (write path: denormaliza ator)
 *   - notifier.ts → mapeamento actor/responsible do evento designer_assigned (NÃO altera)
 *   - bgnotify.html → primName/primPhoto + linha "Responsável" (NÃO altera)
 * Prova: ator = Social (foto+nome no topo), responsável = Designer (abaixo). E REPRODUZ o bug
 * no estado antigo (sem assignedByName/assignedByAvatar → designer aparece como autor).
 * Rodar: /opt/node22/bin/node desktop/scripts/f33K-notif-actor.test.mjs */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const HTML = R('src/renderer/index.html');
const NOTIFIER = R('src/main/notifier.ts');
const BG = R('src/renderer/bgnotify.html');

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; } else { fail++; console.log('FAIL:', n); } };
const eq = (n, a, b) => ok(n + ' (=' + JSON.stringify(a) + ')', a === b);

/* ---------- helpers de extração ---------- */
function braceObjAfter(text, marker) {
  const a = text.indexOf(marker); if (a < 0) throw new Error('marker ' + marker);
  const s = text.indexOf('{', a); let d = 0;
  for (let j = s; j < text.length; j++) { const c = text[j]; if (c === '{') d++; else if (c === '}') { d--; if (!d) return text.slice(s, j + 1); } }
  throw new Error('unbalanced ' + marker);
}
// captura o RHS de "key: <expr>," dentro de uma LINHA específica (âncora única)
function rhsOnLine(text, anchor, key) {
  const line = text.split('\n').find(l => l.includes(anchor) && l.includes(key + ':'));
  if (!line) throw new Error('linha não achada: ' + anchor + ' / ' + key);
  const m = line.match(new RegExp(key + ':\\s*([^,]+?)\\s*,'));
  if (!m) throw new Error('rhs não achado: ' + key);
  return m[1].trim();
}
function rhsAfter(text, marker, stop) { // captura "<marker><expr><stop>"
  const a = text.indexOf(marker); if (a < 0) throw new Error('marker ' + marker);
  const s = a + marker.length; const e = text.indexOf(stop, s);
  return text.slice(s, e).trim();
}

/* ================= 1) WRITE PATH (index.html) ================= */
const assignSrc = braceObjAfter(HTML, 'const assignment=');
ok('write: assignment contém assignedByName', /assignedByName\s*:\s*u\.name/.test(assignSrc));
ok('write: assignment contém assignedByAvatar', /assignedByAvatar\s*:\s*u\.photo\s*\|\|\s*u\.avatar/.test(assignSrc));
// EXECUTA o objeto literal real com atores fictícios
const buildAssignment = new Function('designerId', 'd', 'u', 'now', 'dl', 'return (' + assignSrc + ');');
const SM = { id: 'sm1', name: 'Arydyjany Carlôto', photo: 'social.png' };
const DZ = { id: 'dz1', name: 'Miercohévisk', photo: 'designer.png' };
const assignment = buildAssignment('dz1', DZ, SM, 1700000000000, {});
eq('write: assignment.assignedByName = Social', assignment.assignedByName, 'Arydyjany Carlôto');
eq('write: assignment.assignedByAvatar = Social photo', assignment.assignedByAvatar, 'social.png');
eq('write: assignment.designerName = Designer', assignment.designerName, 'Miercohévisk');
eq('write: assignment.designerAvatar = Designer photo', assignment.designerAvatar, 'designer.png');
eq('write: assignment.assignedBy = Social id', assignment.assignedBy, 'sm1');

/* ============ 2) MAPEAMENTO notifier.ts (designer_assigned) ============ */
// expressões REAIS extraídas (âncoras: linha do actorId / linha do responsibleId)
const byNameExpr = rhsAfter(NOTIFIER, 'const byName =', ';');                 // da.assignedByName || ""
const actorAvatarExpr = rhsOnLine(NOTIFIER, 'da.assignedBy', 'actorAvatar');  // da.assignedByAvatar || da.assignedByPhoto || ""
const respNameExpr = rhsOnLine(NOTIFIER, 'da.designerId', 'responsibleName'); // da.designerName || ""
const respAvatarExpr = rhsOnLine(NOTIFIER, 'da.designerId', 'responsibleAvatar'); // da.designerAvatar || da.designerPhoto || ""
ok('notifier: actorName usa byName', /actorName:\s*byName/.test(NOTIFIER));
ok('notifier: byName = da.assignedByName', /assignedByName/.test(byNameExpr));
ok('notifier: actorAvatar = da.assignedByAvatar', /assignedByAvatar/.test(actorAvatarExpr));
const mapNotifier = (da) => {
  const byName = new Function('da', 'return (' + byNameExpr + ');')(da);
  return {
    actorName: byName,
    actorAvatar: new Function('da', 'return (' + actorAvatarExpr + ');')(da),
    responsibleName: new Function('da', 'return (' + respNameExpr + ');')(da),
    responsibleAvatar: new Function('da', 'return (' + respAvatarExpr + ');')(da),
  };
};
// payload a partir do assignment REAL gerado no passo 1
const payFix = mapNotifier(assignment);
eq('notifier: actorName = Social', payFix.actorName, 'Arydyjany Carlôto');
eq('notifier: actorAvatar = Social photo', payFix.actorAvatar, 'social.png');
eq('notifier: responsibleName = Designer', payFix.responsibleName, 'Miercohévisk');
eq('notifier: responsibleAvatar = Designer photo', payFix.responsibleAvatar, 'designer.png');

/* ============ 3) RENDER bgnotify.html (primName/primPhoto/Responsável) ============ */
const primNameExpr = rhsAfter(BG, 'var primName=', ';');   // isSla?(...):(p.actorName||p.responsibleName||'')
const primPhotoExpr = rhsAfter(BG, 'var primPhoto=', ';');
ok('bg: primName prefere actorName', /p\.actorName\|\|p\.responsibleName/.test(primNameExpr.replace(/\s/g, '')));
ok('bg: respRow condicionado a responsibleName!==primName', /p\.responsibleName!==primName/.test(BG.replace(/\s/g, '')));
const render = (p) => {
  const isSla = false;
  const primName = new Function('p', 'isSla', 'return (' + primNameExpr + ');')(p, isSla);
  const primPhoto = new Function('p', 'isSla', 'return (' + primPhotoExpr + ');')(p, isSla);
  const respShown = !isSla && !!p.responsibleName && p.responsibleName !== primName;
  return { primName, primPhoto, respShown };
};
const eventType = 'designer_assigned';
const rFix = render(Object.assign({ eventType }, payFix));
eq('render: topo (autor) = Social', rFix.primName, 'Arydyjany Carlôto');
eq('render: foto principal = Social', rFix.primPhoto, 'social.png');
ok('render: linha "Responsável: Designer" aparece abaixo', rFix.respShown === true);
ok('render: Designer NÃO é o autor', rFix.primName !== 'Miercohévisk');

/* ============ 4) REPRODUÇÃO DO BUG (estado antigo, sem os campos) ============ */
const daOld = { assignedBy: 'sm1', designerId: 'dz1', designerName: 'Miercohévisk', designerAvatar: 'designer.png' };
const payOld = mapNotifier(daOld);
eq('bug: actorName vazio sem assignedByName', payOld.actorName, '');
eq('bug: actorAvatar vazio sem assignedByAvatar', payOld.actorAvatar, '');
const rOld = render(Object.assign({ eventType }, payOld));
eq('bug: SEM correção, topo cai no Designer (autor errado)', rOld.primName, 'Miercohévisk');
ok('bug: SEM correção, linha "Responsável" some (suprimida)', rOld.respShown === false);
// contraste: a correção inverte exatamente esse comportamento
ok('fix vs bug: correção move o autor de Designer→Social', rOld.primName === 'Miercohévisk' && rFix.primName === 'Arydyjany Carlôto');

console.log('\nF3.3.17-R1 NOTIF ACTOR: ' + pass + ' PASS / ' + fail + ' FAIL');
if (fail) { console.error('::error:: contrato de autoria da notificação divergiu'); process.exit(1); }
console.log('OK — ator=Social (topo+foto), responsável=Designer (abaixo); bug reproduzido no estado antigo; notifier.ts/bgnotify.html intactos.');
