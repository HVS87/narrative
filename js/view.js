'use strict';
/* ===== O que se vê no quadro: barra do quadro (filtros e vistas), ampliação, mini-mapa e ficha ao lado =====
   Nada aqui altera o projeto. A ampliação, a vista e «ficha ao lado» ficam guardadas neste dispositivo;
   os filtros e os Arcos Narrativos recolhidos duram enquanto a ferramenta está aberta (um conjunto por projeto). */
const LS_ZOOM = 'narrativa.zoom', LS_DENS = 'narrativa.vista', LS_DOCK = 'narrativa.fichaAoLado';
const DENS = { normal:{SW:140, SH:56, SG:24, LANE:86, LO:10}, compact:{SW:112, SH:28, SG:14, LANE:48, LO:5} };
const ViewPref = { zoom:Math.min(1.6, Math.max(.3, parseFloat(lsGet(LS_ZOOM)) || 1)), dens:lsGet(LS_DENS) === 'compact' ? 'compact' : 'normal' };
/* a vista compacta e a ampliação são do PC (barra lateral): no telemóvel e na visita, o quadro tem sempre o tamanho normal */
const viewFull = () => navMode() === 'rail' && !tourMode && !(typeof Tour !== 'undefined' && Tour.active);
function viewBefore(){
  const full = viewFull(); View.zoom = full ? ViewPref.zoom : 1; View.dens = full ? ViewPref.dens : 'normal';
  Object.assign(B, DENS[View.dens]); document.body.classList.toggle('dens-compact', View.dens === 'compact');
  const b = $('#board'); if (!b) return;
  b.style.zoom = View.zoom === 1 ? '' : String(View.zoom);
  b.style.setProperty('--sw', B.SW + 'px'); b.style.setProperty('--sh', B.SH + 'px'); b.style.setProperty('--lo', B.LO + 'px');
}
function setZoom(z, quiet){
  z = Math.round(Math.min(1.6, Math.max(.3, z)) * 20) / 20; if (!viewFull()) return;
  const sc = $('#board-scroll'), mid = sc ? (sc.scrollLeft + sc.clientWidth / 2) / Z() : 0;
  ViewPref.zoom = z; lsSet(LS_ZOOM, String(z)); viewBefore(); fitBoard(); drawLines();
  if (sc) sc.scrollLeft = Math.max(0, mid * z - sc.clientWidth / 2); // o que estava a meio do ecrã continua a meio
  zoomUI(); miniMap(); if (!quiet) hideHover();
}
/* «Ajustar»: a narrativa inteira à largura da janela */
function zoomFit(){ const sc = $('#board-scroll'); if (!sc || !L) return; setZoom(Math.min(1, Math.floor(sc.clientWidth / L.width * 20) / 20)); sc.scrollLeft = 0; miniMap(); }
function setDens(k){ ViewPref.dens = k === 'compact' ? 'compact' : 'normal'; lsSet(LS_DENS, ViewPref.dens); }
function setNarrView(k){ // 'board' (Quadro), 'compact' (Compacta) ou 'list' (Lista)
  if (tourMode) return;
  if (k === 'list') Narr.view = 'list'; else { Narr.view = 'board'; setDens(k === 'compact' ? 'compact' : 'normal'); }
  for (const key in cur) delete cur[key]; // as Cenas mudam de tamanho: não se anima de uma vista para a outra
  renderAll();
}
const narrViewKey = () => narrView() === 'list' ? 'list' : View.dens === 'compact' ? 'compact' : 'board';

/* ---------- estado de uma Cena, no cartão: um clique avança (por escrever → escrita → revista → por escrever) ---------- */
function cycleStage(id){
  const s = state.scenes[id]; if (!s || tourMode) return;
  if (!isDone(s, 'write')) setStage(id, 'write', true); else if (!isDone(s, 'review')) setStage(id, 'review', true); else setStage(id, 'write', false);
}
function toggleArcShown(id){ if (tourMode) return; const hid = viewFor().hidden; if (hid.has(id)) hid.delete(id); else hid.add(id); renderAll(); }

