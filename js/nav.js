'use strict';
/* ===== Navegação, botão Criar e vista em Lista da Narrativa =====
   PC e tablet: barra lateral com o botão Criar e as oito áreas.
   Telemóvel: cinco destinos — Narrativa, Plano, Elementos, Referências e Mais —, em baixo com o telemóvel ao alto e
   à esquerda com ele deitado. As áreas continuam a ser os separadores de sempre (activeTab): só muda onde aparecem. */

/* ícones: a mesma família dos da barra de topo (24 × 24, traço de 1,8, pontas redondas) */
const ICONS = {
  board:'<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M9 9.5V20"/>',
  plan:'<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  book:'<path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V4a1 1 0 0 1 1-1z"/><path d="M5 17.5A2.5 2.5 0 0 1 7.5 15H19"/>',
  arc:'<circle cx="5" cy="7" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="19" cy="17" r="2"/><path d="M7 7h10M10 7c1.5 6 3 10 7 10"/>',
  people:'<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c0-3.2 2.7-5.5 6-5.5s6 2.3 6 5.5M16 5.6a3.2 3.2 0 0 1 0 5.8M17.6 14.4c2 .8 3.4 2.6 3.4 5.1"/>',
  pin:'<path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  mark:'<path d="M6.5 4h11a.5.5 0 0 1 .5.5V21l-6-4-6 4V4.5a.5.5 0 0 1 .5-.5z"/>',
  bulb:'<path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-4 10.5c.9.8 1.3 1.6 1.4 2.5h5.2c.1-.9.5-1.7 1.4-2.5A6 6 0 0 0 12 3z"/>',
  layers:'<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  more:'<path d="M5.5 12h.01M12 12h.01M18.5 12h.01" stroke-width="2.8"/>',
  dots:'<path d="M12 5.5h.01M12 12h.01M12 18.5h.01" stroke-width="2.8"/>',
  pen:'<path d="M4 20l1.2-4.4L16.6 4.2a2 2 0 0 1 2.9 0l.3.3a2 2 0 0 1 0 2.9L8.4 18.8z"/><path d="M14.5 6.5l3 3"/>',
  scene:'<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M7 10.5h8M7 13.5h5"/>',
  chapter:'<path d="M4 7h16M4 12h16M4 17h10"/>',
  note:'<path d="M6 3h8.5L19 7.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  flag:'<path d="M6 21V4h11l-2 3.5L17 11H6"/>',
  list:'<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke-width="2.8"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  /* setas para percorrer as Cenas: a mesma família, com haste e ponta — em frente, bifurcação (uma linha que se divide) e convergência (duas que se juntam) */
  arrL:'<path d="M20 12H5M9.5 7.5L5 12l4.5 4.5"/>', arrR:'<path d="M4 12h15M14.5 7.5L19 12l-4.5 4.5"/>',
  forkR:'<path d="M3 12h4.5c3.5 0 3-5.5 6.5-5.5h5.5M7.5 12c3.5 0 3 5.5 6.5 5.5h5.5M16.8 3.8l2.7 2.7-2.7 2.7M16.8 14.8l2.7 2.7-2.7 2.7"/>',
  forkL:'<path d="M21 12h-4.5c-3.5 0-3-5.5-6.5-5.5H4.5M16.5 12c-3.5 0-3 5.5-6.5 5.5H4.5M7.2 3.8L4.5 6.5l2.7 2.7M7.2 14.8l-2.7 2.7 2.7 2.7"/>',
  mergeR:'<path d="M3 6.5h3.5c3.5 0 3 5.5 6.5 5.5h7M3 17.5h3.5c3.5 0 3-5.5 6.5-5.5M15.5 7.5L20 12l-4.5 4.5"/>',
  mergeL:'<path d="M21 6.5h-3.5c-3.5 0-3 5.5-6.5 5.5H4M21 17.5h-3.5c-3.5 0-3-5.5-6.5-5.5M8.5 7.5L4 12l4.5 4.5"/>',
  shield:'<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z"/><path d="M8.8 12.2l2.3 2.3 4.2-4.5"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  check2:'<path d="M2.5 12.5l4.5 4.5L16 8M12 16.5l.6.5L22 8"/>',
  circle:'<circle cx="12" cy="12" r="7.5"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.8M12 17h.01"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
};
const svgIcon = (k, cls) => h('span', {class:'nic' + (cls ? ' ' + cls : ''), 'aria-hidden':'true', innerHTML:'<svg viewBox="0 0 24 24">' + ICONS[k] + '</svg>'});

