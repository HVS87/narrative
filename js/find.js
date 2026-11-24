'use strict';
/* ===== Pesquisa em todo o projeto (e ações), atalhos de teclado e dicas no sítio certo ===== */

/* ---------- pesquisa: Cenas, Capítulos, Tomos, Personagens, Localizações, Arcos, Referências, objetivos e Materiais de Apoio ----------
   A mesma caixa aceita ações («nova personagem», «tema claro», «exportar calendário»…). Abre com / ou Ctrl K. */
function findCommands(){
  const C = [], add = (label, icon, run, kw) => C.push({label, icon, run, kw:kw || ''});
  if (projNone()){
    add(_('Novo Projeto'), 'plus', newProject); add(_('Abrir Projeto…'), 'folder', pickProjectFile);
    add(_('Visita guiada'), 'help', () => startTour()); return C; }
  CREATE.forEach(c => add(_('Criar {x}', {x:c[1]}), c[2], () => doCreate(c[0]), _('novo nova adicionar')));
  NAV_FULL.forEach(it => { if (it !== '-') add(_('Ir para {x}', {x:it[1]}), it[2], () => setTab(it[0]), _('abrir área')); });
  add(_('Ir para {x}', {x:_('Definições do Projeto')}), 'gear', () => setTab('settings'), _('abrir área'));
  add(_('Guardar Projeto'), 'folder', () => exportProject(), _('ficheiro exportar')); add(_('Abrir Projeto…'), 'folder', pickProjectFile, _('ficheiro importar')); add(_('Novo Projeto'), 'plus', newProject);
  add(_('Exportar calendário (.ics)'), 'plan', exportICS, _('prazos agenda'));
  add(_('Importar de outro projeto'), 'import', () => importDialog(), _('Personagens Localizações Referências copiar trazer'));
  add(_('Tema claro'), 'spark', () => setTheme('light'), _('cores aparência')); add(_('Tema escuro'), 'spark', () => setTheme('dark'), _('cores aparência')); add(_('Tema automático'), 'spark', () => setTheme('auto'), _('cores aparência'));
  if (navMode() === 'rail'){ add(_('Vista: Quadro'), 'board', () => { setTab('board'); setNarrView('board'); }); add(_('Vista: Compacta'), 'grid', () => { setTab('board'); setNarrView('compact'); }); add(_('Vista: Lista'), 'list', () => { setTab('board'); setNarrView('list'); });
    add(_('Ajustar: ver a narrativa toda'), 'fit', () => { setTab('board'); setNarrView(View.dens === 'compact' ? 'compact' : 'board'); zoomFit(); }, _('zoom ampliação')); }
  add(_('Limpar filtros e mostrar tudo'), 'filter', clearFilters);
  add(_('Anular'), 'arrL', undo); add(_('Refazer'), 'arrR', redo);
  add(_('Procurar nos Materiais de Apoio'), 'bulb', () => openSearch('', 'support'), _('ajuda guia escrita'));
  add(_('Atalhos de teclado'), 'kbd', shortcutsSheet, _('teclas ajuda'));
  add(_('Visita guiada'), 'help', () => startTour(), _('ajuda')); add(_('Visita detalhada'), 'help', () => startTour('deep'), _('ajuda'));
  return C;
}
function findAll(q, only){
  if (only === 'support'){ const t = q.trim(); // F1: só os Materiais de Apoio
    const list = t ? supportSearch(t).slice(0, 40).map(r => ({label:supLabel(r.it), sub:r.sec.name, icon:'bulb', run:() => openSupportFicha(r.it.n, t)}))
      : SUPPORT.map(sec => ({label:sec.name, sub:_n(sec.groups.reduce((n, g) => n + g.items.length, 0), '{n} ficha', '{n} fichas'), icon:'bulb', run:() => { filters.supSec = sec.key; filters.supQ = ''; setTab('support'); }}));
    return list.length ? [{name:_('Materiais de Apoio'), items:list}] : []; }
  const words = supNorm(q).split(/\s+/).filter(Boolean), hit = (...t) => { const hay = supNorm(t.filter(Boolean).join(' ')); return words.every(w => hay.includes(w)); };
  const G = [], group = (name, items) => { if (items.length) G.push({name, items}); };
  group(_('Ações'), findCommands().filter(c => hit(c.label, c.kw)).slice(0, words.length ? 8 : 40));
  if (!words.length || projNone()) return G;
  const un = _('Sem título'), nm = narrIndexMap();
  group(_('Cenas'), narrOrder().map(id => state.scenes[id]).filter(s => s && hit(s.title, s.summary)).slice(0, 12).map(s => { const p = findScenePos(s.id), a = arcById(s.arcId);
    return {label:s.title || un, sub:'#' + (nm[s.id] + 1) + (p ? ' · ' + p.book.name + ' › ' + p.chapter.name : ''), color:arcStroke(a), run:() => openSceneFicha(s.id)}; }));
  const chs = []; state.books.forEach(b => b.chapters.forEach((c, ci) => { if (hit(c.name)) chs.push({label:c.name, sub:_('Capítulo {n}', {n:ci + 1}) + ' · ' + b.name, icon:'chapter', run:() => { setTab('board'); revealChapter(c.id); }}); }));
  group(_('Capítulos'), chs.slice(0, 8));
  group(_('Tomos'), state.books.filter(b => hit(b.name)).map(b => ({label:b.name, icon:'book', run:() => openBookFicha(b.id)})));
  group(_('Personagens'), state.characters.filter(c => hit(c.name, c.description)).slice(0, 10).map(c => ({label:c.name || _('Sem nome'), icon:'people', run:() => openCharFicha(c.id)})));
  group(_('Localizações'), state.sceneries.filter(x => hit(x.name, x.description)).slice(0, 10).map(x => ({label:x.name, icon:'pin', run:() => openSceneryFicha(x.id)})));
  group(_('Arcos Narrativos'), state.arcs.filter(a => hit(a.name, a.description)).slice(0, 10).map(a => ({label:a.name, color:arcStroke(a), run:() => openArcFicha(a.id)})));
  group(_('Referências'), state.refs.filter(r => hit(r.title, r.text, r.url, r.fileName)).slice(0, 10).map(r => ({label:r.title || un, sub:REF_TYPES[r.type], icon:REF_ICON[r.type], run:() => openRefFicha(r.id)})));
  group(_('Objetivos de pesquisa'), (state.goals || []).filter(g => hit(g.title, g.notes)).slice(0, 8).map(g => ({label:g.title || un, sub:targetLabel(g.target), icon:'flag', run:() => openGoalFicha(g.id)})));
  group(_('Materiais de Apoio'), supportSearch(q).slice(0, 6).map(r => ({label:supLabel(r.it), sub:r.sec.name, icon:'bulb', run:() => openSupportFicha(r.it.n, q.trim())})));
  return G;
}
function openSearch(q0, only){
  if (tourMode || (typeof Tour !== 'undefined' && Tour.active) || document.querySelector('.find-modal')) return;
  const inp = h('input', {class:'inp find-inp', type:'search', placeholder:only === 'support' ? _('Procurar nos Materiais de Apoio…') : projNone() ? _('Escreva uma ação…') : _('Procurar no projeto ou escrever uma ação…'), 'aria-label':_('Pesquisar'), value:q0 || '', autocomplete:'off', spellcheck:false});
  const list = h('div', {class:'find-list', role:'listbox', 'aria-label':_('Resultados')});
  const m = openModal({title:_('Pesquisar'), body:h('div', {class:'modal-body find-body'}, inp, list, h('div', {class:'find-foot muted small'}, _('↑ ↓ para escolher · Enter abre · Esc fecha'))), cls:'find-modal'});
  let items = [], act = 0;
  const mark = () => { [...list.querySelectorAll('.find-item')].forEach((el, i) => { el.classList.toggle('active', i === act); el.setAttribute('aria-selected', String(i === act)); if (i === act) el.scrollIntoView({block:'nearest'}); }); };
  const run = it => { m.close(); it.run(); };
  const draw = () => {
    const G = findAll(inp.value, only); items = []; list.innerHTML = '';
    G.forEach(g => { list.append(h('div', {class:'find-group'}, g.name));
      g.items.forEach(it => { const i = items.push(it) - 1;
        list.append(h('button', {class:'find-item', role:'option', tabIndex:-1, onclick:() => run(it), onpointermove:() => { if (act !== i){ act = i; mark(); } }},
          it.color ? h('span', {class:'dot', style:{background:it.color}}) : svgIcon(it.icon || 'scene'), h('span', {class:'find-l'}, it.label), it.sub ? h('span', {class:'find-s muted small'}, it.sub) : null)); }); });
    if (!items.length) list.append(h('div', {class:'find-none muted'}, _('Nada encontrado para «{q}».', {q:inp.value.trim()})));
    act = 0; mark();
  };
  inp.addEventListener('input', draw);
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); if (items.length){ act = (act + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length; mark(); } }
    else if (e.key === 'Enter' && !e.repeat){ e.preventDefault(); if (items[act]) run(items[act]); }
  });
  draw(); inp.focus(); inp.select();
}

