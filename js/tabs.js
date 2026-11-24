'use strict';
/* ===== Áreas da ferramenta (separadores): a navegação que as mostra está em nav.js ===== */
const TABS = [['board', _('Narrativa')], ['plan', _('Calendarização e Objetivos')], ['books', _('Tomos e Capítulos')], ['arcs', _('Arcos Narrativos')], ['characters', _('Personagens')], ['sceneries', _('Localizações')], ['refs', _('Referências')], ['support', _('Materiais de Apoio')], ['settings', _('Definições do Projeto')]];
let activeTab = 'board';
const filters = { scnRole:'all', booksChar:null, booksArc:null, charsBook:'', charsRole:'all', arcsChar:null, scnChar:null, refsType:'all', supSec:'narrador', supQ:'', planView:'overview', goalFilter:'all', calMonth:null, calDay:null };
let extraPalettes = [];
const PRESET_PALETTES = [
  {name:_('Meia-noite'), h:220, mode:'dark'}, {name:_('Papel'), h:220, mode:'light'}, {name:_('Floresta'), h:150, mode:'dark'}, {name:_('Vinho'), h:345, mode:'dark'},
  {name:_('Âmbar'), h:35, mode:'dark'}, {name:_('Violeta'), h:270, mode:'dark'}, {name:_('Pergaminho'), h:40, mode:'light'}, {name:_('Menta'), h:165, mode:'light'} ];

const SS_TAB = 'narrativa.tab'; // cada janela lembra-se do separador em que estava
/* No telemóvel, as Definições são uma barra lateral por cima do separador em que se estava (fechada por omissão):
   o separador continua a chamar-se «settings», só muda onde aparece. */
const MOBILE_Q = matchMedia('(max-width:699px), (max-height:520px) and (orientation:landscape)');
const Drawer = { under:'board' };
const drawerMode = () => MOBILE_Q.matches && activeTab === 'settings';
function setTab(t){
  if (t === 'settings' && activeTab !== 'settings') Drawer.under = activeTab;
  activeTab = t; ssSet(SS_TAB, t); if (typeof hideTip === 'function') hideTip(); // o explicador era de um elemento que vai desaparecer
  if (activeTab !== 'board') endPickLink(); renderAll(); }
const closeDrawer = () => { if (activeTab === 'settings') setTab(Drawer.under && Drawer.under !== 'settings' ? Drawer.under : 'board'); };
function renderAll(){
  document.title = state.project.name + ' — Narrative';
  $('#projName').textContent = state.project.name;
  if (typeof projUI === 'function'){ projUI(); fabUI(); }
  const drawer = drawerMode(), shown = drawer ? (Drawer.under !== 'settings' && Drawer.under) || 'board' : activeTab;
  renderNav(shown); // barra lateral (PC) ou barra de baixo (telemóvel): a área à vista fica assinalada
  $('#view-board').hidden = shown !== 'board';
  $('#view-page').hidden = shown === 'board';
  if (shown === 'board'){ viewBefore(); renderBoard(); narrUI(); } else renderPage(shown); // no telemóvel ao alto, a Narrativa abre em Lista
  drawerUI(drawer);
  updateHistUI(); orientHint(); coachCheck();
}
/* a barra lateral das Definições (telemóvel) */
function drawerUI(open){
  let d = $('#setDrawer');
  if (!d){
    const back = h('div', {id:'setBack', onclick:closeDrawer});
    d = h('aside', {id:'setDrawer', role:'dialog', 'aria-modal':'true', 'aria-label':_('Definições do Projeto')},
      h('div', {class:'drawer-head'}, h('h2', null, _('Definições')), h('button', {class:'icon-btn', 'aria-label':_('Fechar as Definições'), onclick:closeDrawer}, '✕')), h('div', {class:'drawer-body'}));
    document.body.append(back, d);
    // deslizar para a direita fecha
    let x0 = null; d.addEventListener('touchstart', e => { x0 = e.touches.length === 1 ? e.touches[0].clientX : null; }, {passive:true});
    d.addEventListener('touchend', e => { if (x0 !== null && e.changedTouches[0].clientX - x0 > 80) closeDrawer(); x0 = null; }, {passive:true});
  }
  const body = d.querySelector('.drawer-body'), was = d.classList.contains('open');
  const instant = typeof Tour !== 'undefined' && Tour.active; d.classList.toggle('instant', instant); $('#setBack').classList.toggle('instant', instant); // na visita, o destaque precisa da barra já no sítio
  d.classList.toggle('open', open); $('#setBack').classList.toggle('open', open); d.inert = !open;
  document.body.classList.toggle('drawer-open', open);
  if (open){ const st = body.scrollTop; body.innerHTML = ''; pageSettings(body, true); body.scrollTop = st; if (!was) setTimeout(() => d.querySelector('.drawer-head .icon-btn').focus({preventScroll:true}), 30); }
  else if (!was) body.innerHTML = '';
  else setTimeout(() => { if (!d.classList.contains('open')) body.innerHTML = ''; }, 300); // depois de deslizar para fora
}
// na fase de captura, antes de uma janela aberta por cima tratar o Esc (que só fecha essa janela)
window.addEventListener('keydown', e => { if (e.key === 'Escape' && drawerMode() && !openModals.length && !document.querySelector('.ctx-menu, .ac-list') && !(typeof Tour !== 'undefined' && Tour.active)) closeDrawer(); }, true);
MOBILE_Q.addEventListener('change', () => { if (state) renderAll(); }); // rodar o telemóvel ou estreitar a janela: as Definições passam de página a barra lateral, e vice-versa
function filterBox(label, getItems, val, setVal){
  if (val){ const it = getItems().find(i => i.id === val);
    return h('span', {class:'chip'}, label + ': ' + (it ? it.label : '?'), h('button', {class:'chip-x', onclick:() => { setVal(null); renderAll(); }}, '✕')); }
  const inp = h('input', {class:'inp', placeholder:_('Filtrar por {x}…', {x:label})});
  autocomplete(inp, getItems, i => { setVal(i.id); renderAll(); });
  return inp;
}
const charItems = () => state.characters.map(c => ({id:c.id, label:c.name}));
const arcItems = () => orderedArcs().map(l => ({id:l.arc.id, label:l.arc.name, color:arcStroke(l.arc)}));