/* ---------- filtros: as Cenas que correspondem ficam em destaque; as outras esbatem-se, sem sair do lugar ---------- */
const ST_FILTERS = [['todo', _('Por escrever')], ['written', _('Escritas, por rever')], ['reviewed', _('Revistas')]];
function activeFilters(){
  const f = viewFor().f;
  if (f.char && !charById(f.char)) f.char = null; if (f.pov && !charById(f.pov)) f.pov = null; if (f.scenery && !sceneryById(f.scenery)) f.scenery = null;
  return f;
}
const filterOn = f => !!(f.char || f.pov || f.scenery || f.st);
function sceneMatch(s, f){
  if (f.char && !(s.chars.includes(f.char) || s.pov === f.char)) return false;
  if (f.pov && s.pov !== f.pov) return false;
  if (f.scenery && !s.sceneries.includes(f.scenery)) return false;
  if (f.st){ const w = isDone(s, 'write'), r = isDone(s, 'review'); if (f.st === 'todo' && w) return false; if (f.st === 'written' && !(w && !r)) return false; if (f.st === 'reviewed' && !r) return false; }
  return true;
}
function applyFilters(){
  const f = activeFilters(), on = filterOn(f);
  document.querySelectorAll('#bodyLayer .scene, #narrList .nl-row').forEach(el => { const s = state.scenes[el.dataset.scene]; el.classList.toggle('dim', on && !!s && !sceneMatch(s, f)); });
}
function pickOne(title, label, items, cb){
  const inp = h('input', {class:'inp', placeholder:label});
  const m = openModal({title, body:h('div', {class:'modal-body'}, field(label, inp))});
  autocomplete(inp, () => items, it => { m.close(); cb(it.id); }, {empty:_('Sem resultados')});
  inp.focus();
}
function setFilter(k, v){ if (tourMode) return; viewFor().f[k] = v || null; renderAll(); }
function clearFilters(){ const v = viewFor(); v.f = {}; v.hidden.clear(); renderAll(); }
function filterMenu(btn){
  if (tourMode || wasOpen(btn)) return;
  const f = activeFilters(), v = viewFor(), r = btn.getBoundingClientRect();
  const chars = () => state.characters.map(c => ({id:c.id, label:c.name})), povs = () => state.characters.filter(c => Object.values(state.scenes).some(s => s.pov === c.id)).map(c => ({id:c.id, label:c.name}));
  const items = [
    {label:_('Personagem…'), disabled:!state.characters.length, action:() => pickOne(_('Filtrar por Personagem'), _('Pesquisar Personagens…'), chars(), id => setFilter('char', id))},
    {label:_('Personagem POV…'), disabled:!povs().length, action:() => pickOne(_('Filtrar por Personagem POV'), _('Pesquisar Personagens…'), povs(), id => setFilter('pov', id))},
    {label:_('Localização…'), disabled:!state.sceneries.length, action:() => pickOne(_('Filtrar por Localização'), _('Pesquisar Localizações…'), state.sceneries.map(x => ({id:x.id, label:x.name})), id => setFilter('scenery', id))},
    '-', {heading:_('Estado')}, ...ST_FILTERS.map(([k, l]) => ({label:(f.st === k ? '✓ ' : '') + l, action:() => setFilter('st', f.st === k ? null : k)}))];
  if (filterOn(f) || v.hidden.size) items.push('-', {label:_('Limpar filtros e mostrar tudo'), action:clearFilters});
  topMenu(btn, items, 'filter-menu');
}
/* a barra por cima do quadro (e da Lista): filtros à esquerda, vistas à direita */
function boardBarUI(){
  const bar = $('#boardBar'); if (!bar) return;
  const touring = tourMode || (typeof Tour !== 'undefined' && Tour.active);
  bar.hidden = false; // na visita, a barra mostra-se (sem filtros ativos) para poder ser explicada
  const v = viewFor(), f = activeFilters(), on = filterOn(f), rail = navMode() === 'rail', open = bar.querySelector('#filterBtn[aria-expanded="true"]');
  if (open) return applyFilters(); // com o menu aberto, a barra não é redesenhada (o botão é a âncora do menu)
  const chip = (text, clear, label) => h('span', {class:'chip f-chip'}, text, h('button', {class:'chip-x', 'aria-label':label || _('Retirar este filtro'), onclick:clear}, '✕'));
  const name = (x, def) => x ? x.name : def;
  const chips = [];
  if (f.char) chips.push(chip(_('Personagem: {nome}', {nome:name(charById(f.char), '?')}), () => setFilter('char', null)));
  if (f.pov) chips.push(chip(_('POV: {nome}', {nome:name(charById(f.pov), '?')}), () => setFilter('pov', null)));
  if (f.scenery) chips.push(chip(_('Localização: {nome}', {nome:name(sceneryById(f.scenery), '?')}), () => setFilter('scenery', null)));
  if (f.st) chips.push(chip(_('Estado: {estado}', {estado:(ST_FILTERS.find(x => x[0] === f.st) || [])[1]}), () => setFilter('st', null)));
  if (v.hidden.size) chips.push(chip(_n(v.hidden.size, '{n} Arco recolhido', '{n} Arcos recolhidos'), () => { v.hidden.clear(); renderAll(); }, _('Mostrar todos os Arcos Narrativos')));
  const all = allScenes(), n = on ? all.filter(s => sceneMatch(s, f)).length : 0, key = narrViewKey();
  const vb = (k, label, ic) => h('button', {'aria-pressed':String(key === k), dataset:{v:k}, onclick:() => setNarrView(k)}, svgIcon(ic), h('span', {class:'vt-l'}, label));
  bar.replaceChildren(...[
    h('button', {id:'filterBtn', class:'bar-btn' + (on ? ' on' : ''), 'aria-haspopup':'menu', 'aria-expanded':'false', onclick:e => filterMenu(e.currentTarget)}, svgIcon('filter'), h('span', null, _('Filtrar'))),
    ...chips,
    on ? h('span', {class:'f-count muted small', role:'status'}, _('{n} de {total} Cenas', {n, total:all.length})) : null,
    h('span', {class:'spacer'}),
    rail ? h('div', {class:'view-seg', role:'group', 'aria-label':_('Vista da Narrativa')}, vb('board', _('Quadro'), 'board'), vb('compact', _('Compacta'), 'grid'), vb('list', _('Lista'), 'list')) : null].filter(Boolean));
  applyFilters(); zoomUI(); miniMap();
}
window.addEventListener('pointerdown', e => { const b = e.target.closest && e.target.closest('#filterBtn'); if (b){ b._wasOpen = b.getAttribute('aria-expanded') === 'true'; b._downAt = performance.now(); } }, true);

