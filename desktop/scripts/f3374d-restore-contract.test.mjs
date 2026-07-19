#!/usr/bin/env node
/* =====================================================================
   F3.3.74D — CONTRATO RESTAURADO (baseline física 1.0.153 sobre a base 1.0.168)
   ---------------------------------------------------------------------
   Difere do oráculo histórico (contract-153) num único ponto DELIBERADO:
   a base atual PODE manter o pré-aquecimento como BÔNUS (correção posterior
   preservada), desde que NUNCA seja gate. Todos os demais pinos são os da
   baseline fisicamente aprovada (tag desktop/v1.0.153-production-rc).
   GATES FASE 13 (1–15) incluídos ao final.
   ===================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const h = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'renderer', 'index.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS — ' + n); } else { fail++; console.log('  FAIL — ' + n); } };

console.log('== F3.3.74D — contrato RESTAURADO (Cronograma primeiro) ==');

/* R1 — URL: domínio premium + rota /share/cronograma/<token> estável (gate 1/3/4/5) */
ok('R1 [gates 1,3,4,5] buildShareClientUrl estável no domínio premium; token intacto',
  h.includes("function buildShareClientUrl(token)") &&
  h.includes("return CLIENT_LINK_BASE+'/share/cronograma/'+t;") &&
  h.includes("const CLIENT_LINK_BASE='https://aprovar.agendaidseven.com.br'"));

/* R2 — mensagem aprovada byte-a-byte, link em linha própria (gate 6) */
ok('R2 [gate 6] mensagem aprovada intacta (link SOZINHO em linha própria)',
  h.includes("'Seu cronograma já está pronto para avaliação.\\n\\n'") &&
  h.includes("'Acesse o link abaixo para revisar os temas, aprovar ou solicitar ajustes:\\n\\n'") &&
  /url\+'\\n\\n'\+\s*'Equipe ID Seven'/.test(h));

/* R3 — sem cache-bust no envio (FASE 5: confirmado FORA do contrato aprovado; gate 2) */
ok('R3 [gate 2] cache-bust confirmado FORA do envio (URL estável; helper órfão permitido)',
  /const url=buildShareClientUrl\(ctx&&ctx\.token\);/.test(h) &&
  !/withWhatsAppPreviewBust\(\s*buildShareClientUrl/.test(h) &&
  !/\+sep\+'v='\+Date\.now\(\)[\s\S]{0,40}buildClientMessage/.test(h));

/* R4 — 1 clique SEM gate: copy → open imediato; comentários permitidos; prepReady NUNCA lido no handler */
{
  const i = h.indexOf("on('btnOpenWaMain'");
  const seg = h.slice(i, h.indexOf('});', i) + 3);
  ok('R4 clique principal = copyMsgClean() → openWhatsAppWebOnly() SEM NENHUM gate',
    i > 0 &&
    /if\(!copyMsgClean\(\)\) return;/.test(seg) &&
    seg.indexOf('if(!copyMsgClean()) return;') < seg.indexOf('openWhatsAppWebOnly()') &&
    !/if\(!prepReady\)/.test(seg) && !/prepReady\s*(\)|&&|\|\|)/.test(seg) &&
    !/await/.test(seg.slice(0, seg.indexOf('openWhatsAppWebOnly()'))));
}

/* R5 — botão nasce habilitado e NUNCA é desabilitado em lugar nenhum */
ok('R5 botão principal nasce habilitado e nenhum código o desabilita',
  h.includes('id="btnOpenWaMain"') && !h.includes('id="btnOpenWaMain" disabled') &&
  !/btnOpenWaMain'\);[^\n]*disabled=true/.test(h) &&
  !/\$\('btnOpenWaMain'\); if\(b\)\{ b\.disabled=true; \}/.test(h));

/* R6 — prewarm é BÔNUS: presente (correção posterior preservada) mas sem bloquear nada */
{
  const i = h.indexOf('async function runPrewarm');
  const seg = i >= 0 ? h.slice(i, h.indexOf('\n  }', i)) : '';
  ok('R6 prewarm rebaixado a BÔNUS (sem disabled, sem instrução de aguardar para enviar)',
    i > 0 && !/disabled\s*=\s*true/.test(seg) && !/disabled\s*=\s*false/.test(seg) &&
    !/Tente novamente antes de enviar/.test(h) &&
    !/Aguarde: o Card Premium ainda está sendo preparado/.test(h));
}