/* ---------- atalhos de teclado (e a folha que os mostra, na tecla ?) ---------- */
const AREA_KEYS = ['board', 'plan', 'books', 'arcs', 'characters', 'sceneries', 'refs', 'support'];
function shortcutsSheet(){
  if (document.querySelector('.keys-modal')) return;
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || ''), ctrl = mac ? '⌘' : 'Ctrl';
  const k = (...keys) => h('span', {class:'kbds'}, keys.map(x => x === '+' ? h('span', {class:'kbd-plus'}, '+') : x === '/' ? h('span', {class:'kbd-plus'}, _('ou')) : h('kbd', null, x)));
  const row = (label, keys) => h('div', {class:'key-row'}, h('span', null, label), keys);
  const sec = (title, ...rows) => h('div', {class:'key-sec'}, h('h3', null, title), ...rows);
  openModal({title:_('Atalhos de teclado'), wide:true, cls:'keys-modal', body:h('div', {class:'modal-body keys-body'},
    sec(_('Em qualquer sítio'), row(_('Pesquisar no projeto e ações'), k('/', '/', ctrl, '+', 'K')), row(_('Esta folha de atalhos'), k('?')), row(_('Procurar nos Materiais de Apoio'), k('F1')), row(_('Nova Cena'), k('N')),
      row(_('Anular'), k(ctrl, '+', 'Z')), row(_('Refazer'), k(ctrl, '+', 'Shift', '+', 'Z')), row(_('Fechar a janela ou o menu'), k('Esc'))),
    sec(_('Ir para uma área'), ...AREA_KEYS.map((t, i) => row(TABS.find(x => x[0] === t)[1], k(String(i + 1))))),
    sec(_('No quadro'), row(_('Ampliar e reduzir'), k('+', '/', '−')), row(_('Repor a ampliação a 100 %'), k('0')), row(_('Ampliar com o rato'), k(ctrl, '+', _('roda'))), row(_('Cancelar um arrasto'), k('Esc'))),
    sec(_('Na ficha de uma Cena'), row(_('Cena anterior e seguinte do livro'), k('←', '/', '→')), row(_('Cena anterior e seguinte do Arco Narrativo'), k('Shift', '+', '←', '/', '→'))))});
}
const isTyping = t => !!t && (t.isContentEditable || /^(TEXTAREA|SELECT)$/.test(t.tagName) || (t.tagName === 'INPUT' && !/^(checkbox|button|submit|reset|file|color|radio)$/.test(t.type)));
document.addEventListener('keydown', e => {
  if (e.defaultPrevented || tourMode || (typeof Tour !== 'undefined' && Tour.active) || Dual.role === 'second') return;
  const k = e.key, mod = e.ctrlKey || e.metaKey;
  if (mod && !e.altKey && !e.shiftKey && k.toLowerCase() === 'k'){ e.preventDefault(); return openSearch(); }
  if (k === 'F1' && !mod && !e.altKey){ e.preventDefault(); return openSearch('', 'support'); } // os Materiais de Apoio, a partir de qualquer sítio (também a escrever)
  if (mod || e.altKey || isTyping(e.target) || modalsBlock() || menuEl || document.querySelector('.ac-list') || drag || linkDrag) return;
  if (k === '/'){ e.preventDefault(); return openSearch(); }
  if (projNone()) return;
  if (k === '?'){ e.preventDefault(); shortcutsSheet(); }
  else if (k === 'n' || k === 'N'){ e.preventDefault(); newSceneDialog(); }
  else if (/^[1-8]$/.test(k)){ e.preventDefault(); setTab(AREA_KEYS[+k - 1]); }
  else if (activeTab === 'board' && (k === '+' || k === '=')){ e.preventDefault(); setZoom(ViewPref.zoom + .1); }
  else if (activeTab === 'board' && (k === '-' || k === '−')){ e.preventDefault(); setZoom(ViewPref.zoom - .1); }
  else if (activeTab === 'board' && k === '0'){ e.preventDefault(); setZoom(1); }
});
window.addEventListener('DOMContentLoaded', () => { const b = $('#searchBtn'); if (b) b.addEventListener('click', () => openSearch()); });