/* ---------- ampliação: − 100 % + e «Ajustar», num canto do quadro; Ctrl + roda do rato ---------- */
function zoomUI(){
  let z = $('#zoomBox'); const vb = $('#view-board'); if (!vb) return;
  if (!z){
    z = h('div', {id:'zoomBox', role:'group', 'aria-label':_('Ampliação do quadro')},
      h('button', {class:'icon-btn', dataset:{z:'out'}, 'aria-label':_('Reduzir'), onclick:() => setZoom(ViewPref.zoom - .1)}, svgIcon('minus')),
      h('button', {class:'zoom-pct', dataset:{z:'reset'}, 'aria-label':_('Repor a ampliação a 100 %'), onclick:() => setZoom(1)}, '100%'),
      h('button', {class:'icon-btn', dataset:{z:'in'}, 'aria-label':_('Ampliar'), onclick:() => setZoom(ViewPref.zoom + .1)}, svgIcon('plus')),
      h('span', {class:'zoom-sep', 'aria-hidden':'true'}),
      h('button', {class:'icon-btn', dataset:{z:'fit'}, 'aria-label':_('Ajustar: ver a narrativa toda'), onclick:zoomFit}, svgIcon('fit')));
    vb.append(z);
  }
  z.hidden = !viewFull() || narrView() !== 'board' || activeTab !== 'board';
  z.querySelector('.zoom-pct').textContent = Math.round(Z() * 100) + '%';
}
window.addEventListener('DOMContentLoaded', () => {
  const sc = $('#board-scroll'); if (!sc) return;
  sc.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey) || !viewFull()) return; e.preventDefault(); setZoom(ViewPref.zoom + (e.deltaY < 0 ? .1 : -.1), true); }, {passive:false});
  sc.addEventListener('scroll', () => { if (!Mini.raf) Mini.raf = requestAnimationFrame(() => { Mini.raf = 0; miniView(); }); }, {passive:true});
  window.addEventListener('resize', () => { miniMap(); dockResize(); });
});