/* ---------- áreas ---------- */
const NAV_FULL = [['board', _('Narrativa'), 'board'], ['plan', _('Plano'), 'plan'], '-', ['books', _('Tomos'), 'book'], ['arcs', _('Arcos Narrativos'), 'arc', _('Arcos')], ['characters', _('Personagens'), 'people'],
  ['sceneries', _('Cenários'), 'pin'], '-', ['refs', _('Referências'), 'mark'], ['support', _('Apoio'), 'bulb']];
const NAV_COMPACT = [['board', _('Narrativa'), 'board'], ['plan', _('Plano'), 'plan'], ['elements', _('Elementos'), 'layers'], ['refs', _('Referências'), 'mark'], ['more', _('Mais'), 'more']];
const ELEMENT_TABS = ['books', 'arcs', 'characters', 'sceneries'];
/* telemóvel ao alto (ou janela estreita e alta): barra em baixo; telemóvel deitado: barra lateral com os cinco destinos */
const BNAV_Q = matchMedia('(max-width:699px) and (orientation:portrait)');
const navMode = () => BNAV_Q.matches ? 'bottom' : MOBILE_Q.matches ? 'compact' : 'rail';
const Nav = { built:null, lastElement:'books' };
const navDest = (tab, mode) => mode === 'rail' ? tab : ELEMENT_TABS.includes(tab) ? 'elements' : tab === 'support' || tab === 'settings' ? 'more' : tab;