/* ---------- dicas no sítio certo: uma de cada vez, e cada uma só uma vez neste dispositivo ---------- */
const LS_COACH = 'narrativa.dicas';
const Coach = { seen:(() => { try { return JSON.parse(lsGet(LS_COACH) || '{}') || {}; } catch(e){ return {}; } })(), last:0 };
function coach(key, msg){
  if (Coach.seen[key] || document.querySelector('.coach') || Date.now() - Coach.last < 20000) return false;
  Coach.seen[key] = 1; Coach.last = Date.now(); lsSet(LS_COACH, JSON.stringify(Coach.seen));
  const t = h('div', {class:'coach', role:'status'}, svgIcon('bulb'), h('span', {class:'coach-t'}, msg));
  const out = () => { t.classList.add('out'); setTimeout(() => t.remove(), 400); };
  t.append(h('button', {class:'coach-x', 'aria-label':_('Fechar a dica'), onclick:() => t.remove()}, svgIcon('x')));
  $('#toasts').append(t); setTimeout(out, 12000);
  return true;
}
function coachCheck(){
  if (!state || tourMode || (typeof Tour !== 'undefined' && Tour.active) || projNone() || Dual.role === 'second' || (typeof Tips !== 'undefined' && !Tips.on)) return; // quem desligou os explicadores não quer dicas
  const n = Object.keys(state.scenes).length, tap = coarse();
  if (openModals.some(m => m.sceneNav) && n > 1){ if (!tap) coach('setas', _('Dica: na ficha de uma Cena, as teclas ← e → passam à Cena anterior e à seguinte sem fechar a ficha.')); return; }
  if (openModals.length || activeTab !== 'board') return;
  if (n >= 1 && coach('arrastar', tap ? _('Dica: faça um toque longo numa Cena e arraste-a para lhe mudar a ordem.') : _('Dica: clique longo numa Cena e arraste-a para lhe mudar a ordem. Tudo se pode anular.'))) return;
  if (n >= 2 && coach('estado', _('Dica: o círculo no canto de cada Cena marca-a como escrita e, depois, como revista.'))) return;
  if (n >= 5 && state.characters.length && coach('filtrar', _('Dica: «Filtrar», por cima do quadro, destaca as Cenas de uma Personagem, de uma Localização ou as que faltam escrever.'))) return;
  if (n >= 8 && !tap && coach('pesquisa', _('Dica: a tecla / procura em todo o projeto; a tecla ? mostra os atalhos de teclado.'))) return;
}