/* ---------- mini-mapa: a narrativa inteira num canto; mostra a parte à vista e leva a qualquer ponto ---------- */
const Mini = { raf:0, sx:1, w:0 };
function miniMap(){
  const vb = $('#view-board'), sc = $('#board-scroll'); if (!vb || !sc) return;
  let m = $('#miniMap');
  if (!m){
    m = h('div', {id:'miniMap', role:'img', 'aria-label':_('Mini-mapa da narrativa')}, h('canvas'), h('div', {class:'mini-vp'}));
    const go = e => { const r = m.getBoundingClientRect(), x = (e.clientX - r.left) / Mini.sx + B.GUT; sc.scrollLeft = Math.max(0, x * Z() - sc.clientWidth / 2); };
    m.addEventListener('pointerdown', e => { if (e.button) return; e.preventDefault(); Mini.drag = true; try { m.setPointerCapture(e.pointerId); } catch(x){} go(e); });
    m.addEventListener('pointermove', e => { if (Mini.drag) go(e); });
    for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, () => { Mini.drag = false; });
    vb.append(m);
  }
  const show = viewFull() && activeTab === 'board' && narrView() === 'board' && L && L.width * Z() > sc.clientWidth + 60 && !!L.order.length;
  m.hidden = !show; if (!show) return;
  const cs = getComputedStyle(document.body), col = k => cs.getPropertyValue(k).trim();
  const W = Math.min(260, Math.max(140, Math.round(sc.clientWidth * .22))), span = L.width - B.GUT, sx = W / span, rows = L.laneTop.length, rowH = Math.max(3, Math.min(6, Math.floor(40 / rows))), H = rows * rowH + 8;
  Mini.sx = sx; Mini.w = W; m.style.width = W + 'px'; m.style.height = H + 'px';
  const cv = m.querySelector('canvas'), dpr = window.devicePixelRatio || 1; cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
  g.fillStyle = col('--surface2'); L.chapters.forEach(c => g.fillRect((c.x - B.GUT) * sx, 2, Math.max(1, c.w * sx - 1), H - 4));
  g.fillStyle = col('--border-strong'); L.books.forEach((b, i) => { if (i) g.fillRect((b.x - B.GUT) * sx, 0, 1, H); });
  const hid = viewFor().hidden, laneOf = {}; L.lanes.forEach((l, i) => laneOf[l.arc.id] = i);
  for (const id of L.order){ const s = state.scenes[id], p = target['s:' + id]; if (!s || !p || hid.has(s.arcId)) continue;
    g.fillStyle = arcStroke(arcById(s.arcId)); g.fillRect((p.x - B.GUT) * sx, 4 + (laneOf[s.arcId] || 0) * rowH, Math.max(2, B.SW * sx - 1), rowH - 1); }
  miniView();
}
function miniView(){
  const m = $('#miniMap'), sc = $('#board-scroll'); if (!m || m.hidden || !sc) return;
  const vp = m.querySelector('.mini-vp'), x = sc.scrollLeft / Z() * Mini.sx, w = Math.max(8, (sc.clientWidth / Z() - B.GUT) * Mini.sx);
  vp.style.left = Math.min(Mini.w - 4, x) + 'px'; vp.style.width = Math.min(w, Mini.w - Math.min(Mini.w - 4, x)) + 'px';
}
function viewAfterBoard(){ applyFilters(); dockMark(); miniMap(); }