function renderPage(tab){
  const page = $('#view-page'); page.innerHTML = '';
  if (filters.booksChar && !charById(filters.booksChar)) filters.booksChar = null;
  if (filters.arcsChar && !charById(filters.arcsChar)) filters.arcsChar = null;
  if (filters.scnChar && !charById(filters.scnChar)) filters.scnChar = null;
  if (filters.booksArc && !arcById(filters.booksArc)) filters.booksArc = null;
  if (filters.charsBook && !bookById(filters.charsBook)) filters.charsBook = '';
  tab = tab || activeTab;
  if (ELEMENT_TABS.includes(tab) && navMode() !== 'rail') page.append(elementTabs(tab)); // no telemóvel, os quatro estão em «Elementos»
  ({ books:pageBooks, characters:pageChars, arcs:pageArcs, sceneries:pageSceneries, refs:pageRefs, plan:pagePlan, support:pageSupport, settings:pageSettings })[tab](page);
}
/* ---------- listas de elementos: a mesma barra em todas (procurar, ordenar, cartões ou linhas), iniciais e presença ---------- */
const LS_LAYOUT = 'narrativa.listas';
const ListUI = { q:{}, sort:{}, layout:lsGet(LS_LAYOUT) === 'rows' ? 'rows' : 'cards', redraw:null };
const initials = name => { const w = String(name || '').trim().split(/\s+/).filter(Boolean); return ((w[0] || '?').charAt(0) + (w.length > 1 ? w[w.length - 1].charAt(0) : '')).toUpperCase(); };
/* o Arco Narrativo em que a Personagem mais aparece: dá a cor às suas iniciais */
function charArc(cid){
  const n = {}; Object.values(state.scenes).forEach(s => { if (s.pov === cid || s.chars.includes(cid)) n[s.arcId] = (n[s.arcId] || 0) + 1; });
  const best = Object.keys(n).sort((a, b) => n[b] - n[a])[0]; return best ? arcById(best) : null;
}
const avatar = c => { const a = charArc(c.id); return h('span', {class:'avatar' + (a ? '' : ' none'), 'aria-hidden':'true', style:a ? {background:arcColor(a)} : null}, initials(c.name)); };
/* mapa de presença: uma tira com todas as Cenas da narrativa, pela Ordem Narrativa e separadas por Tomo, preenchida onde o
   elemento aparece — vê-se de relance quem desaparece a meio da história */