function renderNav(shown){
  const mode = navMode(), rail = $('#rail'), bnav = $('#bnav'); if (!rail || !bnav) return;
  document.body.dataset.nav = mode; document.body.classList.toggle('bnav-on', mode === 'bottom');
  if (ELEMENT_TABS.includes(shown)) Nav.lastElement = shown;
  if (Nav.built !== mode){ // só se refaz quando muda a forma (assim o foco do teclado não se perde a cada clique)
    Nav.built = mode; rail.innerHTML = ''; bnav.innerHTML = '';
    const item = it => it === '-' ? h('div', {class:'rail-sep', role:'separator'})
      : h('button', {class:'nav-item', dataset:{tab:it[0]}, 'aria-label':it[3] ? it[1] : null, title:it[3] ? it[1] : null, onclick:e => navGo(it[0], e.currentTarget)}, svgIcon(it[2], 'nav-pill'), h('span', {class:'nav-label'}, it[3] || it[1])); // rótulo curto na barra, nome completo para leitores de ecrã
    if (mode !== 'bottom') rail.append(h('button', {id:'createBtn', class:'rail-create', 'aria-haspopup':'menu', 'aria-expanded':'false', 'aria-label':_('Criar'),
      onclick:e => createMenu(e.currentTarget)}, svgIcon('pen', 'rail-fab'), h('span', {class:'rail-cap', 'aria-hidden':'true'}, _('Criar'))));
    (mode === 'bottom' ? bnav : rail).append(...(mode === 'rail' ? NAV_FULL : NAV_COMPACT).map(item));
  }
  const dest = navDest(shown, mode);
  document.querySelectorAll('#rail .nav-item, #bnav .nav-item').forEach(x => { if (x.dataset.tab === dest) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current'); });
  const g = $('#setBtn'); if (g){ const on = activeTab === 'settings'; g.classList.toggle('on', on); g.setAttribute('aria-pressed', String(on)); }
}
function navGo(k, btn){
  if (tourMode) return;
  if (k === 'elements') return setTab(ELEMENT_TABS.includes(activeTab) ? activeTab : Nav.lastElement);
  if (k === 'more') return moreSheet();
  setTab(k);
}
/* Elementos (telemóvel): Books, Story Arcs, Characters e Sceneries num seletor no topo da página */
function elementTabs(tab){
  return h('div', {class:'el-tabs', role:'tablist', 'aria-label':_('Elementos')}, ELEMENT_TABS.map(k => h('button', {class:k === tab ? 'on' : '', role:'tab', 'aria-selected':String(k === tab), dataset:{tab:k},
    onclick:() => setTab(k)}, TABS.find(t => t[0] === k)[1])));
}

/* ---------- folhas (telemóvel): uma janela que sobe do fundo do ecrã ---------- */
function openSheet(title, content, cls){ return openModal({title, body:h('div', {class:'modal-body sheet-body'}, content), cls:'sheet' + (cls ? ' ' + cls : '')}); }
function moreSheet(){
  if (tourMode) return;
  let m = null;
  const row = (k, label, ic, fn) => h('button', {class:'sheet-row', dataset:{k}, onclick:() => { m.close(); fn(); }}, svgIcon(ic), h('span', null, label));
  m = openSheet(_('Mais'), h('div', {class:'sheet-list'},
    row('support', _('Materiais de Apoio'), 'bulb', () => setTab('support')),
    row('settings', _('Definições do Projeto'), 'gear', () => setTab('settings')),
    row('tour', _('Visita guiada'), 'help', () => startTour()),
    row('deep', _('Visita detalhada'), 'help', () => startTour('deep'))), 'more-sheet');
}

/* ---------- barra de topo: ajuda, definições e (no telemóvel) o menu ⋮ ---------- */
function topMenu(btn, items, cls){
  const r = btn.getBoundingClientRect();
  showMenu(r.right, r.bottom + 4, items);
  const menu = document.querySelector('.ctx-menu'); if (!menu) return;
  menu.classList.add(cls); btn.setAttribute('aria-expanded', 'true');
  menu.onClose = () => { btn.setAttribute('aria-expanded', 'false'); if (!document.activeElement || document.activeElement === document.body) btn.focus({preventScroll:true}); };
  const first = menu.querySelector('.ctx-item:not(:disabled)'); first && first.focus({preventScroll:true});
}
/* o mesmo clique que fecha um destes menus não o volta a abrir (o menu fecha-se ao premir, antes do clique) */
const wasOpen = btn => { const w = btn._wasOpen && performance.now() - btn._downAt < 1500; btn._wasOpen = false; return w; };
window.addEventListener('pointerdown', e => { const b = e.target.closest && e.target.closest('#tourBtn,#moreBtn,#createBtn,#langBtn');
  if (b){ b._wasOpen = b.getAttribute('aria-expanded') === 'true'; b._downAt = performance.now(); } }, true);
function helpMenu(btn){ if (Tour.active || wasOpen(btn)) return; topMenu(btn, [{label:_('Visita guiada'), action:() => startTour()}, {label:_('Visita detalhada'), action:() => startTour('deep')}], 'help-menu'); }
function moreMenu(btn){
  if (tourMode || wasOpen(btn)) return;
  const items = [{label:_('Novo Projeto'), action:newProject}, {label:_('Abrir Projeto…'), action:pickProjectFile}, {label:_('Guardar Projeto'), action:() => exportProject()},
    {label:_('Fechar Projeto'), action:() => closeProject()}, '-', {label:_('Anular'), disabled:!Hist.undo.length, action:undo}, {label:_('Refazer'), disabled:!Hist.redo.length, action:redo}];
  if (!$('#installBtn').hidden) items.push('-', {label:_('Instalar como app'), action:saveAsApp});
  topMenu(btn, items, 'more-menu');
}
function settingsClick(){ if (tourMode) return; if (activeTab === 'settings') closeDrawer(); else setTab('settings'); } // outro clique volta à área em que estava

/* ---------- Criar ---------- */
const CREATE = [['scene', _('Cena'), 'scene'], ['chapter', _('Capítulo'), 'chapter'], ['book', _('Tomo'), 'book'], ['arc', _('Arco Narrativo'), 'arc'], ['character', _('Personagem'), 'people'],
  ['scenery', _('Cenário'), 'pin'], ['note', _('Nota'), 'note'], ['ref', _('Referência'), 'mark'], ['goal', _('Objetivo de pesquisa'), 'flag']];
function createMenu(btn){
  if (tourMode || projNone() || wasOpen(btn)) return;
  if (coarse()) return createSheet(); // num ecrã tátil, uma folha com alvos grandes
  const r = btn.getBoundingClientRect();
  const it = c => ({label:h('span', {class:'mi', dataset:{k:c[0]}}, svgIcon(c[2]), h('span', null, c[1])), action:() => doCreate(c[0])});
  showMenu(r.right + 6, r.top, [...CREATE.slice(0, 6).map(it), '-', ...CREATE.slice(6).map(it)]);
  const menu = document.querySelector('.ctx-menu'); if (!menu) return;
  menu.classList.add('create-menu'); btn.setAttribute('aria-expanded', 'true');
  menu.onClose = () => btn.setAttribute('aria-expanded', 'false');
  const first = menu.querySelector('.ctx-item'); first && first.focus({preventScroll:true});
}
function createSheet(){
  if (tourMode || projNone()) return;
  let m = null;
  const order = ['note', 'scene', 'chapter', 'book', 'arc', 'character', 'scenery', 'ref', 'goal']; // a Note primeiro: para não perder uma ideia
  m = openSheet(_('Criar'), h('div', {class:'create-grid'}, order.map(k => { const c = CREATE.find(x => x[0] === k);
    return h('button', {class:'cg-item' + (k === 'note' ? ' first' : ''), dataset:{k}, onclick:() => { m.close(); doCreate(k); }}, svgIcon(c[2], 'cg-ic'), h('span', {class:'cg-l'}, c[1])); })), 'create-sheet');
}
function doCreate(k){
  if (tourMode || projNone()) return;
  ({ scene:() => newSceneDialog(), chapter:() => newChapterDialog(),
    book:() => { const b = addBook(); openBookFicha(b.id, true); },
    arc:async () => { const a = await promptNewArc(); if (a) openArcFicha(a.id); },
    character:() => { const c = newCharacter(); commit(); openCharFicha(c.id, true); },
    scenery:() => { const x = newScenery(); commit(); openSceneryFicha(x.id, true); },
    note:quickNote, ref:() => newRefDialog(null), goal:() => createGoal() })[k]();
}
/* Nova Scene: título, Chapter e Story Arc numa janela pequena */
function newSceneDialog(pre){
  pre = pre || {};
  const chs = []; state.books.forEach(b => b.chapters.forEach((c, ci) => chs.push({value:c.id, label:`${b.name || _('Sem nome')} › ${ci + 1}. ${c.name || _('Sem título')}`})));
  if (!chs.length) return toast(_('Primeiro crie um Capítulo: no botão Criar, escolha «Capítulo».'));
  const NEW = '+novo';
  const order = narrOrder(), last = order.length ? state.scenes[order[order.length - 1]] : null, lastPos = last && findScenePos(last.id);
  const chId0 = pre.chId && findChapter(pre.chId) ? pre.chId : lastPos ? lastPos.chapter.id : chs[0].value;
  // o Story Arc proposto: o da última Scene desse Chapter (ou, se não tiver, o da última Scene do projeto)
  const arcFor = chId => { const ids = findChapter(chId).chapter.scenes, s = ids.length ? state.scenes[ids[ids.length - 1]] : last;
    return s && arcById(s.arcId) ? s.arcId : state.arcs.length ? orderedArcs()[0].arc.id : NEW; };
  let arcTouched = false, m = null;
  const title = h('input', {class:'inp', placeholder:_('Sem título')});
  const arcSel = selectEl([...orderedArcs().map(l => ({value:l.arc.id, label:(l.depth ? '↳ ' : '') + l.arc.name})), {value:NEW, label:_('+ Novo Arco Narrativo…')}], arcFor(chId0), () => { arcTouched = true; syncArc(); });
  const chSel = selectEl(chs, chId0, v => { if (!arcTouched){ arcSel.value = arcFor(v); syncArc(); } });
  const arcName = h('input', {class:'inp', placeholder:_('Nome do novo Arco Narrativo')});
  const arcNameF = field(_('Nome do novo Arco Narrativo'), arcName);
  const syncArc = () => { arcNameF.hidden = arcSel.value !== NEW; };
  const create = more => {
    let arcId = arcSel.value;
    if (arcId === NEW){ const n = arcName.value.trim(); if (!n) return arcName.focus(); arcId = newArc(n).id; }
    const f = findChapter(chSel.value); if (!f) return;
    const s = insertScene(f.chapter.id, f.chapter.scenes.length, arcId); s.title = title.value.trim();
    m.close(); commit();
    if (more) openSceneFicha(s.id);
    else { toast(_('Cena «{nome}» criada no fim de «{cap}».', {nome:s.title || _('Sem título'), cap:f.chapter.name})); revealScene(s.id); }
  };
  for (const i of [title, arcName]) i.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); create(false); } });
  m = openModal({title:_('Nova Cena'), body:h('div', {class:'modal-body'}, field(_('Título'), title), field(_('Capítulo'), chSel), field(_('Arco Narrativo'), arcSel), arcNameF,
    h('p', {class:'muted small', style:{margin:'0'}}, _('A Cena fica no fim do Capítulo. No quadro, pode depois arrastá-la para outro lugar.')),
    h('div', {class:'modal-foot'}, h('button', {class:'btn', onclick:() => m.close()}, _('Cancelar')), h('button', {class:'btn', onclick:() => create(true)}, _('Mais opções')),
      h('button', {class:'btn primary', onclick:() => create(false)}, _('Criar'))))});
  syncArc(); title.focus();
}
function newChapterDialog(pre){
  pre = pre || {};
  if (!state.books.length){ const b = addBook(); return toast(_('Criado o Tomo «{nome}», já com um Capítulo.', {nome:b.name})); }
  let m = null;
  const name = h('input', {class:'inp', value:_('Novo Capítulo')});
  const bookSel = selectEl(state.books.map((b, i) => ({value:b.id, label:_('Tomo {n}', {n:i + 1}) + ' · ' + (b.name || _('Sem nome'))})), pre.bookId && bookById(pre.bookId) ? pre.bookId : state.books[state.books.length - 1].id, () => {});
  const create = () => { const b = bookById(bookSel.value); if (!b) return; const c = {id:uid('c'), name:name.value.trim() || _('Novo Capítulo'), scenes:[]};
    b.chapters.push(c); m.close(); commit(); toast(_('Capítulo «{nome}» criado no fim do Tomo «{tomo}».', {nome:c.name, tomo:b.name})); revealChapter(c.id); };
  name.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); create(); } });
  m = openModal({title:_('Novo Capítulo'), body:h('div', {class:'modal-body'}, field(_('Nome'), name), state.books.length > 1 ? field(_('Tomo'), bookSel) : null,
    h('div', {class:'modal-foot'}, h('button', {class:'btn', onclick:() => m.close()}, _('Cancelar')), h('button', {class:'btn primary', onclick:create}, _('Criar'))))});
  name.focus(); name.select();
}
/* mostra no quadro (ou na lista) o que acabou de ser criado */
function flash(el){ el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1700); }
function revealScene(id){
  if (activeTab !== 'board') return;
  requestAnimationFrame(() => {
    if (narrView() === 'list'){ const r = document.querySelector(`.nl-row[data-scene="${id}"]`); if (r){ r.scrollIntoView({block:'nearest'}); flash(r); } return; }
    const c = target['s:' + id], el = els['s:' + id] && els['s:' + id][0]; if (!c || !el) return;
    const sc = $('#board-scroll'); sc.scrollTo({left:Math.max(0, c.x - (sc.clientWidth + B.GUT - B.SW) / 2), top:Math.max(0, c.y - (sc.clientHeight - HEAD_H - B.SH) / 2), behavior:'smooth'}); flash(el);
  });
}
function revealChapter(id){
  if (activeTab !== 'board') return;
  requestAnimationFrame(() => {
    if (narrView() === 'list'){ const r = document.querySelector(`.nl-chead[data-chapter="${id}"]`); if (r){ r.scrollIntoView({block:'nearest'}); flash(r); } return; }
    const c = target['c:' + id], el = els['c:' + id] && els['c:' + id][0]; if (!c || !el) return;
    const sc = $('#board-scroll'); sc.scrollTo({left:Math.max(0, c.x - B.GUT - 24), behavior:'smooth'}); flash(el);
  });
}