/* ---------- Lista: arrastar uma Cena (com o rato) muda-lhe a ordem ---------- */
window.addEventListener('DOMContentLoaded', () => {
  const nl = $('#narrList'); if (!nl) return;
  let d = null;
  const line = h('div', {class:'nl-drop', hidden:true});
  const targetAt = (x, y) => {
    const el = document.elementFromPoint(x, y), row = el && el.closest('.nl-row, .nl-chead, .nl-empty'); if (!row || !nl.contains(row)) return null;
    const r = row.getBoundingClientRect();
    if (row.classList.contains('nl-row')){ const pos = findScenePos(row.dataset.scene); if (!pos) return null; const after = y > r.top + r.height / 2;
      return {chId:pos.chapter.id, idx:pos.index + (after ? 1 : 0), y:after ? r.bottom : r.top, left:r.left, w:r.width}; }
    const head = row.classList.contains('nl-chead') ? row : row.previousElementSibling; if (!head || !head.dataset.chapter) return null;
    return {chId:head.dataset.chapter, idx:0, y:r.bottom, left:r.left, w:r.width};
  };
  nl.addEventListener('pointerdown', e => { const row = e.target.closest('.nl-row'); if (!row || e.pointerType !== 'mouse' || e.button || tourMode || pickLink) return; d = {id:row.dataset.scene, row, x:e.clientX, y:e.clientY, on:false, to:null}; });
  window.addEventListener('pointermove', e => {
    if (!d) return;
    if (!d.on){ if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 7) return; d.on = true; d.row.classList.add('nl-lift'); document.body.classList.add('dragging'); document.body.append(line); }
    d.to = targetAt(e.clientX, e.clientY); line.hidden = !d.to;
    if (d.to) Object.assign(line.style, {left:d.to.left + 'px', top:(d.to.y - 1) + 'px', width:d.to.w + 'px'});
    const r = nl.getBoundingClientRect(); if (e.clientY > r.bottom - 40) nl.scrollTop += 12; else if (e.clientY < r.top + 40) nl.scrollTop -= 12;
  });
  const end = cancel => {
    if (!d) return; const x = d; d = null; line.hidden = true; line.remove();
    if (!x.on) return; x.row.classList.remove('nl-lift'); document.body.classList.remove('dragging'); suppressUntil = performance.now() + 300;
    if (cancel || !x.to || !findChapter(x.to.chId)) return;
    const st = structFromState(); let from = null, idx = x.to.idx;
    st.forEach(b => b.chapters.forEach(c => { const i = c.scenes.indexOf(x.id); if (i >= 0){ from = {c, i}; } }));
    if (!from) return; if (from.c.id === x.to.chId && from.i < idx) idx--;
    from.c.scenes.splice(from.i, 1); let dest = null; st.forEach(b => b.chapters.forEach(c => { if (c.id === x.to.chId) dest = c; })); if (!dest) return;
    dest.scenes.splice(idx, 0, x.id);
    if (JSON.stringify(st) === JSON.stringify(structFromState())) return;
    const msg = describeMove({kind:'scene', id:x.id, preview:st}); applyStruct(st); commit(); snack(msg);
  };
  window.addEventListener('pointerup', () => end(false)); window.addEventListener('pointercancel', () => end(true));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && d) end(true); });
});

/* ---------- ficha ao lado: a ficha fica num painel à direita e o quadro continua à vista e utilizável ----------
   É uma escolha de quem usa (botão no cabeçalho de cada ficha), só no PC e com a janela larga: por omissão, a ficha
   continua a abrir numa janela ao centro, com as setas de percorrer as Cenas de cada lado. No painel, as setas ficam
   nas pontas das linhas da fita. Abrir outra coisa a partir do quadro substitui a ficha do painel; a partir de dentro
   da ficha (uma Personagem, uma Localização…), abre por cima e fechar volta à anterior. */