function presence(has, color){
  const total = narrOrder().length; if (!total) return null; let n = 0;
  const strip = h('span', {class:'pres', role:'img'});
  state.books.forEach(b => { const sc = bookScenes(b); if (!sc.length) return;
    const stops = [], w = 100 / sc.length; sc.forEach((s, i) => { const on = has(s); if (on) n++; stops.push((on ? 'var(--pc)' : 'var(--po)') + ' ' + (i * w).toFixed(3) + '% ' + ((i + 1) * w).toFixed(3) + '%'); });
    strip.append(h('i', {style:{flex:sc.length, '--n':sc.length, '--pc':color || 'var(--accent)', '--fill':'linear-gradient(90deg,' + stops.join(',') + ')'}})); });
  const tx = _('Presença ao longo da narrativa: {n} de {total} Cenas.', {n, total}); strip.setAttribute('aria-label', tx); strip.dataset.tip = tx;
  return strip;
}
const firstIdx = has => { const o = narrOrder(), i = o.findIndex(id => state.scenes[id] && has(state.scenes[id])); return i < 0 ? 1e9 : i; };
const SORT_NAME = ['name', _('Ordenar: nome')], SORT_SCENES = ['scenes', _('Ordenar: mais Cenas')], SORT_FIRST = ['first', _('Ordenar: primeira aparição')];
/* «Importar»: Personagens, Localizações e Referências de outro projeto aberto (projects.js) */
const importBtn = kind => h('button', {class:'btn imp-btn', dataset:{imp:kind}, onclick:() => importDialog(kind)}, svgIcon('import'), h('span', null, _('Importar')));
function listTools(tab, sorts){
  const q = h('input', {class:'inp list-q', type:'search', placeholder:_('Procurar…'), 'aria-label':_('Procurar nesta lista'), value:ListUI.q[tab] || '', oninput:e => { ListUI.q[tab] = e.target.value; ListUI.redraw && ListUI.redraw(); }});
  const sort = sorts.length > 1 ? selectEl(sorts.map(([v, l]) => ({value:v, label:l})), ListUI.sort[tab] || sorts[0][0], v => { ListUI.sort[tab] = v; ListUI.redraw && ListUI.redraw(); }, 'inp list-sort') : null;
  if (sort) sort.setAttribute('aria-label', _('Ordenar'));
  const lay = h('div', {class:'view-seg list-lay', role:'group', 'aria-label':_('Disposição da lista')}, [['cards', _('Cartões'), 'cards'], ['rows', _('Linhas'), 'rows']].map(([k, l, ic]) =>
    h('button', {'aria-pressed':String(ListUI.layout === k), 'aria-label':l, dataset:{lay:k}, onclick:() => { ListUI.layout = k; lsSet(LS_LAYOUT, k); renderAll(); }}, svgIcon(ic))));
  return {q, sort, lay};
}
/* items: [{name, n (Cenas), first, card() → o cartão, lead e meta (para a linha), pres() → a tira, open}] */
function listBody(tab, items, emptyMsg, def){
  const raw = (ListUI.q[tab] || '').trim(), q = supNorm(raw), k = ListUI.sort[tab] || def;
  const list = q ? items.filter(o => supNorm(o.name).includes(q)) : items.slice();
  if (k === 'name') list.sort((a, b) => a.name.localeCompare(b.name)); else if (k === 'scenes') list.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)); else if (k === 'first') list.sort((a, b) => a.first - b.first || a.name.localeCompare(b.name));
  if (!list.length) return h('div', {class:'empty'}, q && items.length ? _('Nada encontrado para «{q}».', {q:raw}) : emptyMsg);
  if (ListUI.layout === 'rows') return h('div', {class:'el-rows'}, list.map(o => h('div', {class:'card el-row', onclick:o.open}, o.lead || null,
    h('div', {class:'el-main'}, h('h3', null, o.name), o.meta ? h('div', {class:'muted small'}, o.meta) : null), (o.pres && o.pres()) || h('span', {class:'pres none'}),
    h('span', {class:'el-n muted small'}, o.n != null ? _n(o.n, '{n} Cena', '{n} Cenas') : (o.side || '')))));
  return h('div', {class:'grid'}, list.map(o => { const c = o.card(), p = o.pres && o.pres(); if (p) c.append(p); return c; }));
}
function listPage(page, tab, title, filterEls, actions, sorts, items, emptyMsg){
  const t = listTools(tab, sorts), box = h('div', {class:'list-box'});
  page.append(h('div', {class:'page-head'}, h('h1', null, title), ...filterEls, t.q, t.sort, h('span', {class:'spacer'}), t.lay, ...actions), box);
  const draw = () => box.replaceChildren(listBody(tab, items(), emptyMsg(), sorts[0][0]));
  ListUI.redraw = draw; draw();
}
function pageBooks(page){
  const list = () => state.books.filter(b => (!filters.booksChar || bookCharacters(b).some(x => x.ch.id === filters.booksChar)) && (!filters.booksArc || bookArcIds(b).includes(filters.booksArc)));
  listPage(page, 'books', _('Tomos e Capítulos'),
    [filterBox(_('Personagem'), charItems, filters.booksChar, v => filters.booksChar = v), filterBox(_('Arco Narrativo'), arcItems, filters.booksArc, v => filters.booksArc = v)],
    [h('button', {class:'btn primary', onclick:() => { filters.booksChar = filters.booksArc = null; addBook(); }}, _('+ Novo Tomo'))],
    [['order', _('Ordenar: ordem do livro')], SORT_NAME, SORT_SCENES],
    () => list().map(b => { const n = narratorByKey(b.narrator), ids = new Set(bookScenes(b).map(s => s.id)), i = state.books.indexOf(b);
      const meta = _n(b.chapters.length, '{n} Capítulo', '{n} Capítulos') + ' · ' + _n(ids.size, '{n} Cena', '{n} Cenas') + ' · ' + _n(bookCharacters(b).length, '{n} Personagem', '{n} Personagens');
      return {name:b.name, n:ids.size, first:i, open:() => openBookFicha(b.id), lead:h('span', {class:'el-lead'}, i + 1), meta:(n ? n.name : _('Narrador por definir')) + ' · ' + meta,
        pres:() => presence(s => ids.has(s.id), b.color || null),
        card:() => h('div', {class:'card', onclick:() => openBookFicha(b.id)}, b.color ? h('div', {class:'bar', style:{background:b.color}}) : null,
          h('div', {class:'kicker'}, _('Tomo {n}', {n:i + 1})), h('h3', null, b.name),
          h('div', {class:'muted small'}, n ? n.name : _('Narrador por definir')), h('div', {class:'muted small'}, meta),
          h('div', {class:'chips', style:{marginTop:'8px'}}, bookArcIds(b).map(a => arcById(a) && h('span', {class:'dot', title:arcById(a).name, style:{background:arcStroke(arcById(a))}}))))}; }),
    () => _('Nenhum Tomo corresponde aos filtros.'));
  /* por baixo dos Tomos, os Capítulos (dos Tomos à vista): mesma procura, mesma ordenação e mesma disposição */
  const prev = ListUI.redraw, hd = h('div', {class:'list-sub'}), cbox = h('div', {class:'list-box'}), thd = h('h2', {class:'list-subt'}, _('Tomos'));
  page.querySelector('.list-box').before(thd); page.append(hd, cbox);
  const chapters = () => { const out = [];
    list().forEach(b => { const bi = state.books.indexOf(b); b.chapters.forEach((c, ci) => { const sc = chapterScenes(c), ids = new Set(sc.map(s => s.id));
      if (filters.booksChar && !sc.some(s => s.pov === filters.booksChar || s.chars.includes(filters.booksChar))) return;
      if (filters.booksArc && !sc.some(s => s.arcId === filters.booksArc)) return;
      const w = chapterProg(c, 'write'), rv = chapterProg(c, 'review'), go = () => { setTab('board'); if (narrView() !== 'list') revealChapter(c.id); else revealChapter(c.id); };
      const meta = _n(sc.length, '{n} Cena', '{n} Cenas') + (sc.length ? ' · ' + _('{w} escritas · {v} revistas', {w:w.done, v:rv.done}) : '');
      out.push({name:c.name || _('Sem título'), n:sc.length, first:out.length, open:go, lead:h('span', {class:'el-lead'}, ci + 1), meta:_('Tomo {n}', {n:bi + 1}) + ' · ' + b.name + ' · ' + meta,
        pres:() => presence(s => ids.has(s.id), b.color || null),
        card:() => h('div', {class:'card ch-card', dataset:{chapter:c.id}, onclick:go}, b.color ? h('div', {class:'bar', style:{background:b.color}}) : null,
          h('div', {class:'kicker'}, _('Tomo {n}', {n:bi + 1}) + ' · ' + _('Capítulo {n}', {n:ci + 1})), h('h3', null, c.name || _('Sem título')),
          h('div', {class:'muted small'}, b.name), h('div', {class:'muted small'}, meta), layerBar('chapter', c, 'in-card'))}); }); });
    return out; };
  const drawCh = () => { const items = chapters();
    hd.replaceChildren(h('h2', {class:'list-subt'}, _('Capítulos'), h('span', {class:'muted small'}, ' · ' + items.length)), h('span', {class:'spacer'}), h('button', {class:'btn', onclick:() => newChapterDialog()}, _('+ Novo Capítulo')));
    cbox.replaceChildren(listBody('books', items, state.books.some(b => b.chapters.length) ? _('Nenhum Capítulo corresponde aos filtros.') : _('Ainda não existem Capítulos.'), 'order')); };
  ListUI.redraw = () => { prev(); drawCh(); }; drawCh();
}
function pageChars(page){
  const seg = h('div', {class:'seg'}, [['all', _('Todos')], ['main', _('Personagens Principais')], ['side', _('Personagens Secundárias')]].map(([k, l]) =>
    h('button', {class:filters.charsRole === k ? 'on' : '', onclick:() => { filters.charsRole = k; renderAll(); }}, l)));
  const sel = selectEl([{value:'', label:_('Todos os Tomos')}, ...state.books.map(b => ({value:b.id, label:b.name}))], filters.charsBook, v => { filters.charsBook = v; renderAll(); });
  sel.style.width = '220px';
  const list = () => state.characters.filter(c => {
    if (filters.charsBook && !charBooks(c.id).some(b => b.id === filters.charsBook)) return false;
    return filters.charsRole === 'all' || (filters.charsRole === 'main') === isMain(c.id, filters.charsBook);
  }).sort((a, b) => a.name.localeCompare(b.name));
  listPage(page, 'characters', _('Personagens'), [sel, seg],
    [importBtn('characters'), h('button', {class:'btn primary', onclick:() => { const c = newCharacter(); commit(); openCharFicha(c.id, true); }}, _('+ Nova Personagem'))],
    [SORT_NAME, SORT_SCENES, SORT_FIRST],
    () => list().map(c => { const main = isMain(c.id, filters.charsBook), bs = charBooks(c.id), has = s => s.pov === c.id || s.chars.includes(c.id), a = charArc(c.id);
      const role = main ? _('Personagem Principal') : _('Personagem Secundária');
      return {name:c.name || _('Sem nome'), n:allScenes().filter(has).length, first:firstIdx(has), open:() => openCharFicha(c.id), lead:avatar(c),
        meta:[role, c.age ? _('{n} anos', {n:c.age}) : null, bs.length ? bs.map(b => b.name).join(', ') : _('Sem Tomos associados')].filter(Boolean).join(' · '),
        pres:() => presence(has, a ? arcStroke(a) : null),
        card:() => h('div', {class:'card', onclick:() => openCharFicha(c.id)}, h('div', {class:'card-top'}, avatar(c), h('h3', null, c.name || _('Sem nome'))),
          h('div', {class:'chips'}, badge(role, main ? 'main' : ''), badge(c.gender || 'N/D'), badge(c.age ? _('{n} anos', {n:c.age}) : _('idade N/D'))),
          h('div', {class:'muted small book-list', style:{marginTop:'8px'}}, bs.length ? bs.map(b => h('span', null, bookDot(b), b.name)) : _('Sem Tomos associados')))}; }),
    () => state.characters.length ? _('Nenhuma Personagem corresponde aos filtros.') : _('Ainda não existem Personagens.'));
}
function pageArcs(page){
  const list = () => orderedArcs().filter(l => !filters.arcsChar || arcCharIds(l.arc.id).includes(filters.arcsChar));
  listPage(page, 'arcs', _('Arcos Narrativos'), [filterBox(_('Personagem'), charItems, filters.arcsChar, v => filters.arcsChar = v)],
    [h('button', {class:'btn primary', onclick:async () => { const a = await promptNewArc(); if (a) openArcFicha(a.id); }}, _('+ Novo Arco Narrativo'))],
    [['order', _('Ordenar: ordem do quadro')], SORT_NAME, SORT_SCENES, SORT_FIRST],
    () => list().map(({arc}) => { const own = arcOwnScenes(arc.id), parent = arc.parentId && arcById(arc.parentId), bs = state.books.filter(b => bookArcIds(b).includes(arc.id)), has = s => s.arcId === arc.id;
      const cnt = _n(own.length, '{n} Cena', '{n} Cenas') + ' · ' + _n(arcCharIds(arc.id).length, '{n} Personagem', '{n} Personagens'), kick = parent ? _('↳ Ramo de ') + parent.name : _('Arco Narrativo');
      return {name:arc.name, n:own.length, first:firstIdx(has), open:() => openArcFicha(arc.id), lead:h('span', {class:'dot el-dot', style:{background:arcStroke(arc)}}), meta:kick + ' · ' + (bs.length ? bs.map(b => b.name).join(', ') : _('Sem Tomos')),
        pres:() => presence(has, arcStroke(arc)),
        card:() => h('div', {class:'card', onclick:() => openArcFicha(arc.id)}, h('div', {class:'bar', style:{background:arcStroke(arc)}}),
          h('div', {class:'kicker'}, kick), h('h3', null, arc.name), h('div', {class:'muted small'}, cnt),
          h('div', {class:'muted small book-list'}, bs.length ? bs.map(b => h('span', null, bookDot(b), b.name)) : _('Sem Tomos')))}; }),
    () => state.arcs.length ? _('Nenhum Arco Narrativo corresponde ao filtro.') : _('Ainda não existem Arcos Narrativos.'));
}
function pageSceneries(page){
  const list = () => state.sceneries.filter(x => (!filters.scnChar || x.chars.includes(filters.scnChar)) && (filters.scnRole === 'all' || (filters.scnRole === 'main') === !!x.main)).sort((a, b) => a.name.localeCompare(b.name));
  const seg = h('div', {class:'seg loc-seg'}, [['all', _('Todas')], ['main', _('Localizações Principais')], ['side', _('Localizações Secundárias')]].map(([k, l]) =>
    h('button', {class:filters.scnRole === k ? 'on' : '', dataset:{role:k}, onclick:() => { filters.scnRole = k; renderAll(); }}, l)));
  listPage(page, 'sceneries', _('Localizações'), [filterBox(_('Personagem'), charItems, filters.scnChar, v => filters.scnChar = v), seg],
    [importBtn('sceneries'), h('button', {class:'btn primary', onclick:() => { filters.scnChar = null; const x = newScenery(); commit(); openSceneryFicha(x.id, true); }}, _('+ Nova Localização'))],
    [SORT_NAME, SORT_SCENES, SORT_FIRST],
    () => list().map(x => { const names = x.chars.map(charById).filter(Boolean).map(c => c.name), has = s => s.sceneries.includes(x.id), n = sceneryScenes(x.id).length;
      const role = x.main ? _('Localização Principal') : _('Localização Secundária');
      return {name:x.name, n, first:firstIdx(has), open:() => openSceneryFicha(x.id), lead:svgIcon('pin', 'el-ic' + (x.main ? ' main' : '')), meta:role + ' · ' + (names.length ? names.join(' · ') : _('Sem Personagens associadas')),
        pres:() => presence(has, null),
        card:() => h('div', {class:'card', onclick:() => openSceneryFicha(x.id)}, h('div', {class:'kicker'}, _('Localização')), h('h3', null, x.name),
          h('div', {class:'chips', style:{marginBottom:'6px'}}, badge(role, x.main ? 'main' : ''), locSuggest(x) ? badge(_('Sugestão: principal'), 'sug') : null),
          h('div', {class:'muted small'}, _n(n, '{n} Cena', '{n} Cenas') + ' · ' + _n(names.length, '{n} Personagem', '{n} Personagens')),
          h('div', {class:'muted small', style:{marginTop:'6px'}}, names.length ? names.join(' · ') : _('Sem Personagens associadas')))}; }),
    () => state.sceneries.length ? _('Nenhuma Localização corresponde ao filtro.') : _('Ainda não existem Localizações. Uma Localização é um lugar onde decorrem Cenas.'));
  /* as que já aparecem em várias Cenas e ainda não foram marcadas: sugestão, por cima da lista */
  const sug = state.sceneries.filter(locSuggest).sort((a, b) => sceneryScenes(b.id).length - sceneryScenes(a.id).length);
  if (sug.length) page.querySelector('.list-box').before(h('div', {class:'loc-sugs'}, sug.slice(0, 3).map(x => locSuggestBox(x))));
}
function pageRefs(page){
  const seg = h('div', {class:'seg'}, [['all', _('Todas')], ['document', _('Documents')], ['link', _('Links')], ['audio', _('Audio')], ['video', _('Video')], ['note', _('Notas')]].map(([k, l]) =>
    h('button', {class:filters.refsType === k ? 'on' : '', onclick:() => { filters.refsType = k; renderAll(); }}, l)));
  const list = () => state.refs.filter(r => filters.refsType === 'all' || r.type === filters.refsType).sort((a, b) => (b.created || 0) - (a.created || 0));
  const what = r => r.type === 'note' ? (r.text || _('Nota em branco')) : r.url ? r.url : `${r.fileName} · ${fmtSize(r.size)}`;
  listPage(page, 'refs', _('Referências'), [seg],
    [importBtn('refs'), h('button', {class:'btn primary ref-new', 'aria-haspopup':'menu', 'aria-expanded':'false', onclick:e => topMenu(e.currentTarget, [ // um só «+ Novo»: uma Nota já aberta, ou a janela de ficheiros e Links
      {label:_('Nota'), action:() => { const r = newNote(); commit(); openRefFicha(r.id); }}, {label:_('Ficheiro ou Link…'), action:() => newRefDialog(null)}], 'ref-new-menu')}, _('+ Novo'))],
    [['new', _('Ordenar: mais recentes')], SORT_NAME],
    () => list().map(r => { const links = r.links.length ? _n(r.links.length, '{n} associação', '{n} associações') : _('Sem associações');
      return {name:r.title || _('Sem título'), open:() => openRefFicha(r.id), lead:refIcon(r.type), meta:REF_TYPES[r.type] + ' · ' + what(r).slice(0, 120), side:links,
        card:() => h('div', {class:'card', onclick:() => openRefFicha(r.id)}, h('div', {class:'kicker'}, refIcon(r.type), REF_TYPES[r.type]), h('h3', null, r.title || _('Sem título')),
          h('div', {class:'muted small', style:{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}, r.type === 'note' ? (r.text || _('Nota em branco')) : httpURL(r.url) ? h('a', {href:r.url, target:'_blank', rel:'noopener noreferrer', class:'ext-link', onclick:e => e.stopPropagation()}, r.url + ' ↗') : r.url ? r.url : `${r.fileName} · ${fmtSize(r.size)}`),
          h('div', {class:'muted small', style:{marginTop:'6px'}}, links))}; }),
    () => _('Sem Referências. Todas as Referências são guardadas localmente neste browser.'));
}
/* pesquisa sem distinguir acentos nem maiúsculas */
const supNorm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const supHay = it => it._h || (it._h = [supNorm(it.n + ' ' + (it.o || '') + ' ' + (it.a || '')), supNorm([it.d, it.f, it.u, it.c, it.t, ...(it.x || []), ...(it.w || []).map(r => r.join(' '))].filter(Boolean).join(' ').replace(/\*([^*\s][^*]*?)\*/g, '$1'))]);
function supportSearch(q){
  const words = supNorm(q).split(/\s+/).filter(Boolean), out = [];
  SUPPORT.forEach(sec => sec.groups.forEach(g => g.items.forEach(it => { const [head, rest] = supHay(it);
    if (words.every(w => head.includes(w))) out.push({it, sec, g, rank:0});
    else if (words.every(w => head.includes(w) || rest.includes(w))) out.push({it, sec, g, rank:1}); })));
  return out.sort((a, b) => a.rank - b.rank);
}
function pageSupport(page){
  const body = h('div');
  const card = (it, kicker) => h('div', {class:'card', onclick:() => openSupportFicha(it.n, filters.supQ.trim())}, h('div', {class:'kicker'}, kicker), h('h3', null, supTitle(it)),
    it.a && h('div', {class:'small sup-alt'}, it.a), h('div', {class:'muted small sup-desc'}, supRich(it.d)));
  const nav = h('div', {class:'sup-nav'}, SUPPORT.map(sec => h('button', {dataset:{sec:sec.key}, onclick:() => { filters.supSec = sec.key; filters.supQ = search.value = ''; draw(); }},
    sec.name, h('span', {class:'n'}, sec.groups.reduce((n, g) => n + g.items.length, 0)))));
  const search = h('input', {class:'inp sup-search', type:'search', placeholder:_('Pesquisar em todos os materiais…'), value:filters.supQ, oninput:() => { filters.supQ = search.value; draw(); }});
  const draw = () => { body.innerHTML = ''; const q = filters.supQ.trim();
    nav.querySelectorAll('button').forEach(b => b.classList.toggle('on', !q && b.dataset.sec === filters.supSec));
    if (q){ const res = supportSearch(q);
      body.append(h('p', {class:'muted'}, res.length ? _n(res.length, '{n} resultado para «{q}», em todas as secções.', '{n} resultados para «{q}», em todas as secções.', {q}) : _('Nada encontrado para «{q}». Experimente outra palavra ou o termo em inglês (por exemplo, «flashback»).', {q})));
      if (res.length) body.append(h('div', {class:'grid'}, res.map(r => card(r.it, r.sec.name))));
      return; }
    const sec = SUPPORT.find(s => s.key === filters.supSec) || SUPPORT[0];
    body.append(h('p', {class:'sup-intro'}, sec.intro));
    sec.groups.forEach(g => body.append(h('h2', {class:'sup-group'}, g.name, h('span', {class:'muted small'}, ' · ' + g.items.length)), h('div', {class:'grid'}, g.items.map(it => card(it, sec.kicker)))));
  };
  page.append(h('div', {class:'page-head'}, h('h1', null, _('Materiais de Apoio')), h('span', {class:'spacer'}), search), nav, body);
  draw();
}
function pageSettings(page, inDrawer){
  const p = state.project.palette;
  const palBtn = pal => { const v = paletteVars(pal);
    // a paleta escolhida dá o tom ao projeto e o modo (claro ou escuro) a este dispositivo — escolha que fica lembrada
    return h('button', {class:'pal' + (pal.h === p.h && pal.mode === effectiveMode() ? ' on' : ''), onclick:() => { state.project.palette = {h:pal.h, mode:pal.mode}; lsSet(LS_THEME, pal.mode); lsSet(LS_PAL, String(pal.h)); applyPalette(); commit(); }},
      h('div', {class:'sw'}, ['--bg', '--surface2', '--border', '--accent', '--text'].map(k => h('span', {style:{background:v[k]}}))), h('div', {class:'small'}, pal.name)); };
  const pals = [...PRESET_PALETTES, ...extraPalettes]; // uma paleta gerada numa sessão anterior continua a aparecer, como «Atual»
  if (!pals.some(x => x.h === p.h && x.mode === effectiveMode())) pals.push({name:_('Atual'), h:p.h, mode:effectiveMode()});
  const set = h('div', {class:'settings'},
    inDrawer ? installCard() : h('div', {class:'page-head'}, h('h1', null, _('Definições do Projeto'))), // no telemóvel, instalar como app vem primeiro
    h('div', {class:'card static'}, field(_('Nome do Projeto'), h('input', {class:'inp', value:state.project.name, oninput:e => { state.project.name = e.target.value || _('Projeto'); save(); $('#projName').textContent = state.project.name; document.title = state.project.name + ' — Narrative'; }}))),
    langCard(),
    h('div', {class:'card static proj-card'}, h('h3', null, _('Guardar e abrir')),
      h('p', {class:'muted small'}, _('Cada alteração fica gravada automaticamente neste dispositivo, e o projeto continua cá quando voltar a abrir a ferramenta. «Guardar Projeto» grava-o num ficheiro (com as Referências), para cópias de segurança ou para o levar para outro dispositivo. «Abrir Projeto» abre um ficheiro como mais um projeto, sem fechar os que estão abertos; para alternar entre eles, use o nome do projeto na barra de topo.')),
      h('div', {class:'chips'}, h('button', {class:'btn primary', onclick:exportProject}, _('Guardar Projeto')), h('button', {class:'btn', onclick:pickProjectFile}, _('Abrir Projeto')),
        h('button', {class:'btn', onclick:newProject}, _('Novo Projeto')), h('button', {class:'btn danger', onclick:closeProject}, _('Fechar Projeto'))),
      h('label', {class:'switch-wrap', style:{marginTop:'12px'}}, h('input', {type:'checkbox', checked:leaveWarnOn(), onchange:e => lsSet(LS_LEAVE, e.target.checked ? '1' : '0')}), h('span', {class:'slider'}),
        h('span', null, _('Perguntar antes de sair, se houver projetos por guardar em ficheiro')))),
    syncCard(),
    h('div', {class:'card static theme-card'}, h('h3', null, _('Tema e paleta de cores')),
      h('p', {class:'muted small'}, _('Por omissão, a ferramenta segue o tema do sistema (claro ou escuro). Se escolher outro, fica lembrado neste dispositivo. A paleta dá o tom das cores ao projeto.')),
      h('div', {class:'seg theme-seg', role:'radiogroup', 'aria-label':_('Tema')}, [['auto', _('Automático (segue o sistema)')], ['light', _('Claro')], ['dark', _('Escuro')]].map(([k, l]) =>
        h('button', {class:themePref() === k ? 'on' : '', role:'radio', 'aria-checked':String(themePref() === k), onclick:() => setTheme(k)}, l))),
      h('div', {style:{height:'12px'}}),
      h('div', {class:'palettes'}, pals.map(palBtn)),
      h('div', {style:{marginTop:'12px'}}, h('button', {class:'btn', onclick:() => {
        extraPalettes = Array.from({length:6}, (x, i) => { const hue = Math.floor(Math.random() * 360); return {name:_('Gerada {n}°', {n:hue}), h:hue, mode:i % 3 === 2 ? 'light' : 'dark'}; }); renderAll(); }}, _('↻ Gerar novas paletas')))),
    a11yCard(),
    inDrawer ? null : installCard(),
    updCard(),
    h('div', {class:'card static'}, h('h3', null, _('Explicadores')),
      h('p', {class:'muted small'}, _('Ao parar o rato sobre um elemento, aparece uma breve explicação do que este faz. Nos ecrãs táteis, onde não há rato, os explicadores não aparecem.')),
      h('label', {class:'switch-wrap'}, h('input', {type:'checkbox', checked:Tips.on, onchange:e => setTipsOn(e.target.checked)}), h('span', {class:'slider'}), h('span', null, _('Mostrar explicadores')))),
    h('div', {class:'card static'}, h('h3', null, _('Visita guiada')),
      h('p', {class:'muted small'}, _('A visita usa um projeto de demonstração e não altera nem regista nada nos seus dados.')),
      h('div', {class:'chips'}, h('button', {class:'btn', onclick:() => startTour()}, _('Visita guiada')), h('button', {class:'btn', onclick:() => startTour('deep')}, _('Visita detalhada')))),
    privacyCard());
  page.append(inDrawer ? set : h('div', {class:'set-layout'}, settingsToc(set, page), set));
}
/* índice das Definições: salta para cada cartão e assinala o que está à vista (só com largura para ele) */
function settingsToc(set, page){
  const items = [...set.querySelectorAll(':scope > .card')].map((c, i) => {
    const t = c.querySelector('h3') || c.querySelector('.field > label'); if (!t) return null;
    c.id = 'set-' + i; return {c, b:h('button', {type:'button', onclick:() => { c.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('reduce-motion') ? 'auto' : 'smooth', block:'start'}); }}, t.textContent.trim())};
  }).filter(Boolean);
  const nav = h('nav', {class:'set-toc', 'aria-label':_('Secções das Definições')}, items.map(x => x.b));
  const mark = () => { const top = page.getBoundingClientRect().top + 90; let on = items[0];
    for (const x of items) if (x.c.getBoundingClientRect().top <= top) on = x;
    if (page.scrollTop + page.clientHeight >= page.scrollHeight - 4) on = items[items.length - 1]; // no fim da página, o último cartão
    items.forEach(x => { x.b.classList.toggle('on', x === on); x.b.setAttribute('aria-current', x === on ? 'true' : 'false'); }); };
  if (page._setMark) page.removeEventListener('scroll', page._setMark);
  page._setMark = mark; page.addEventListener('scroll', mark, {passive:true}); requestAnimationFrame(mark);
  return nav;
}

