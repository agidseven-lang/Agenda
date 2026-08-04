// F3.5.5B — AGENDA PREMIUM (Desktop 1.0.219): suíte estática obrigatória.
// A) versão · B) 30 testes obrigatórios dos CARDS · C) 35 testes obrigatórios do MODAL ·
// D) isolamento/congelados/aditivos. Roda contra o fonte real (ou SRC= p/ gate empacotado).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.env.SRC ? path.resolve(process.env.SRC) : path.resolve(__dirname, '..', 'src', 'renderer', 'index.html');
const S = fs.readFileSync(FILE, 'utf8');
const R = f => fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');
let n = 0, fails = 0;
function ok(label, cond) { n++; if (cond) { console.log('  ✓ ' + label); } else { fails++; console.log('  ✗ FALHOU: ' + label); } }
function seg(a, b, name) {
  const i = S.indexOf(a); const j = S.indexOf(b, i + a.length);
  if (i < 0 || j < 0) { console.log('  ✗ ÂNCORA AUSENTE (' + name + '): ' + (i < 0 ? a : b)); fails++; n++; return ''; }
  return S.slice(i, j);
}
const has = (h, s) => h.indexOf(s) >= 0;
const count = (h, s) => h.split(s).length - 1;

const helpers = seg("var DOWFULL=['Domingo'", 'function eventCard(e){', 'helpers');
const card = seg('function eventCard(e){', 'function eventLate(e){', 'card');
const evd = seg('function openEventDetail(id,confirm){', 'function emptyState(', 'modal');
const evdFocus = seg('function evdSetupModalFocus(){', 'function openEventDetail(id,confirm){', 'focus');
const hoje = seg('function renderHoje(){', 'function urgentRow(', 'hoje');
const agenda = seg('function renderAgenda(){', 'function calendarGrid(', 'agenda');
const escH = seg("document.addEventListener('keydown',e=>{if(e.key==='Escape'){", "/* F3.5.5B — cards de compromisso acionáveis por teclado", 'esc');
const kbd = seg("/* F3.5.5B — cards de compromisso acionáveis por teclado", 'async function detClipWrite', 'kbd');
const disp = seg("// F3.5.5B — menu \"Mais opções\" (⋯) do detalhe do compromisso", "if(el=g('[data-agf]')", 'dispatcher');

console.log('— A) versão 1.0.219 —');
const pkg = JSON.parse(R('package.json'));
ok('A1 package.json 1.0.219 + description premium-agenda-redesign', pkg.version === '1.0.219' && /1\.0\.219-premium-agenda-redesign/.test(pkg.description || ''));
ok('A2 package-lock 1.0.219', JSON.parse(R('package-lock.json')).version === '1.0.219');
ok('A3 lock packages[""] 1.0.219', JSON.parse(R('package-lock.json')).packages[''].version === '1.0.219');