const Dock = { on:lsGet(LS_DOCK) === '1', inside:false };
const dockable = () => navMode() === 'rail' && innerWidth >= 1100 && Dual.role !== 'second' && !tourMode && !(typeof Tour !== 'undefined' && Tour.active);
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, e => { const t = ev === 'keydown' ? document.activeElement : e.target; Dock.inside = !!(t && t.closest && t.closest('.modal-back.docked, .ctx-menu, .ac-list')); }, true);
function dockBefore(){
  if (!Dock.on || !dockable() || Dock.inside || quietModals) return;
  const top = openModals[openModals.length - 1]; if (!top || !top.docked) return;
  [...openModals].reverse().forEach(m => { if (m.docked){ m.redraw = null; m.close(); } }); // a ficha do painel dá lugar à nova
}
function dockAfter(m){
  const tools = m.back.querySelector('.modal-tools'); if (!tools || m.dockBtn) return;
  m.dockBtn = h('button', {class:'icon-btn dock-btn', onclick:() => setDockPref(!Dock.on)}, svgIcon('panel'));
  tools.prepend(m.dockBtn);
  setDocked(m, Dock.on && dockable());
  if (m.docked){ syncInert(); dockUI(); } // a janela foi criada como as outras: só agora passa para o painel
}
function setDocked(m, on){
  m.docked = !!on; m.back.classList.toggle('docked', m.docked);
  if (m.dockBtn){ m.dockBtn.hidden = !dockable(); m.dockBtn.setAttribute('aria-pressed', String(m.docked)); m.dockBtn.setAttribute('aria-label', m.docked ? _('Abrir a ficha numa janela') : _('Pôr a ficha ao lado do quadro'));
    m.dockBtn.replaceChildren(svgIcon(m.docked ? 'window' : 'panel')); }
  if (m.fitaFit) m.fitaFit();
}
function setDockPref(on){
  Dock.on = !!on; lsSet(LS_DOCK, on ? '1' : '0');
  openModals.forEach(m => { if (m.entity) setDocked(m, Dock.on && dockable()); });
  syncInert(); dockUI();
}
function dockResize(){ let ch = false; openModals.forEach(m => { if (m.entity){ const want = Dock.on && dockable(); if (m.docked !== want || (m.dockBtn && m.dockBtn.hidden === dockable())){ setDocked(m, want); ch = true; } } }); if (ch){ syncInert(); dockUI(); } }
function dockUI(){
  const on = openModals.some(m => m.docked), was = document.body.classList.contains('dock-on');
  document.body.classList.toggle('dock-on', on);
  if (on){ const tb = $('#topbar'), db = $('#dualBar'); document.documentElement.style.setProperty('--top-h', ((tb ? tb.offsetHeight : 56) + (db && !db.hidden ? db.offsetHeight : 0)) + 'px'); }
  if (on !== was && state && activeTab === 'board'){ fitBoard(); drawLines(); miniMap(); }
  dockMark(); coachCheck();
}
/* traz para a parte visível do quadro a Cena cuja ficha está no painel */
function sceneIntoView(id){
  const c = target['s:' + id], sc = $('#board-scroll'); if (!c || !sc || activeTab !== 'board' || narrView() !== 'board' || arcHidden((state.scenes[id] || {}).arcId)) return;
  const z = Z(), vx = c.x * z - sc.scrollLeft, vy = c.y * z - sc.scrollTop, to = {behavior:'smooth'};
  if (vx < (B.GUT + 8) * z || vx + B.SW * z > sc.clientWidth - 8) to.left = (c.x - B.GUT / 2 + B.SW / 2) * z - sc.clientWidth / 2;
  if (vy < 0 || vy + B.SH * z > sc.clientHeight - HEAD_H * z) to.top = (c.y + HEAD_H / 2 + B.SH / 2) * z - sc.clientHeight / 2;
  if ('left' in to || 'top' in to) sc.scrollTo(to);
}
/* a Cena (ou o Tomo, ou o Arco) cuja ficha está no painel fica assinalada no quadro e na Lista */
function dockMark(){
  document.querySelectorAll('.is-open').forEach(x => x.classList.remove('is-open'));
  const top = [...openModals].reverse().find(m => m.docked && m.entity); if (!top){ Dock.shown = null; return; } if (activeTab !== 'board') return;
  const en = top.entity;
  const list = en.kind === 'scene' ? document.querySelectorAll('#view-board [data-scene="' + en.id + '"]') : en.kind === 'arc' ? document.querySelectorAll('.lane-label[data-arc="' + en.id + '"]') : en.kind === 'book' ? document.querySelectorAll('.book-head[data-book="' + en.id + '"]') : [];
  list.forEach(x => x.classList.add('is-open'));
  if (en.kind === 'scene' && Dock.shown !== en.id){ Dock.shown = en.id; requestAnimationFrame(() => sceneIntoView(en.id)); } // só quando muda a Cena aberta
}

/* ---------- ao passar o rato numa Cena: o que lá acontece, quem lá está e onde ---------- */
function sceneTipText(el){
  const s = state.scenes[el.dataset.scene]; if (!s) return '';
  const out = [], sum = (s.summary || '').trim();
  if (sum) out.push(sum.length > 200 ? sum.slice(0, 197) + '…' : sum);
  const who = s.chars.map(charById).filter(Boolean).map(c => c.name), where = s.sceneries.map(sceneryById).filter(Boolean).map(x => x.name);
  if (who.length) out.push(_('Personagens: {lista}.', {lista:who.join(', ')}));
  if (where.length) out.push(_('Localizações: {lista}.', {lista:where.join(', ')}));
  out.push(isDone(s, 'review') ? _('Escrita e revista.') : isDone(s, 'write') ? _('Escrita, por rever.') : _('Por escrever.'));
  const late = sceneLate(s); if (late) out.push(late.k === 'write' ? _('Prazo de escrita em atraso: {data}.', {data:fmtDate(late.due)}) : _('Prazo de revisão em atraso: {data}.', {data:fmtDate(late.due)}));
  out.push(_('Clique para abrir a ficha; clique longo para arrastar; botão direito para mais opções.'));
  return out.join('\n');
}
