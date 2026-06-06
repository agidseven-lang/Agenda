#!/usr/bin/env node
/* Gera um PREVIEW HTML (abrível no navegador) usando o CSS REAL do renderer + o markup REAL
 * de boardToolbar() (busca + chips). Mostra ANTES (errado: chips no topo global) x DEPOIS
 * (certo: chips na toolbar do quadro, ao lado da busca, abaixo do título). Prova visual de layout.
 * Uso: node desktop/scripts/gen-toolbar-preview.js  -> escreve desktop/scripts/board-toolbar-preview.html */
'use strict';
const fs = require('fs');
const path = require('path');
const SRC = path.resolve(__dirname, '..', 'src', 'renderer', 'index.html');
const html = fs.readFileSync(SRC, 'utf8');
const style = (html.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];

// dot-icon mínimo só para o preview (a posição é o que importa, não o desenho do ícone)
const ic = '<svg viewBox="0 0 24 24" width="15" height="15"><circle cx="12" cy="12" r="7" fill="currentColor"/></svg>';
const CHIPS = [['Meu quadro', true], ['Cliente', false], ['Designers', false], ['Social Medias', false], ['Setores', false]];
function chips() {
  return CHIPS.map(([l, on]) => '<button class="tchip' + (on ? ' on' : '') + '">' + ic + '<span>' + l + '</span></button>').join('');
}
// markup REAL de boardToolbar() (busca + chips na mesma moldura)
function boardToolbar() {
  return '<div class="d-board-tools tbar"><input class="inp bsearch" placeholder="Buscar tarefa…"><div class="tchips">' + chips() + '</div></div>';
}
function header(title, sub) {
  return '<div class="scr-head"><div class="row"><div style="flex:1"><div class="h-title">' + title + '</div><div class="h-sub">' + sub + '</div></div><span class="badge-round">3 tarefas</span></div></div>';
}
function fakeCards() {
  return '<div class="scr"><div class="d-hub">' +
    '<div class="bcard"><div class="bm"><div class="bl">Conteúdo / Cronograma</div><div class="bd">Gestão por setor</div></div></div>' +
    '<div class="bcard"><div class="bm"><div class="bl">Edição de Mídia</div><div class="bd">Cortes e finalização</div></div></div>' +
    '</div></div>';
}
// ANTES (errado): chips no topo global, ACIMA do título
function wrong() {
  return '<div class="tflow-tabs tflow-chipbar" style="border-bottom:1px solid var(--line);padding:14px 20px">' + chips() + '</div>' +
    header('Quadros', 'Gestão por setor da agência') + fakeCards();
}
// DEPOIS (certo): título, depois toolbar (busca + chips), depois cards
function right() {
  return header('Quadros', 'Gestão por setor da agência') + boardToolbar() + fakeCards();
}
function panel(label, inner) {
  return '<div style="margin:18px 0"><div style="font:700 13px system-ui;color:#9aa0aa;margin:0 0 8px">' + label + '</div>' +
    '<div class="content" style="border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--bg)">' + inner + '</div></div>';
}
const out =
  '<!doctype html><html><head><meta charset="utf-8"><title>Preview · toolbar dos quadros 1.0.106</title>' +
  '<style>' + style + '\nbody{padding:24px;max-width:1100px;margin:0 auto}</style></head>' +
  '<body class="desktop">' +
  '<h1 style="font:800 20px system-ui;color:var(--ink)">Agenda ID Seven · prova de layout dos chips (Desktop 1.0.106)</h1>' +
  panel('❌ ANTES (reprovado) — chips no topo global, ACIMA do título “Quadros”', wrong()) +
  panel('✅ DEPOIS (1.0.106) — título primeiro; busca + chips juntos na toolbar do quadro', right()) +
  '</body></html>';
const DST = path.join(__dirname, 'board-toolbar-preview.html');
fs.writeFileSync(DST, out);
console.log('Preview gerado:', DST, '(' + out.length + ' bytes)');