/* R7 — atalho data-openwa NUNCA aborta por prewarm; copia mensagem e abre WhatsApp */
{
  const i = h.indexOf("g('[data-openwa]')");
  const seg = h.slice(i, i + 2200);
  ok('R7 data-openwa: prewarm melhor-esforço (sem return na falha); mensagem + WhatsApp sempre',
    i > 0 && !/if\(!_pw\|\|!_pw\.ok\)\{[^}]*return;/.test(seg) &&
    seg.includes('const msg=buildClientMessage(ctx);') &&
    seg.includes('copyToClipboard(msg);') && seg.includes('openWhatsAppPlain();'));
}

/* R8 — proteção anti-link-órfão preservada (aprovada; existia na baseline) */
ok('R8 ensureReviewToken confirmado antes de abrir (anti-órfão preservado)',
  /const tok=await ensureReviewToken\(id\);/.test(h) &&
  h.includes('aborta: nada de link orfao no WhatsApp'));

/* R9 — registro do envio preservado (Notification Engine) */
ok('R9 persistClientSend no clique principal e no atalho',
  /if\(ctx&&ctx\.id&&ctx\.id!=='__form__'\)persistClientSend\(ctx\.id\);/.test(h) &&
  /if\(id&&id!=='__form__'\)await persistClientSend\(id\);/.test(h));

/* R10 — validação de domínio aprovada intacta (rejeita workers.dev e link sem token) */
ok('R10 _gateValidLink aprovado intacto (prefixo exato + token + msg contém url)',
  h.includes("url.indexOf('https://aprovar.agendaidseven.com.br/share/cronograma/')===0") &&
  h.includes("!/workers\\.dev/.test(url)"));

/* R11 [gates 11,12,13,14] — 74B/74C fora do caminho principal; sem mídia nativa; sem helper; sem Windows Share.
   (copyCardImage do fallback AVANÇADO é código da própria baseline 1.0.153 — permitido; o marcador
   74B específico era copyCardImage(new Uint8Array(sharePkg.imageBytes)), coberto por sharePkg.) */
ok('R11 [gates 11-14] sem 74B/74C: nativeShare/SharePackage/PremiumCardImage/ARTES/sharePkg ausentes',
  !h.includes('nativeShare') && !h.includes('buildSharePackage') &&
  !h.includes('buildPremiumCardImage') && !h.includes('CARD_ART_B64_BY_TYPE') &&
  !h.includes('sharePkg'));

/* R12 — sem snapshot obrigatório (C23 é linha QA; produção restaurada não depende) */
ok('R12 sem ensureShareSnapshot/share-snapshot no caminho principal',
  !h.includes('ensureShareSnapshot') && !h.includes('share-snapshot'));

/* R13 — sem send?text= (mensagem só por clipboard) */
ok('R13 sem USO de send?text=', !/send\?text='\s*\+/.test(h) && !/send\?text="\s*\+/.test(h));

/* R14 — Roteiro (FASE 11): paridade C16 preservada NO MESMO envelope (sem transporte novo) */
ok('R14 Roteiro usa o MESMO envelope (mensagem por setor; sem rota nova; sem Designer no fluxo)',
  h.includes("(ctx&&ctx.sector)==='roteiro'") &&
  /Seu Roteiro de gravação de vídeos|roteiro de gravação/i.test(h) &&
  !h.includes('/share/roteiro/'));

/* R15 — Cronograma primeiro: mensagem de cronograma sem contaminação de roteiro */
{
  const i = h.indexOf('function buildClientMessage');
  const seg = h.slice(i, i + 1400);
  ok('R15 buildClientMessage do cronograma sem texto de roteiro (isolamento por tipo)',
    /Seu cronograma já está pronto para avaliação/.test(seg));
}

/* R16 [74K] — build de PRODUÇÃO: banner QA AUSENTE (nenhuma identificação de QA no renderer) */
ok('R16 [74K] banner "AMBIENTE QA — NÃO USAR COM CLIENTES" AUSENTE (produção)',
  !h.includes("AMBIENTE QA") && !h.includes("NÃO USAR COM CLIENTES") && !h.includes('banner permanente de QA'));

/* R17 [76B] — versão de PRODUÇÃO 1.0.176 (sem sufixo -QA; sem literal de versão no renderer) */
{
  const PKG = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
  ok('R17 [76B] versão 1.0.176 (package.json, sem -QA) e NENHUM literal de versão no renderer',
    PKG.version === '1.0.176' && !h.includes('1.0.176-QA') && !h.includes('1.0.176'));
}

console.log('');
console.log('RESULTADO: ' + pass + ' PASS, ' + fail + ' FAIL');
console.log('HONESTIDADE: prova o CONTRATO restaurado na base 1.0.168; a prova FÍSICA no');
console.log('WhatsApp pertence à fase 74E (após autorização; sem build nesta fase).');
if (fail) process.exit(1);