/* ---------- Narrativa em Lista (telemóvel ao alto): Books › Chapters › Scenes, pela Ordem Narrativa ---------- */
const Narr = { view:null }; // null: automático — Lista com o telemóvel ao alto, Quadro deitado
function narrView(){
  if (navMode() === 'rail') return 'board';
  if (typeof Tour !== 'undefined' && Tour.active) return Narr.tourList ? 'list' : 'board'; // a visita mostra o quadro (e a lista no passo dela)
  return Narr.view || (navMode() === 'bottom' ? 'list' : 'board');
}
function viewToggle(compact){
  const v = narrView();
  const b = (k, label, ic) => h('button', {'aria-pressed':String(v === k), 'aria-label':compact ? label : null, dataset:{view:k}, onclick:() => { Narr.view = k; renderAll(); }},
    svgIcon(ic), compact ? null : h('span', {class:'vt-l'}, label));
  return h('div', {class:'view-toggle' + (compact ? ' compact' : ''), role:'group', 'aria-label':_('Vista da Narrativa')}, b('list', _('Lista'), 'list'), b('board', _('Quadro'), 'board'));
}
function narrUI(){
  const list = narrView() === 'list', sc = $('#board-scroll'), nl = $('#narrList'); if (!sc || !nl) return;
  sc.hidden = list; nl.hidden = !list;
  const cn = $('#headLayer .corner'); if (cn){ const old = cn.querySelector('.view-toggle'); if (old) old.remove(); if (navMode() !== 'rail') cn.prepend(viewToggle(true)); }
  if (list) renderNarrList(nl); else nl.innerHTML = '';
}
function renderNarrList(nl){
  const st = nl.scrollTop, nm = narrIndexMap(), fr = frontiers(); nl.innerHTML = '';
  nl.append(h('div', {class:'nl-top'}, viewToggle(false)));
  state.books.forEach((b, bi) => {
    const p = progOf(bookScenes(b), 'write'), sec = h('section', {class:'nl-book', dataset:{book:b.id}});
    if (b.color) sec.style.setProperty('--book', b.color);
    sec.append(h('div', {class:'nl-bhead'}, b.color ? h('span', {class:'nl-bdot', 'aria-hidden':'true'}) : null,
      h('button', {class:'nl-bname', onclick:() => openBookFicha(b.id)}, h('span', {class:'nl-bk'}, _('Tomo {n}', {n:bi + 1}) + ' · '), b.name || _('Sem nome')),
      p.total ? h('span', {class:'nl-bprog'}, _n(p.total, '{done} de {n} escrita', '{done} de {n} escritas', {done:p.done})) : null,
      h('button', {class:'icon-btn nl-more', 'aria-label':_('Opções do Tomo'), onclick:e => bookListMenu(b.id, e.currentTarget)}, svgIcon('dots'))));
    b.chapters.forEach((c, ci) => {
      sec.append(h('div', {class:'nl-chead', dataset:{chapter:c.id}}, h('span', {class:'ch-num'}, ci + 1), h('span', {class:'nl-cname'}, c.name || _('Sem título')),
        h('button', {class:'icon-btn nl-add', 'aria-label':_('Nova Cena neste Capítulo'), onclick:() => newSceneDialog({chId:c.id})}, svgIcon('plus')),
        h('button', {class:'icon-btn nl-more', 'aria-label':_('Opções do Capítulo'), onclick:e => chapterListMenu(c.id, e.currentTarget)}, svgIcon('dots'))));
      c.scenes.forEach(sid => { const s = state.scenes[sid]; if (!s) return;
        fr.filter(f => f.id === sid).forEach(f => sec.append(h('div', {class:'nl-frontier fr-' + f.k, role:'separator', 'aria-label':f.label}, f.label)));
        sec.append(narrRow(s, nm)); });
      if (!c.scenes.length) sec.append(h('button', {class:'nl-empty', onclick:() => newSceneDialog({chId:c.id})}, svgIcon('plus'), h('span', null, _('Nova Cena neste Capítulo'))));
    });
    if (!b.chapters.length) sec.append(h('button', {class:'nl-empty', onclick:() => newChapterDialog({bookId:b.id})}, svgIcon('plus'), h('span', null, _('Novo Capítulo neste Tomo'))));
    nl.append(sec);
  });
  nl.append(h('button', {class:'nl-empty nl-addbook', onclick:() => { const b = addBook(); toast(_('Tomo «{nome}» criado, já com um Capítulo.', {nome:b.name})); }}, svgIcon('plus'), h('span', null, _('Novo Tomo'))));
  nl.scrollTop = st;
}
function narrRow(s, nm){
  const arc = arcById(s.arcId), pov = s.pov && charById(s.pov), places = s.sceneries.map(sceneryById).filter(Boolean).map(x => x.name);
  const w = isDone(s, 'write'), r = isDone(s, 'review'), stTxt = r ? _('Revista') : w ? _x('estado', 'Escrita') : _('Por escrever');
  const sub = [pov ? _('POV {nome}', {nome:pov.name}) : null, ...places].filter(Boolean).join(' · ') || (arc ? arc.name : '');
  const row = h('button', {class:'nl-row' + (pickLink === s.id ? ' link-from' : ''), dataset:{scene:s.id},
    'aria-label':_('{n}. {nome}. Arco Narrativo: {arco}. {estado}.', {n:nm[s.id] + 1, nome:s.title || _('Sem título'), arco:arc ? arc.name : '—', estado:stTxt})},
    h('i', {class:'nl-mark', 'aria-hidden':'true'}), h('span', {class:'nl-tx'}, h('b', null, s.title || _('Sem título')), h('small', null, sub)),
    h('span', {class:'nl-st' + (r ? ' rv' : w ? ' wr' : ''), 'aria-hidden':'true', dataset:{st:stTxt}}, svgIcon(r ? 'check2' : w ? 'check' : 'circle')));
  row.style.setProperty('--arc', arcStroke(arc));
  wireRow(row, s.id);
  return row;
}
/* toque: abre a ficha; toque longo ou botão direito: o menu da Scene (o mesmo do quadro) */
function wireRow(row, id){
  let t = null, x0 = 0, y0 = 0, fired = false;
  row.addEventListener('pointerdown', e => { fired = false; if (e.pointerType === 'mouse') return; x0 = e.clientX; y0 = e.clientY; clearTimeout(t);
    t = setTimeout(() => { t = null; fired = true; buzz(); suppressUntil = performance.now() + 700; sceneListMenu(id, x0, y0); }, 450); });
  row.addEventListener('pointermove', e => { if (t && Math.hypot(e.clientX - x0, e.clientY - y0) > 8){ clearTimeout(t); t = null; } });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) row.addEventListener(ev, () => { clearTimeout(t); t = null; });
  row.addEventListener('contextmenu', e => { e.preventDefault(); if (!fired) sceneListMenu(id, e.clientX, e.clientY); });
  row.addEventListener('click', () => { if (fired || performance.now() < suppressUntil){ fired = false; return; } listPick(id); });
}
function listPick(id){
  if (pickLink){ const a = state.scenes[pickLink], b = state.scenes[id]; endPickLink();
    if (a && b && b.arcId !== a.arcId) confirmLink(a, b); else toast(_('A convergência tem de ser numa Cena de outro Arco Narrativo.')); return; }
  openSceneFicha(id);
}
function sceneListMenu(id, x, y){
  const s = state.scenes[id]; if (!s || tourMode) return;
  showMenu(x, y, [{heading:s.title || _('Sem título')}, ...sceneMenuItems(s)]);
}
function chapterListMenu(id, btn){
  const f = findChapter(id); if (!f || tourMode) return; const r = btn.getBoundingClientRect();
  showMenu(r.right, r.bottom + 2, [{heading:f.chapter.name || _('Sem título')},
    {label:_('Nova Cena neste Capítulo'), action:() => newSceneDialog({chId:id})},
    {label:_('Renomear Capítulo'), action:async () => { const v = await promptDialog(_('Renomear Capítulo'), _('Nome do Capítulo'), f.chapter.name); if (v){ f.chapter.name = v; commit(); } }}, '-',
    {label:_('Eliminar Capítulo'), action:() => askDeleteChapter(id)}]);
}
function bookListMenu(id, btn){
  const b = bookById(id); if (!b || tourMode) return; const r = btn.getBoundingClientRect();
  showMenu(r.right, r.bottom + 2, [{heading:b.name || _('Sem nome')}, {label:_('Abrir ficha do Tomo'), action:() => openBookFicha(id)},
    {label:_('Novo Capítulo'), action:() => newChapterDialog({bookId:id})}, '-', {label:_('Eliminar Tomo'), action:() => askDeleteBook(id)}]);
}

BNAV_Q.addEventListener('change', () => { Narr.view = null; if (state) renderAll(); }); // rodar o telemóvel volta à vista automática
window.addEventListener('DOMContentLoaded', () => {
  $('#tourBtn').addEventListener('click', e => helpMenu(e.currentTarget));
  $('#setBtn').addEventListener('click', settingsClick);
  $('#moreBtn').addEventListener('click', e => moreMenu(e.currentTarget));
});