console.log('— B) CARDS (30 obrigatórios) —');
ok('B1 agendado: chip de status renderizado p/ TODO estado (evStatusMeta sem gate parcial no card)', has(card, 'const st=evStatus(e);const sm=evStatusMeta(st);') && has(card, '"evc2-st"') && !has(card, "st==='in_progress'||st==='completed'"));
ok('B2 em andamento: evStatusMeta {Em andamento,#F59E0B} preservado', has(S, "st==='in_progress'?{label:'Em andamento',color:'#F59E0B'}"));
ok('B3 finalizado: evStatusMeta {Finalizado,#34D399} preservado', has(S, "st==='completed'?{label:'Finalizado',color:'#34D399'}"));
ok('B4 cancelado: evStatusMeta {Cancelado,#F87171} + toggle "Mostrar cancelados" preservado', has(S, "st==='cancelled'?{label:'Cancelado',color:'#F87171'}") && has(agenda, 'Mostrar cancelados'));
ok('B5 data atual: filtro de hoje intacto (date===td, sem done/cancelado)', has(hoje, "const todays=state.events.filter(e=>e.date===td&&!e.done&&!isEvCancelled(e)).sort((a,b)=>(a.start||'').localeCompare(b.start||''));"));
ok('B6 data futura: Próximos compromissos intacto (date>td + slice(0,5))', has(hoje, "const future=state.events.filter(e=>e.date>td&&!e.done&&!isEvCancelled(e)).sort((a,b)=>((a.date||'')+(a.start||'')).localeCompare((b.date||'')+(b.start||''))).slice(0,5);"));
ok('B7 data passada: eventLate byte-idêntico + trilho vermelho no atraso', has(S, "function eventLate(e){if(e.done)return false;const ms=dtMs(e.date,e.end||e.start||'23:59');return ms&&Date.now()>ms;}") && has(card, "late?'#F87171'"));
ok('B8 sem término: end só quando válido; nenhum 00:00 inventado no card', has(card, "const t2=evTimeOk(e.end)?e.end:'';") && has(card, "(t2?'<span class=\"evc2-te\">— '+esc(t2)+'</span>':'')") && !has(card, "'00:00'"));
ok('B9 com término: faixa início—término (evc2-te) presente', has(card, 'evc2-te'));
ok('B10 duração curta: evDurationText em minutos ("X minutos")', has(helpers, "if(!h)return r+(r===1?' minuto':' minutos');"));
ok('B11 duração longa: horas+minutos compostos ("X horas e Y minutos")', has(helpers, "return r?hs+' e '+r+(r===1?' minuto':' minutos'):hs;"));
ok('B12 título curto: evc2-ti com esc()', has(card, '"evc2-ti">\'+esc(e.title||\'Sem título\')'));
ok('B13 título longo: máx 2 linhas com ellipsis (line-clamp:2) e quebra segura', has(S, '.evc .evc2-ti{') && has(S, '-webkit-line-clamp:2') && /\.evc \.evc2-ti\{[^}]*overflow-wrap:anywhere/.test(S));
ok('B14 cliente curto: linha meta opcional com ícone person', has(card, "(e.client?'<div class=\"evc2-meta\">'+svg('person')+'<span>'+esc(e.client)+'</span></div>':'')"));
ok('B15 cliente longo: ellipsis de 1 linha na meta', /\.evc \.evc2-meta span\{[^}]*text-overflow:ellipsis/.test(S));
ok('B16 local curto: linha meta opcional com ícone place', has(card, "(e.location?'<div class=\"evc2-meta\">'+svg('place')+'<span>'+esc(e.location)+'</span></div>':'')"));
ok('B17 local longo: mesma proteção de overflow (nowrap+hidden+ellipsis)', /\.evc \.evc2-meta span\{[^}]*white-space:nowrap;overflow:hidden;text-overflow:ellipsis/.test(S));
ok('B18 com responsável: rodapé avatar+nome 1× (sem repetição)', has(card, "avatar(owner,20)+'<span class=\"evc2-name\">'") && count(card, 'evc2-name') === 1);
ok('B19 sem responsável: rodapé omite avatar/nome e trilho fica neutro', has(card, 'const hasOwner=!!(((owner&&owner.name)||\'\').trim()||(owner&&owner.id));') && has(card, "(col||'var(--line)')"));
ok('B20 com avatar: usa avatar() real (foto quando houver)', has(card, 'avatar(owner,20)'));
ok('B21 sem avatar: fallback de iniciais do avatar() preservado', has(S, "return '<div class=\"av\" style=\"'+st+';background:'+col+'\">'+esc(initials(u&&u.name).toUpperCase())+'</div>';"));
ok('B22 muitos compromissos: Hoje limita futuros a 5; Agenda sem corte novo', has(hoje, '.slice(0,5)') && !has(agenda, 'slice(0,5)'));
ok('B23 nenhum compromisso: estados vazios preservados', has(hoje, 'Nada agendado para hoje.') && has(hoje, 'Nenhum compromisso futuro agendado.') && has(agenda, "emptyState('calendar','Dia livre','Nenhum compromisso para esta data.')"));
ok('B24 clique: contrato data-evdetail preservado no card e no dispatcher', has(card, "data-evdetail=\"'+e.id+'\"") && has(S, "if(el=g('[data-evdetail]')){openEventDetail(el.dataset.evdetail);return;}"));
ok('B25 teclado: role=button + tabindex=0 + aria-label + Enter/Espaço abre', has(card, 'role="button" tabindex="0" aria-label="') && has(kbd, "if(e.key!=='Enter'&&e.key!==' ')return;") && has(kbd, ".matches('.evc[data-evdetail]')") && has(kbd, 'openEventDetail(t.getAttribute'));
ok('B26 escalas 100/125/150: sem altura fixa que corte o card (validação visual nas provas)', !/\.evc\{[^}]*[^-]height:/.test(S) && !/\.evc\{[^}]*max-height/.test(S));
ok('B27 1366×768: grid d-home 2 colunas preservado', has(S, 'body.desktop .d-home{display:grid;grid-template-columns:1.4fr 1fr;gap:24px;align-items:start}'));
ok('B28 1920×1080: grid d-home 3 colunas (≥1360px) preservado', has(S, 'body.desktop .d-home{grid-template-columns:1fr 1fr 1fr}'));
ok('B29 nenhum corte: min-width:0 no corpo do card', /\.evc \.evc2-main\{[^}]*min-width:0/.test(S));
ok('B30 DATA SEMPRE VISÍVEL: bloco DOM/dia/mês derivado de e.date por parse LOCAL manual', has(card, '"evc2-date"') && has(card, 'DOW[dp.dow]') && has(card, 'MONTHS[dp.m-1].slice(0,3).toUpperCase()') && has(helpers, "var p=date.split('-').map(Number);var dt=new Date(p[0],p[1]-1,p[2]);") && has(helpers, "/^\\d{4}-\\d{2}-\\d{2}$/.test(date||'')"));