/* Abrir um ficheiro por cima de um projeto aberto substitui-o: nenhuma janela pode anular para trás desse ponto. */
const LS_RESET = 'narrativa.reset';
let knownReset = lsGet(LS_RESET);
function markReset(){ knownReset = String(Date.now()); lsSet(LS_RESET, knownReset); }

/* ----- guardar e abrir (funções em projects.js) ----- */
function blobToDataURL(b){ return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); }); }

/* ----- guardar como app (PWA) ----- */
const Install = { prompt:null, done:false };
/* a aplicação para PC (desktop/) também conta como app instalada */
const isDesktopApp = () => !!(window.narrativaDesktop && window.narrativaDesktop.version);
const isInstalledApp = () => isDesktopApp() || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); Install.prompt = e; syncInstallBtn(); if (activeTab === 'settings' && state) renderAll(); });
window.addEventListener('appinstalled', () => { Install.prompt = null; Install.done = true; syncInstallBtn(); toast(_('Ferramenta instalada.')); if (activeTab === 'settings') renderAll(); });
async function installApp(){
  if (!Install.prompt) return;
  const p = Install.prompt; Install.prompt = null; p.prompt();
  try { await p.userChoice; } catch(e){}
  syncInstallBtn(); if (activeTab === 'settings') renderAll();
}
function installCard(){
  const kids = [h('h3', null, _('Instalar como app'))];
  const ua = navigator.userAgent, mobile = isIOS() || /android/i.test(ua);
  if (isDesktopApp()) kids.push(h('p', {class:'muted small', dataset:{install:'desktop'}}, _('Está a usar a aplicação para PC (versão {v}). Funciona sem ligação à internet, atualiza-se sozinha e sincroniza com a app do telemóvel.', {v:window.narrativaDesktop.version})));
  else if (isInstalledApp()) kids.push(h('p', {class:'muted small', dataset:{install:'installed'}}, _('Está a usar a app instalada. Funciona sem ligação à internet e atualiza-se sozinha quando houver rede.')));
  else if (Install.done) kids.push(h('p', {class:'muted small', dataset:{install:'installed'}}, _('A ferramenta está instalada neste dispositivo. Pode abri-la a partir do ícone, como qualquer outra app.')));
  else {
    kids.push(h('p', {class:'muted small'}, _('Instalada como app, a ferramenta fica com ícone próprio, abre numa janela só sua (em ecrã inteiro, no telemóvel e no tablet) e funciona sem ligação à internet. No Chrome e no Edge, o projeto é o mesmo que vê aqui; no iPhone, no iPad e noutros browsers a app pode começar vazia — use «Guardar Projeto» e «Abrir Projeto» (ou a sincronização) para passar o projeto.')));
    if (Install.prompt) kids.push(h('button', {class:'btn primary', onclick:installApp}, _('Instalar')));
    else if (isIOS() && location.protocol !== 'file:') kids.push(h('button', {class:'btn primary', dataset:{install:'manual'}, onclick:installHelp}, _('Ver como instalar')));
    else kids.push(h('p', {class:'muted small', dataset:{install:'manual'}}, location.protocol === 'file:'
      ? _('Para instalar, abra a ferramenta a partir do endereço web (não de um ficheiro local).')
      : /firefox/i.test(ua) ? (mobile ? _('No Firefox para Android: menu ⋮ › «Adicionar ao ecrã principal».') : _('O Firefox não permite instalar aplicações web no computador. Abra este endereço no Chrome ou no Edge para instalar; aqui, a ferramenta continua a funcionar normalmente no browser.'))
      : mobile ? _('No Chrome para Android: menu ⋮ › «Adicionar ao ecrã principal» ou «Instalar aplicação».')
      : _('No Chrome ou no Edge: menu ⋮ › «Instalar Narrative» (ou o ícone de instalação na barra de endereço). No Safari: Partilhar › «Adicionar à Dock».')));
  }
  // no computador, fora da aplicação: ligação para as versões de Windows, macOS e Linux
  if (!isDesktopApp() && /Windows|Macintosh|Linux|X11/.test(ua) && !mobile) kids.push(h('p', {class:'small', dataset:{install:'pc'}}, _('Também há uma aplicação para computador (Windows, macOS e Linux): '),
    h('a', {href:'https://github.com/HVS87/narrative/releases/latest', target:'_blank', rel:'noopener'}, _('descarregar a aplicação para computador')), '.'));
  return h('div', {class:'card static install-card'}, kids);
}
function initApp(){
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js', {updateViaCache:'none'}).catch(() => {}); // «none»: ao procurar versões novas, nunca usa cópias guardadas pelo browser
  // pede ao browser para não apagar os dados locais quando faltar espaço
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

/* Os ficheiros de Referências eliminadas ficam guardados durante a sessão (para se poder anular) e são limpos no arranque. */
async function purgeOrphanFiles(){
  const keys = await idb.keys(); if (tourMode) return; // as Referências são registadas antes de o ficheiro ser gravado, por isso tudo o que aqui não tiver Referência é lixo
  const keep = projAllRefIds(); if (!keep) return; for (const k of keys) if (!keep.has(k)) await idb.del(k); // os ficheiros de todos os projetos guardados neste dispositivo
}

/* Um projeto chegado de fora — de outra janela deste dispositivo ou de outro dispositivo — passa a ser o mostrado.
   As fichas abertas reabrem-se com os dados novos e a mudança pode ser anulada (exceto quando o projeto foi trocado).
   As janelas que não são fichas (ligar dispositivos, escolher entre versões) mantêm-se abertas. */
function applyExternal(fresh, reset){
  clearTimeout(saveT); saveT = null;
  if (Tour.active){ Tour.saved.state = fresh; Hist.undo = []; Hist.redo = []; Hist.last = JSON.stringify(fresh); return; }
  const snap = JSON.stringify(fresh); if (snap === Hist.last) return;
  const open = openModals.filter(m => m.entity).map(m => ({entity:m.entity, scroll:m.back.scrollTop}));
  cancelDrags(); closeMenu();
  [...openModals].reverse().forEach(m => { if (!m.keep){ m.redraw = null; m.close(); } });
  state = fresh;
  if (reset) histInit();
  else if (Hist.last !== null){ Hist.undo.push(Hist.last); if (Hist.undo.length > Hist.MAX) Hist.undo.shift(); Hist.redo = []; Hist.last = snap; Hist.lastSoft = false; updateHistUI(); }
  applyPalette(); renderAll(); reopenFichas(open); setSaveUI('sync');
}
/* Outra janela (outro separador, o segundo ecrã ou a app instalada) guardou o projeto: esta passa a mostrar a mesma versão. */
window.addEventListener('storage', e => {
  if (e.key === LS_SYNC && Sync.cfg){ syncReloadCfg(); return; }
  if (e.key !== LS_KEY || e.newValue == null || !state) return;
  let fresh; try { fresh = sanitize(JSON.parse(e.newValue)); } catch(err){ return; }
  const rs = lsGet(LS_RESET), reset = rs !== knownReset; if (reset) knownReset = rs; // a outra janela trocou de projeto
  applyExternal(fresh, reset);
  if (Sync.peer) syncLocalChanged(); // esta janela é a que sincroniza: a alteração da outra janela segue para os outros dispositivos
});

/* ----- arranque ----- */
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => e.preventDefault());
window.addEventListener('DOMContentLoaded', () => {
  state = loadState(); applyPalette(); initBoard();
  const t0 = ssGet(SS_TAB); if (TABS.some(t => t[0] === t0) && !(t0 === 'settings' && MOBILE_Q.matches)) activeTab = t0; // no telemóvel, as Definições começam fechadas
  renderAll(); histInit();
  $('#undoBtn').addEventListener('click', undo); $('#redoBtn').addEventListener('click', redo);
  purgeOrphanFiles().catch(() => {}); initApp();
});