console.log('— C) MODAL (35 obrigatórios) —');
ok('C1 abre o compromisso correto (lookup por id preservado)', has(evd, 'const e=state.events.find(x=>x.id===id);if(!e)return;'));
ok('C2 data completa pt-BR (dia da semana + por extenso; NUNCA e.date bruto no detalhe)', has(evd, 'evDowFull(e.date)') && has(evd, 'evDateFull(e.date)') && !/\+e\.date\+/.test(evd) && has(helpers, "return dp.d+' de '+MONTHS[dp.m-1].toLowerCase()+' de '+dp.y;"));
ok('C3 horário inicial em destaque (evd-time)', has(evd, '"evd-time">\'+svg(\'clock\')+esc(t1)'));
ok('C4 horário final secundário; ausente ⇒ só início; sem 00:00 inventado', has(evd, "(t2?'<span class=\"evd-te\">— '+esc(t2)+'</span>':'')") && !has(evd, "'00:00'"));
ok('C4b duração SÓ quando calculável (end>start; senão omitida)', has(helpers, 'if(!(min>0))return \'\';') && has(evd, "(dur?'<div class=\"evd-dur\">Duração: '+esc(dur)+'</div>':'')"));
ok('C5 cliente no cabeçalho e no resumo', has(evd, '"evd-client"') && has(evd, "cell('person','Cliente'"));
ok('C6 local no resumo com ícone', has(evd, "cell('place','Local'"));
ok('C7 responsável com avatar no resumo', has(evd, '<div class="evd-cl">Responsável</div><div class="evd-cv">\'+avatar(owner,20)'));
ok('C8 criado por (lookup preservado)', has(evd, "cell('','Criado por',(creator&&creator.name)?esc(creator.name):'')") && has(evd, 'const creator=state.users.find(u=>u.id===e.by);'));
ok('C9 observações: seção própria, parágrafos preservados (pre-wrap), sempre esc()', has(evd, "'<div class=\"evd-sec\">Observações</div><div class=\"evd-notes\">'+esc(e.notes)+'</div>'") && /\.evd-notes\{[^}]*white-space:pre-wrap/.test(S));
ok('C10 sem observações: nenhuma caixa vazia', has(evd, "const notes=(e.notes&&String(e.notes).trim())?"));
ok('C11 Editar preservado (gate st!==cancelled)', has(evd, "if(st!=='cancelled')acts+='<button type=\"button\" class=\"evd-btn sec\" data-evedit=\"'+e.id+'\">'"));
ok('C12 Iniciar = ação PRIMÁRIA no agendado', has(evd, "if(st==='scheduled')acts+='<button type=\"button\" class=\"evd-btn pri\" data-evstart=\"'+e.id+'\">'"));
ok('C13 Finalizar: primária em andamento + menu ⋯ no agendado (mesmo data-evfinish)', has(evd, "else if(st==='in_progress')acts+='<button type=\"button\" class=\"evd-btn pri\" data-evfinish=\"'+e.id+'\">'") && has(evd, "if(st==='scheduled')more.push('<button type=\"button\" class=\"evd-mi\" role=\"menuitem\" data-evfinish=\"'+e.id+'\">'"));
ok('C14 Cancelar: secundária destrutiva sutil + confirmação preservada', has(evd, "if(st==='scheduled'||st==='in_progress')acts+='<button type=\"button\" class=\"evd-btn danger-sec\" data-evcancel=\"'+e.id+'\">'") && has(evd, 'data-evcancelyes="\'+e.id+\'"') && has(evd, 'Ele sai da agenda ativa para toda a equipe (não é apagado).'));
ok('C15 Excluir definitivamente: SÓ admin, dentro do menu ⋯, confirmação EXCLUIR intacta', has(evd, "if(isAdmin)more.push('<button type=\"button\" class=\"evd-mi danger\" role=\"menuitem\" data-evdelete=\"'+e.id+'\">'") && has(evd, 'id="evDelConfirm"') && has(evd, 'id="evDelErr"') && has(evd, 'Para confirmar, digite EXCLUIR') && has(evd, 'data-evdeleteyes="\'+e.id+\'"'));
ok('C16 Fechar: X isolado no cabeçalho + Fechar discreto só sem ação primária', has(evd, 'class="evd-x" data-modalclose="1" aria-label="Fechar detalhes"') && has(evd, "else acts+='<button type=\"button\" class=\"evd-btn sec push\" data-modalclose=\"1\">Fechar</button>';"));
ok('C17 Esc: fecha o detalhe; em confirmação volta (não descarta o modal); menu fecha antes', has(escH, ".modal-back[data-evdmodal]") && has(escH, "[data-evcancelyes],[data-evdeleteyes]") && has(escH, "openEventDetail(_eb.getAttribute('data-evdmodal'))") && has(escH, 'else{closeModal();}'));
ok('C18 focus trap: evdSetupModalFocus definido (Tab/Shift+Tab) e chamado após render', has(evdFocus, "if(ev.key!=='Tab')return;") && has(evdFocus, 'last.focus()') && has(evd, 'evdSetupModalFocus();'));
ok('C19 retorno de foco: captura do elemento de origem só na 1ª abertura', has(evd, "if(!document.querySelector('.modal-back[data-evdmodal]')){_detReturnEl=(document.activeElement&&document.activeElement!==document.body)?document.activeElement:null;}") && has(S, 'var _r=_detReturnEl;_detReturnEl=null;if(_r&&_r.focus)'));
ok('C20 permissão Admin: isAdmin idêntico à 1.0.218', has(evd, 'const isAdmin=!!(state.user&&state.user.admin);'));
ok('C21 permissão permitida: menu ⋯ aparece quando há itens', has(evd, "if(more.length)acts+='<button type=\"button\" class=\"evd-btn more\" data-evmore=\"1\""));
ok('C22 permissão negada: nenhuma ação indisponível exibida (⋯ omitido se vazio; sem disabled falso)', has(evd, 'var more=[];') && !has(evd, 'disabled'));
ok('C23 agendado: Iniciar(pri)+Editar+Cancelar+menu[Finalizar(+Excluir se admin)]', has(evd, "if(st==='scheduled')more.push") && has(evd, "if(st==='scheduled')acts+="));
ok('C24 em andamento: Finalizar(pri)+Editar+Cancelar(+Excluir admin no menu)', has(evd, "else if(st==='in_progress')acts+="));
ok('C25 finalizado: Editar + Fechar (sem lifecycle indevido)', has(evd, "if(st!=='cancelled')acts+=") && has(evd, "else acts+='<button type=\"button\" class=\"evd-btn sec push\" data-modalclose=\"1\">Fechar</button>';"));
ok('C26 cancelado: sem Editar/Iniciar/Finalizar/Cancelar; Excluir só admin; linha do tempo com Cancelado', has(evd, "if(st==='cancelled'&&e.cancelledAt)tl+=") && has(evd, "evActorName(e.cancelledBy)"));
ok('C27 título longo: overflow-wrap no evd-title', /\.evd-title\{[^}]*overflow-wrap:anywhere/.test(S));
ok('C28 local longo: valores do grid com quebra segura', /\.evd-cv span\{[^}]*overflow-wrap:anywhere/.test(S));
ok('C29 escala 125%: sheet rolável com teto (max-height + overflow-y)', /body\.desktop \.sheet\.evd-sheet\{[^}]*max-height:calc\(100vh - 48px\)/.test(S));
ok('C30 escala 150%: largura fluida min(560px, 100vw-48px)', has(S, 'width:min(560px,calc(100vw - 48px))'));
ok('C31 NENHUMA ação perdida: os 6 verbos + confirmações + Voltar presentes', ['data-evedit','data-evstart','data-evfinish','data-evcancel="','data-evdelete="','data-modalclose','data-evcancelyes','data-evdeleteyes'].every(a => has(evd, a)) && count(evd, "data-evdetail=\"'+e.id+'\">Voltar<") === 2);
ok('C32 NENHUMA ação duplicada: contagens exatas por atributo', count(evd, 'data-evstart="') === 1 && count(evd, 'data-evfinish="') === 2 && count(evd, 'data-evcancel="') === 1 && count(evd, 'data-evedit="') === 1 && count(evd, 'data-evdelete="') === 1 && count(evd, 'data-evcancelyes="') === 1 && count(evd, 'data-evdeleteyes="') === 1);
ok('C33 NENHUMA regra alterada: funções de negócio byte-idênticas', has(S, "function evStatus(e){if(!e)return 'scheduled';if(e.status==='cancelled'||e.cancelledAt)return 'cancelled';if(e.done===true)return 'completed';if(+e.startedAt>0)return 'in_progress';return 'scheduled';}") && has(S, 'function evStart(id){evLifecycle(id,{startedAt:Date.now(),startedBy:state.user.id});}') && has(S, 'function evFinish(id){evLifecycle(id,{done:true,doneAt:Date.now(),doneBy:state.user.id});}') && has(S, "function evCancel(id){evLifecycle(id,{status:'cancelled',cancelledAt:Date.now(),cancelledBy:state.user.id});}") && has(S, "if(!i||i.value.trim()!=='EXCLUIR'){if(er){er.textContent='Digite EXCLUIR (em maiúsculas) para confirmar.';er.style.display='block';}return;}") && has(S, "await db.collection('events').doc(id).update({deletedBy:state.user.id,deletedAt:Date.now()});"));
ok('C33b evLifecycle/evDeletePermanent: mesmo patch/fluxo; único aditivo _evdErr no catch', has(S, "try{await db.collection('events').doc(id).update(patch);evEditId=null;closeModal();render();}\n  catch(e){console.warn('evLifecycle',e);_evdErr='1';try{openEventDetail(id);}catch(_){}}") && has(S, "catch(e){console.warn('evDeletePermanent',e);_evdErr='1';try{openEventDetail(id);}catch(_){}}") && count(S, "_evdErr='1'") === 2);
ok('C34 NENHUMA atividade falsa: card/modal não escrevem no banco', !has(card, 'db.collection') && !has(evd, 'db.collection') && !has(evd, 'FieldValue'));
ok('C35 NENHUMA notificação falsa: card/modal não disparam notificação', !/notifPush|new Notification|notifToast|desktopAPI\.notify/i.test(card + evd));

console.log('— D) isolamento, aditivos e acabamento —');
ok('D1 dispatcher: 9 handlers data-ev originais intactos', ["if(el=g('[data-evsave]')){saveEvent();return;}", "if(el=g('[data-evedit]')){openEventForm(el.dataset.evedit);return;}", "if(el=g('[data-evstart]')){evStart(el.dataset.evstart);return;}", "if(el=g('[data-evfinish]')){evFinish(el.dataset.evfinish);return;}", "if(el=g('[data-evcancel]')){openEventDetail(el.dataset.evcancel,'cancel');return;}", "if(el=g('[data-evcancelyes]')){evCancel(el.dataset.evcancelyes);return;}", "if(el=g('[data-evdelete]')){openEventDetail(el.dataset.evdelete,'delete');return;}", "if(el=g('[data-evdeleteyes]')){evDelete(el.dataset.evdeleteyes);return;}"].every(l => has(S, l)));
ok('D2 menu ⋯: toggle com aria-expanded + fecha ao clicar fora', has(disp, "if(el=g('[data-evmore]'))") && has(disp, "aria-expanded',_op?'true':'false'") && has(disp, "_omn.classList.remove('open')"));
ok('D3 Esc da Central de Detalhes intacto (data-detmodal antes do ramo evd)', has(escH, "if(document.querySelector('.modal-back[data-detmodal]')){closeModal();}"));
ok('D4 ícones novos no MESMO estilo (24×24, stroke 2, currentColor): play/ban/dots', /play:'<path d="M8 5\.5v13l11-6\.5-11-6\.5z" stroke="currentColor" stroke-width="2"/.test(S) && /ban:'<circle cx="12" cy="12" r="8\.5" stroke="currentColor" stroke-width="2"/.test(S) && /dots:'<circle cx="5" cy="12" r="1\.7" fill="currentColor"/.test(S));
ok('D5 zero emoji operacional e zero fonte externa nas superfícies novas', !/[\u{1F300}-\u{1FAFF}]/u.test(card + evd) && !has(S, 'fonts.googleapis'));
ok('D6 prefers-reduced-motion cobre card e botões do modal', has(S, '@media (prefers-reduced-motion: reduce){.evc{transition:none}}') && has(S, '@media (prefers-reduced-motion: reduce){.evd-btn,.evd-x{transition:none}}'));
ok('D7 temas: superfícies novas usam tokens var(--…)', /\.evc \.evc2-date\{[^}]*var\(--surface2\)/.test(S) && /\.evd-when\{[^}]*var\(--surface2\)/.test(S) && /\.evd-cell\{[^}]*var\(--line-soft\)/.test(S));
ok('D8 erro de lifecycle: linha evd-err com literal e role=alert', has(evd, 'id="evdErr" class="evd-err') && has(evd, 'role="alert">Não foi possível concluir a ação. Verifique a conexão e tente novamente.</div>') && /\.evd-err\.show\{display:block\}/.test(S));
ok('D9 saveEvent/openEventForm (formulário) intocados nesta fase', has(S, "if(!title){fail('Informe o título do compromisso.');return;}") && has(S, "if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)){fail('Escolha a data do compromisso.');return;}") && has(S, "await db.collection('events').add(Object.assign({},content,{by:state.user.id,done:false,createdAt:Date.now(),src:'webpreview'}));") && has(S, "'<div class=\"del-actions\"><button class=\"btn ghost\" data-modalclose=\"1\">Cancelar</button><button class=\"btn\" data-evsave=\"1\">'"));
ok('D10 timezone: nenhum new Date(string de data) nas superfícies da Agenda', !/new Date\((e\.date|date)\)/.test(helpers + card + evd) && has(helpers, "date.split('-')"));
ok('D11 modal marcado (data-evdmodal + role=dialog aria-modal) e id escapado', has(evd, 'data-evdmodal="\'+esc(e.id)+\'"') && has(evd, 'role="dialog" aria-modal="true" aria-label="Detalhes do compromisso"'));
ok('D12 linha do tempo discreta: Iniciado/Finalizado/Cancelado com evWhen+ator (dados existentes)', has(evd, "Iniciado · '+esc(evWhen(e.startedAt))") && has(evd, "Finalizado · '+esc(evWhen(e.doneAt))") && has(evd, "Cancelado · '+esc(evWhen(e.cancelledAt))"));
ok('D13 tipografia: nada 100% caps no corpo (uppercase só em micro-labels)', !/\.evd-title\{[^}]*text-transform/.test(S) && !/\.evc \.evc2-ti\{[^}]*text-transform/.test(S) && /\.evd-cl\{[^}]*text-transform:uppercase/.test(S));
ok('D14 tipo do compromisso: chip com cor do TIPO no card e no cabeçalho do modal', has(card, '"evc2-ty" style="background:\'+withAlpha(ty.color,.14)') && has(evd, 'chip(ty.label,ty.color)'));

console.log('\nf355b-agenda-premium: ' + (n - fails) + '/' + n + (fails ? ' — COM FALHAS' : ' verdes'));
process.exit(fails ? 1 : 0);
