'use strict';
/* ===== Estado, persistência e utilitários de interface ===== */
let LS_KEY = null; // onde está guardado o projeto ativo (null: nenhum projeto aberto); definido em projects.js
const LS_TOUR = 'narrativa.tourSeen';
const $ = (s, r) => (r || document).querySelector(s);
const lsGet = k => { try { return localStorage.getItem(k); } catch(e){ return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch(e){} };
const pl = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's')); // «1 Scene», «2 Scenes»
const uid = p => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

let state = null;
let tourMode = false; // durante a visita nada é guardado

function blankProject(){
  return { version:1, project:{ name:_('Novo Projeto'), palette:{h:220,mode:'dark'} },
    books:[{ id:uid('b'), name:_('Tomo 1'), narrator:'', color:null, mainChars:[], chapters:[{ id:uid('c'), name:_('Novo Capítulo'), scenes:[] }] }],
    scenes:{}, arcs:[], characters:[], sceneries:[], refs:[], goals:[] };
}
/* Os ficheiros importados não são de confiança: normalizar tipos e remover ligações órfãs. */
function sanitize(d){
  const S = v => v == null ? null : String(v), text = v => v == null ? '' : String(v), name = (v, def) => (v == null || v === '') ? def : String(v);
  const hue = v => (((Number(v) || 0) % 360) + 360) % 360;
  const obj = v => !!v && typeof v === 'object' && !Array.isArray(v), objs = l => (Array.isArray(l) ? l : []).filter(obj); // listas com lixo (null, números) não podem rebentar a importação
  if (!obj(d.project)) d.project = {}; d.project.name = name(d.project.name, _('Projeto'));
  if (!obj(d.project.palette)) d.project.palette = {h:220,mode:'dark'};
  for (const k of ['books', 'arcs', 'characters', 'sceneries', 'refs']) d[k] = objs(d[k]); // os projetos anteriores aos Sceneries não trazem essa lista
  if (!obj(d.scenes)) d.scenes = {}; for (const id in d.scenes) if (!obj(d.scenes[id])) delete d.scenes[id];
  const p = d.project.palette; p.h = hue(p.h); p.mode = p.mode === 'light' ? 'light' : 'dark';
  d.characters.forEach(c => { c.id = S(c.id); c.name = name(c.name, _('Personagem')); });
  d.arcs.forEach(a => { a.id = S(a.id); a.parentId = S(a.parentId); a.forkSceneId = S(a.forkSceneId); a.hue = hue(a.hue); a.sat = ARC_SATS.includes(Number(a.sat)) ? Number(a.sat) : 72; a.name = name(a.name, _('Arco Narrativo')); a.description = text(a.description); });
  const charIds = new Set(d.characters.map(c => c.id)), placed = new Set();
  const uniq = (l, ok) => [...new Set((Array.isArray(l) ? l : []).map(S))].filter(x => ok.has(x));
  d.sceneries.forEach(x => { x.id = S(x.id); x.name = name(x.name, _('Localização')); x.chars = uniq(x.chars, charIds);
    if (x.main === true) x.main = true; else delete x.main; if (x.noMain === true && !x.main) x.noMain = true; else delete x.noMain; }); // principal / secundária, e «não sugerir»
  const scnIds = new Set(d.sceneries.map(x => x.id));
  d.books.forEach(b => { b.id = S(b.id); b.name = name(b.name, _('Tomo')); b.narrator = text(b.narrator); b.color = bookColorOk(b.color);
    b.mainChars = (b.mainChars || []).map(S).filter(c => charIds.has(c)); b.chapters = objs(b.chapters);
    b.chapters.forEach(c => { c.id = S(c.id); c.name = name(c.name, _('Capítulo'));
      c.scenes = (c.scenes || []).map(S).filter(id => d.scenes[id] && !placed.has(id) && placed.add(id)); }); });
  for (const id in d.scenes) if (!placed.has(id)) delete d.scenes[id];
  d.arcs.forEach(a => { if (!d.arcs.some(x => x.id === a.parentId && x !== a)) a.parentId = null; if (!d.scenes[a.forkSceneId]) a.forkSceneId = null; });
  let orphan = null;
  for (const id in d.scenes){ const s = d.scenes[id];
    s.id = id; s.title = text(s.title); s.summary = text(s.summary); s.arcId = S(s.arcId);
    s.chars = (s.chars || []).map(S).filter(c => charIds.has(c)); s.pov = S(s.pov); if (!charIds.has(s.pov)) s.pov = null;
    s.sceneries = uniq(s.sceneries, scnIds);
    s.chron = Number(s.chron) || 0; s.convergeTo = S(s.convergeTo); if (!d.scenes[s.convergeTo]) s.convergeTo = null;
    if (!d.arcs.some(a => a.id === s.arcId)){
      if (!orphan){ orphan = { id:uid('a'), name:_('Sem Arco Narrativo'), hue:0, sat:28, parentId:null, forkSceneId:null, description:'' }; d.arcs.push(orphan); }
      s.arcId = orphan.id; }
  }
  if (typeof sanitizePlan === 'function') sanitizePlan(d); // prazos, progresso e objetivos de pesquisa (plan.js)
  const exists = { book:id => d.books.some(b => b.id === id), scene:id => !!d.scenes[id], arc:id => d.arcs.some(a => a.id === id), character:id => charIds.has(id), scenery:id => scnIds.has(id),
    goal:id => (d.goals || []).some(g => g.id === id) };
  d.refs.forEach(r => { r.id = S(r.id); if (!['document', 'link', 'audio', 'video', 'note'].includes(r.type)) r.type = 'note'; if ('url' in r) r.url = text(r.url);
    r.links = (r.links || []).filter(l => l && Object.prototype.hasOwnProperty.call(exists, l.kind) && exists[l.kind](S(l.id))).map(l => ({kind:l.kind, id:S(l.id)})); });
  return d;
}
function loadState(){
  let raw = null;
  if (!LS_KEY) return blankProject(); // página inicial: um projeto só para ter onde desenhar, nunca gravado
  try { raw = localStorage.getItem(LS_KEY); if (raw) return sanitize(JSON.parse(raw)); }
  catch(e){ console.error(e); if (raw) lsSet(LS_KEY + '.danificado', raw); } // guarda uma cópia antes de ser substituído
  return blankProject();
}
let saveT = null;
function flushSave(){
  clearTimeout(saveT); saveT = null;
  if (tourMode || !LS_KEY) return;
  const json = JSON.stringify(state);
  try { localStorage.setItem(LS_KEY, json); setSaveUI('ok'); }
  catch(e){ setSaveUI('fail'); toast(_('Não foi possível guardar: ') + e.message); return; }
  if (typeof projTouched === 'function') projTouched(json); // nome e «por guardar em ficheiro», no seletor de projetos
  if (typeof syncLocalChanged === 'function') syncLocalChanged(); // segue para os dispositivos ligados
}
function save(discrete, merge){ if (tourMode) return; normalizeConvergences(); histRecord(!discrete, merge); clearTimeout(saveT); setSaveUI('busy'); saveT = setTimeout(flushSave, 200); }
/* Indicador da gravação automática, na barra de topo */
const SAVE_UI = { ok:['✓', _('Guardado')], busy:['…', _('A guardar')], fail:['!', _('Não guardado')], sync:['⇄', _('Sincronizado')], demo:['◌', _('Demonstração')] };
let saveUIT = null;
function setSaveUI(k){
  const el = $('#saveState'); if (!el) return;
  clearTimeout(saveUIT); el.dataset.state = k; el.innerHTML = '';
  el.append(h('span', {class:'ic', 'aria-hidden':'true'}, SAVE_UI[k][0]), h('span', {class:'lbl'}, SAVE_UI[k][1]));
  if (k === 'sync') saveUIT = setTimeout(() => setSaveUI('ok'), 1600);
}
function commit(){ save(true); renderAll(); }
// fechar a janela logo depois de escrever não pode perder a última alteração
window.addEventListener('pagehide', () => { if (saveT) flushSave(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && saveT) flushSave(); });

/* ----- Anular / Refazer -----
   Cada alteração guardada deixa no histórico uma cópia do estado anterior. As alterações «contínuas»
   (escrever num campo) feitas com menos de 1 s de intervalo contam como um único passo. */
const Hist = { undo:[], redo:[], last:null, lastT:0, lastSoft:false, MAX:100 };
function histInit(){ if (tourMode) return; Hist.undo = []; Hist.redo = []; Hist.last = JSON.stringify(state); Hist.lastSoft = false; updateHistUI(); }
function histRecord(soft, merge){
  if (tourMode || Hist.last === null) return;
  const snap = JSON.stringify(state); if (snap === Hist.last) return;
  const now = Date.now();
  if (!merge && !(soft && Hist.lastSoft && Hist.undo.length && now - Hist.lastT < 1000)){
    Hist.undo.push(Hist.last); if (Hist.undo.length > Hist.MAX) Hist.undo.shift(); }
  Hist.redo = []; Hist.last = snap; Hist.lastT = now; Hist.lastSoft = soft; updateHistUI();
}
function histStep(from, to){
  if (tourMode || !from.length || drag || linkDrag) return false;
  closeAllModals(); closeMenu(); endPickLink();
  to.push(Hist.last); Hist.last = from.pop(); Hist.lastSoft = false;
  state = sanitize(JSON.parse(Hist.last)); applyPalette(); flushSave(); renderAll();
  return true;
}
function undo(){ if (histStep(Hist.undo, Hist.redo)) toast(_('Alteração anulada.')); }
function redo(){ if (histStep(Hist.redo, Hist.undo)) toast(_('Alteração refeita.')); }
function updateHistUI(){
  const u = $('#undoBtn'), r = $('#redoBtn'); if (!u || !r) return;
  u.disabled = tourMode || !Hist.undo.length; r.disabled = tourMode || !Hist.redo.length;
}
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const k = e.key.toLowerCase(); if (k !== 'z' && k !== 'y') return;
  const t = e.target; // dentro de um campo de texto, Ctrl+Z continua a anular a escrita
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  e.preventDefault(); if (k === 'y' || e.shiftKey) redo(); else undo();
});

/* IndexedDB para os ficheiros das Referências */
const idb = {
  db:null,
  open(){ return new Promise((res, rej) => { if (this.db) return res(this.db);
    const r = indexedDB.open('narrativa-files', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => { this.db = r.result; res(this.db); };
    r.onerror = r.onblocked = () => rej(r.error || new Error(_('base de dados bloqueada'))); }); },
  async tx(mode, fn){ const db = await this.open();
    return new Promise((res, rej) => { const t = db.transaction('files', mode); const rq = fn(t.objectStore('files'));
      t.oncomplete = () => res(rq && rq.result); t.onerror = t.onabort = () => rej(t.error || new Error(_('transação interrompida'))); }); },
  put(id, blob){ return this.tx('readwrite', s => s.put(blob, id)); },
  get(id){ return this.tx('readonly', s => s.get(id)); },
  del(id){ return this.tx('readwrite', s => s.delete(id)); },
  keys(){ return this.tx('readonly', s => s.getAllKeys()); },
  clear(){ return this.tx('readwrite', s => s.clear()); }
};

/* ----- hyperscript ----- */
function h(tag, attrs, ...kids){
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs){ const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') for (const p in v){ if (p.startsWith('--')) el.style.setProperty(p, v[p]); else el.style[p] = v[p]; } // também variáveis CSS (--x)
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v); }
  for (const kid of kids.flat(Infinity)){ if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid))); }
  return el;
}
function add(el, ...kids){ kids.flat(Infinity).forEach(k => { if (k != null && k !== false) el.append(k); }); }
function selectEl(options, value, onchange, cls){
  const s = h('select', {class:cls || 'inp'});
  options.forEach(o => s.append(h('option', {value:o.value}, o.label)));
  s.value = value == null ? '' : value;
  s.addEventListener('change', () => onchange(s.value));
  return s;
}
const field = (label, ...ctl) => h('div', {class:'field'}, h('label', null, label), ...ctl);
const badge = (t, cls) => h('span', {class:'badge' + (cls ? ' ' + cls : '')}, t);

/* ----- modelo ----- */
const bookById = id => state.books.find(b => b.id === id);
const arcById = id => state.arcs.find(a => a.id === id);
const charById = id => state.characters.find(c => c.id === id);
const refById = id => state.refs.find(r => r.id === id);
const sceneryById = id => state.sceneries.find(x => x.id === id);
function findChapter(id){
  for (const b of state.books){ const i = b.chapters.findIndex(c => c.id === id); if (i >= 0) return {book:b, chapter:b.chapters[i], index:i}; }
  return null;
}
function findScenePos(id){
  for (const b of state.books) for (let ci = 0; ci < b.chapters.length; ci++){
    const c = b.chapters[ci]; const i = c.scenes.indexOf(id);
    if (i >= 0) return {book:b, chapter:c, chIndex:ci, index:i}; }
  return null;
}
function narrOrder(){ const o = []; for (const b of state.books) for (const c of b.chapters) o.push(...c.scenes); return o; }
function narrIndexMap(){ const m = {}; narrOrder().forEach((id, i) => m[id] = i); return m; }
/* ----- cor dos Books -----
   Escolhida pelo utilizador (ou nenhuma). É só decorativa — uma faixa, um ponto, um fundo muito leve —, por isso o texto nunca muda de cor. */
const BOOK_COLORS = [['#e5534b', _('Vermelho')], ['#f0883e', _('Laranja')], ['#d4a72c', _('Mostarda')], ['#57ab5a', _('Verde')], ['#2fb3a0', _('Verde-água')],
  ['#539bf5', _('Azul')], ['#6a6ff0', _('Índigo')], ['#986ee2', _('Violeta')], ['#e275ad', _('Rosa')], ['#a0785a', _('Castanho')], ['#8b949e', _('Cinzento')]];
/* intensidade da cor do Book no fundo do cabeçalho: nas paletas claras é menor, para o texto secundário manter o contraste */
const BOOK_TINT = { dark:14, light:5 };
const bookColorOk = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null;
/* o ponto de cor do Book, para listas e cartões; nada quando o Book não tem cor */
const bookDot = b => b && b.color ? h('span', {class:'dot book-dot', style:{background:b.color}}) : null;

/* ----- cor e contraste (WCAG) -----
   A luminosidade HSL não é uniforme: um amarelo e um azul com o mesmo «L» têm brilhos muito diferentes.
   Por isso as cores que levam texto, ou que têm de se destacar do fundo, são ajustadas até garantirem o contraste pedido. */
function hsl2rgb(hh, s, l){ s /= 100; l /= 100; const a = s * Math.min(l, 1 - l);
  const f = n => { const k = (n + hh / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0), f(8), f(4)]; }
function luminance(c){ const v = x => x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); return .2126 * v(c[0]) + .7152 * v(c[1]) + .0722 * v(c[2]); }
function contrast(a, b){ const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
/* a luminosidade mais próxima de «l» (a subir ou a descer, conforme «dir») que garante o contraste «min» contra «bg» */
function fitL(hh, s, l, bg, min, dir){ while (l > 0 && l < 100 && contrast(hsl2rgb(hh, s, l), bg) < min) l += dir; return Math.max(0, Math.min(100, l)); }
const SCENE_INK = [.082, .09, .11]; // #15171c, o texto dos cartões das Scenes
const arcL = new Map(), arcLineL = new Map();
/* cor do cartão de uma Scene: o texto escuro tem sempre contraste de pelo menos 7:1 */
const arcSat = arc => arc.sat || 72;
function arcColor(arc, tint){
  if (!arc) return '#999'; if (tint) return `hsl(${arc.hue} ${Math.round(arcSat(arc) / 2)}% 82%)`;
  const k = arc.hue + ':' + arcSat(arc); let l = arcL.get(k); if (l == null) arcL.set(k, l = fitL(arc.hue, arcSat(arc), 66, SCENE_INK, 7.2, 1));
  return `hsl(${arc.hue} ${arcSat(arc)}% ${l}%)`;
}
/* cor das linhas e dos pontos de um Story Arc: nas paletas claras escurece até se distinguir do fundo */
function arcStroke(arc){
  if (!arc) return '#999'; const p = state.project.palette; if (p.mode !== 'light') return arcColor(arc);
  const k = arc.hue + ':' + arcSat(arc); let l = arcLineL.get(k); if (l == null) arcLineL.set(k, l = fitL(arc.hue, arcSat(arc), 52, [1, 1, 1], 3.4, -1));
  return `hsl(${arc.hue} ${arcSat(arc)}% ${l}%)`;
}
/* Cores dos Arcos Narrativos que se distinguem também com daltonismo (protanopia, deuteranopia e tritanopia).
   A sequência foi escolhida simulando os três tipos (Machado et al., 2009) e maximizando a distância CIEDE2000
   entre todos os pares, tanto nos cartões como nas linhas: tom e saturação variam, porque a luminosidade
   fica presa ao contraste do texto. Com 6 Arcos, a menor distância é 8,7 (a cor antiga ficava em 1,8). */
const ARC_TONES = [[342, 50], [54, 80], [258, 80], [180, 80], [234, 28], [102, 28], [12, 28], [198, 80], [24, 50], [228, 50]];
const ARC_SATS = [80, 72, 50, 28];
function nextTone(){
  const free = ARC_TONES.find(([hh, sa]) => !state.arcs.some(a => a.hue === hh && arcSat(a) === sa));
  return free ? {hue:free[0], sat:free[1]} : {hue:nextHue(), sat:72};
}
/* aplica a sequência segura aos Arcos Narrativos existentes, pela ordem em que aparecem */
function recolorArcs(){ state.arcs.forEach((a, i) => { const t = ARC_TONES[i % ARC_TONES.length]; a.hue = t[0]; a.sat = t[1]; }); }
function nextHue(){
  const used = state.arcs.map(a => a.hue); let best = 205, bestD = -1;
  if (!used.length) return best;
  for (let i = 0; i < 24; i++){ const c = (205 + i * 137.508) % 360;
    const d = Math.min(...used.map(u => { const x = Math.abs(u - c) % 360; return Math.min(x, 360 - x); }));
    if (d > bestD){ bestD = d; best = c; } }
  return Math.round(best) % 360;
}
function arcOwnScenes(arcId, nm){
  nm = nm || narrIndexMap();
  return Object.values(state.scenes).filter(s => s.arcId === arcId).sort((a, b) => (a.chron - b.chron) || (nm[a.id] - nm[b.id]));
}
function normalizeChron(arcId){
  const l = arcOwnScenes(arcId); let rank = 0, last = null; const r = [];
  for (const s of l){ if (last === null || s.chron !== last){ rank++; last = s.chron; } r.push(rank); }
  l.forEach((s, i) => s.chron = r[i]);
}
function orderedArcs(){
  const out = [], seen = new Set();
  const visit = (a, d) => { if (seen.has(a.id)) return; seen.add(a.id); out.push({arc:a, depth:d});
    state.arcs.filter(x => x.parentId === a.id).forEach(x => visit(x, d + 1)); };
  state.arcs.filter(a => !a.parentId || !arcById(a.parentId)).forEach(a => visit(a, 0));
  state.arcs.forEach(a => visit(a, 0));
  return out;
}
/* Scenes visíveis num Story Arc: herdadas antes da divergência (pre), próprias, e herdadas após convergência (post) */
function arcView(arcId, mode){
  const nm = narrIndexMap();
  const own = arcOwnScenes(arcId, nm).map(s => ({s, inh:null}));
  const pre = []; let a = arcById(arcId); const seen = new Set([arcId]);
  while (a && a.parentId && arcById(a.parentId) && !seen.has(a.parentId)){
    seen.add(a.parentId);
    const fork = state.scenes[a.forkSceneId];
    const ps = (fork && fork.arcId === a.parentId) ? arcOwnScenes(a.parentId, nm).filter(s => s.chron <= fork.chron) : [];
    pre.unshift(...ps.map(s => ({s, inh:'pre'})));
    a = arcById(a.parentId);
  }
  const post = []; const seen2 = new Set([arcId]);
  let c = own.length ? own[own.length - 1].s : null;
  while (c && c.convergeTo && state.scenes[c.convergeTo]){
    const t = state.scenes[c.convergeTo]; if (seen2.has(t.arcId)) break; seen2.add(t.arcId);
    const ts = arcOwnScenes(t.arcId, nm).filter(s => s.chron >= t.chron);
    post.push(...ts.map(s => ({s, inh:'post'})));
    c = ts[ts.length - 1];
  }
  const all = [...pre, ...own, ...post];
  if (mode === 'narr') all.sort((x, y) => nm[x.s.id] - nm[y.s.id]);
  return all;
}
function bookScenes(book){ const o = []; book.chapters.forEach(c => c.scenes.forEach(id => state.scenes[id] && o.push(state.scenes[id]))); return o; }
function bookCharacters(book){
  const m = new Map();
  for (const s of bookScenes(book)){
    for (const cid of s.chars) if (!m.has(cid)) m.set(cid, {pov:false});
    if (s.pov){ if (!m.has(s.pov)) m.set(s.pov, {pov:false}); m.get(s.pov).pov = true; }
  }
  const list = [...m].map(([id, v]) => ({ch:charById(id), pov:v.pov, main:book.mainChars.includes(id)})).filter(x => x.ch);
  list.sort((a, b) => (b.main - a.main) || a.ch.name.localeCompare(b.ch.name));
  return list;
}
function bookArcIds(book){ return [...new Set(bookScenes(book).map(s => s.arcId))]; }
function arcCharIds(arcId){ const set = new Set(); Object.values(state.scenes).forEach(s => { if (s.arcId === arcId){ s.chars.forEach(c => set.add(c)); if (s.pov) set.add(s.pov); } }); return [...set]; }
/* Main Character: marcado como Main num Book em que figura (num Book concreto, se indicado) */
const isMain = (cid, bookId) => charBooks(cid).some(b => (!bookId || b.id === bookId) && b.mainChars.includes(cid));
function charBooks(cid){ return state.books.filter(b => bookScenes(b).some(s => s.pov === cid || s.chars.includes(cid))); }

/* Sceneries: associam-se a Scenes (lista guardada na Scene) e a Characters (lista guardada no Scenery) */
function sceneryScenes(id){ return narrOrder().map(sid => state.scenes[sid]).filter(s => s && s.sceneries.includes(id)); }
const charSceneries = cid => state.sceneries.filter(x => x.chars.includes(cid));
function newScenery(name){ const x = { id:uid('sc'), name:name || _('Nova Localização'), chars:[] }; state.sceneries.push(x); return x; }
function deleteScenery(id){
  Object.values(state.scenes).forEach(s => s.sceneries = s.sceneries.filter(x => x !== id));
  state.sceneries = state.sceneries.filter(x => x.id !== id); unlinkRefs('scenery', id);
}

/* Localização Principal ou Secundária (a casa da protagonista, o colégio onde decorre a ação… ou um sítio onde se passa uma vez).
   Uma Localização por marcar que já aparece em LOC_MAIN_MIN Cenas ou mais é sugerida como principal — uma vez: «não» fica lembrado. */
const LOC_MAIN_MIN = 3;
const locSuggest = x => !x.main && !x.noMain && sceneryScenes(x.id).length >= LOC_MAIN_MIN;
function setLocMain(x, on){ if (on){ x.main = true; delete x.noMain; } else { delete x.main; } }
const sameName = (list, q) => list.some(x => x && x.name.toLowerCase() === q);
/* Sceneries (sem repetições) de um conjunto de Scenes — para as fichas do Book, do Story Arc e do Character */
function scenesSceneries(scenes){ const ids = new Set(); scenes.forEach(s => s.sceneries.forEach(x => ids.add(x))); return state.sceneries.filter(x => ids.has(x.id)); }

function unlinkRefs(kind, id){ state.refs.forEach(r => r.links = r.links.filter(l => !(l.kind === kind && l.id === id))); }
/* Uma convergência pertence ao fim de um Story Arc: fica sempre na sua última Scene e aponta para outro Story Arc. */
function normalizeConvergences(){
  const nm = narrIndexMap();
  for (const a of state.arcs){
    const own = arcOwnScenes(a.id, nm); let tgt = null;
    for (const s of own){ const t = s.convergeTo && state.scenes[s.convergeTo]; if (t && t.arcId !== a.id) tgt = t.id; s.convergeTo = null; }
    if (tgt) own[own.length - 1].convergeTo = tgt;
  }
}
/* Quando uma Scene sai do seu Story Arc (eliminada ou mudada), os Branches que dela partiam passam a partir da Scene anterior */
function reassignForks(s){
  for (const a of state.arcs) if (a.forkSceneId === s.id){
    const prev = arcOwnScenes(s.arcId).filter(x => x.id !== s.id && x.chron <= s.chron).pop();
    a.forkSceneId = prev ? prev.id : null; }
}
function deleteScene(id){
  const s = state.scenes[id]; if (!s) return;
  const pos = findScenePos(id); if (pos) pos.chapter.scenes.splice(pos.index, 1);
  reassignForks(s);
  for (const o of Object.values(state.scenes)) if (o.convergeTo === id) o.convergeTo = null;
  delete state.scenes[id]; unlinkRefs('scene', id); normalizeChron(s.arcId); retargetGoals('scene', id);
}
/* objetivos de pesquisa ligados ao que se elimina passam a gerais (como faria a normalização) */
function retargetGoals(kind, id){ (state.goals || []).forEach(g => { if (g.target.kind === kind && g.target.id === id) g.target = {kind:'project', id:null}; }); }
function deleteChapter(id){ const f = findChapter(id); if (!f) return; [...f.chapter.scenes].forEach(deleteScene); f.book.chapters.splice(f.index, 1); retargetGoals('chapter', id); }
function deleteBook(id){ const b = bookById(id); if (!b) return; [...b.chapters].forEach(c => deleteChapter(c.id)); state.books = state.books.filter(x => x.id !== id); unlinkRefs('book', id); retargetGoals('book', id); }
function deleteCharacter(id){
  Object.values(state.scenes).forEach(s => { s.chars = s.chars.filter(c => c !== id); if (s.pov === id) s.pov = null; });
  state.books.forEach(b => b.mainChars = b.mainChars.filter(c => c !== id));
  state.sceneries.forEach(x => x.chars = x.chars.filter(c => c !== id));
  state.characters = state.characters.filter(c => c.id !== id); unlinkRefs('character', id);
}
function newArc(name, parentId, forkSceneId){
  const a = { id:uid('a'), name, ...nextTone(), parentId:parentId || null, forkSceneId:forkSceneId || null, description:'' };
  state.arcs.push(a); return a;
}
function newCharacter(name){ const c = { id:uid('ch'), name:name || _('Nova Personagem'), gender:'N/D', age:'', description:'' }; state.characters.push(c); return c; }
function entityLabel(kind, id){
  if (kind === 'book'){ const b = bookById(id); return b ? _('Tomo: ') + b.name : null; }
  if (kind === 'scene'){ const s = state.scenes[id]; return s ? _('Cena: ') + (s.title || _('Sem título')) : null; }
  if (kind === 'arc'){ const a = arcById(id); return a ? _('Arco Narrativo: ') + a.name : null; }
  if (kind === 'character'){ const c = charById(id); return c ? _('Personagem: ') + c.name : null; }
  if (kind === 'scenery'){ const x = sceneryById(id); return x ? _('Localização: ') + x.name : null; }
  if (kind === 'goal'){ const g = (state.goals || []).find(x => x.id === id); return g ? _('Objetivo de pesquisa: ') + (g.title || _('Sem título')) : null; }
  return null;
}
function openEntity(kind, id){
  if (kind === 'book') openBookFicha(id); else if (kind === 'scene') openSceneFicha(id);
  else if (kind === 'arc') openArcFicha(id); else if (kind === 'character') openCharFicha(id);
  else if (kind === 'scenery') openSceneryFicha(id);
  else if (kind === 'goal') openGoalFicha(id);
}

/* ----- toasts, modais, menus, autocomplete ----- */
function toast(msg){
  const t = h('div', {class:'toast'}, msg); $('#toasts').append(t);
  setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3100);
}
/* Aviso com «Anular»: para o que se faz logo, sem perguntar antes (mover, eliminar uma Cena, uma Nota…).
   O botão só anula se entretanto nada mais mudou; depois disso, fica o Anular da barra de topo (Ctrl+Z). */
function snack(msg){
  document.querySelectorAll('.toast.snack').forEach(x => x.remove()); // um de cada vez
  const snap = Hist.last, t = h('div', {class:'toast snack', role:'status'}, h('span', {class:'snack-t'}, msg));
  const out = () => { t.classList.add('out'); setTimeout(() => t.remove(), 400); };
  if (!tourMode && Hist.undo.length) t.append(h('button', {class:'snack-undo', onclick:() => { t.remove(); if (Hist.last === snap) undo(); else toast(_('Entretanto houve outras alterações: use Anular na barra de topo.')); }}, _('Anular')));
  $('#toasts').append(t); setTimeout(out, 7000);
}
const openModals = [];
/* uma ficha «ao lado» (ver fichas.js) não tapa nem bloqueia o que está por trás */
const modalsBlock = () => openModals.some(m => !m.docked);
let quietModals = false; // ao repor fichas depois de uma sincronização, as janelas reaparecem sem animação
const modalsChanged = () => { if (typeof Dual !== 'undefined') Dual.report(); if (typeof fabUI === 'function') fabUI(); if (typeof dockUI === 'function') dockUI(); };
/* Enquanto há uma janela aberta (ou a visita a decorrer), o que está por trás não recebe foco nem cliques. */
function syncInert(){
  const t = typeof Tour !== 'undefined' && Tour.active, m = modalsBlock();
  for (const s of ['#topbar', 'main', '#rail', '#bnav']){ const el = $(s); if (el) el.inert = t || m; } $('#modals').inert = t;
  openModals.forEach((x, i) => x.back.inert = i < openModals.length - 1);
}
function openModal({title, body, wide, onClose, cls}){
  const back = h('div', {class:'modal-back' + (cls ? ' ' + cls.split(' ').map(c => c + '-back').join(' ') : '')}); const prevFocus = document.activeElement, t0 = performance.now();
  const titleEl = h('div', {class:'modal-title'}, title);
  const api = { back, titleEl, redraw:null,
    close(){ if (!back.isConnected) return; back.remove();
      document.querySelectorAll('.ac-list').forEach(l => l.remove()); // uma lista de sugestões não sobrevive à janela que a abriu
      const i = openModals.indexOf(api); if (i >= 0) openModals.splice(i, 1);
      onClose && onClose(); syncInert(); modalsChanged();
      const top = openModals[openModals.length - 1]; top && top.redraw && top.redraw();
      // o foco volta a quem abriu a janela; se esse botão foi redesenhado entretanto, fica na ficha que está por cima
      const back2 = prevFocus && prevFocus.isConnected && prevFocus !== document.body ? prevFocus : top && top.back.querySelector('.modal');
      if (back2) try { back2.focus({preventScroll:true}); } catch(e){} } };
  const box = h('div', {class:'modal' + (wide ? ' wide' : '') + (cls ? ' ' + cls : '') + (quietModals ? ' still' : ''), role:'dialog', 'aria-modal':'true', tabIndex:-1},
    h('div', {class:'modal-head'}, titleEl, h('span', {class:'modal-tools'}, h('button', {class:'icon-btn modal-x', title:_('Fechar'), 'aria-label':_('Fechar'), onclick:() => api.close()}, svgIcon('x')))), body);
  back.append(box);
  // fecha com um clique no fundo — mas não com o 2.º clique de um duplo clique, nem ao usar a barra de deslocamento
  let downOnBack = false;
  back.addEventListener('pointerdown', e => { downOnBack = e.target === back && e.clientX < back.clientWidth && performance.now() - t0 > 350; });
  back.addEventListener('click', e => { if (e.target === back && downOnBack) api.close(); downOnBack = false; });
  $('#modals').append(back); openModals.push(api); syncInert(); modalsChanged();
  return api;
}
function closeAllModals(){ [...openModals].reverse().forEach(m => { m.redraw = null; m.close(); }); }
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || tourMode) return;
  if (menuEl) return closeMenu();
  if (openModals.length && !document.querySelector('.ac-list')) openModals[openModals.length - 1].close();
});
function confirmDialog(msg, opts){
  opts = opts || {};
  return new Promise(res => {
    let done = false; const fin = v => { if (done) return; done = true; res(v); m.close(); };
    const ok = h('button', {class:'btn primary' , onclick:() => fin(true)}, opts.ok || _('Confirmar'));
    const body = h('div', {class:'modal-body'}, h('div', null, msg),
      h('div', {class:'modal-foot'}, h('button', {class:'btn', onclick:() => fin(false)}, _('Cancelar')), ok));
    const m = openModal({title:opts.title || _('Confirmar alteração'), body, onClose:() => fin(false)});
    m.keep = !!opts.keep; // uma atualização vinda de outro dispositivo não fecha esta pergunta
    ok.focus();
  });
}
function promptDialog(title, label, def){
  return new Promise(res => {
    let done = false; const fin = v => { if (done) return; done = true; res(v); m.close(); };
    const inp = h('input', {class:'inp', value:def || ''});
    const go = () => { const v = inp.value.trim(); if (v) fin(v); };
    // preventDefault: o mesmo Enter não pode chegar ao botão que recebe o foco quando a janela fecha (e voltar a abri-la)
    inp.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); go(); } });
    const body = h('div', {class:'modal-body'}, field(label, inp),
      h('div', {class:'modal-foot'}, h('button', {class:'btn', onclick:() => fin(null)}, _('Cancelar')), h('button', {class:'btn primary', onclick:go}, 'OK')));
    const m = openModal({title, body, onClose:() => fin(null)});
    inp.focus(); inp.select();
  });
}
let menuEl = null;
function closeMenu(){ if (menuEl){ const m = menuEl; m.remove(); menuEl = null; m.onClose && m.onClose(); } }
function showMenu(x, y, items){
  closeMenu();
  const m = h('div', {class:'ctx-menu', role:'menu'});
  for (const it of items){
    if (it === '-'){ m.append(h('div', {class:'ctx-sep'})); continue; }
    if (it.heading){ m.append(h('div', {class:'ctx-head'}, it.heading)); continue; }
    m.append(h('button', {class:'ctx-item', role:'menuitem', disabled:!!it.disabled, onclick:() => { if (performance.now() < suppressUntil) return; // o clique que alguns browsers simulam ao levantar o dedo que abriu o menu
      closeMenu(); it.action && it.action(); }}, it.label));
  }
  // setas para percorrer as opções, Esc para fechar
  m.addEventListener('keydown', e => {
    const its = [...m.querySelectorAll('.ctx-item:not(:disabled)')], i = its.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); const n = its[(i + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length]; n && n.focus(); }
    else if (e.key === 'Home' || e.key === 'End'){ e.preventDefault(); const n = e.key === 'Home' ? its[0] : its[its.length - 1]; n && n.focus(); }
    else if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); closeMenu(); }
  });
  document.body.append(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 6)) + 'px';
  m.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 6)) + 'px';
  menuEl = m;
}
document.addEventListener('pointerdown', e => { if (menuEl && !tourMode && !menuEl.contains(e.target)) closeMenu(); }, true);
/* num ecrã tátil, deslocar a página fecha o menu (não há roda do rato) */
document.addEventListener('scroll', e => { if (menuEl && !tourMode && e.target !== menuEl) closeMenu(); }, {capture:true, passive:true});
for (const ev of ['wheel', 'blur', 'resize']) window.addEventListener(ev, () => { if (!tourMode) closeMenu(); }, {passive:true});

function autocomplete(input, getItems, onPick, opts){
  opts = opts || {}; let list = null, act = 0;
  const close = () => { if (list){ list.remove(); list = null; } };
  const mark = () => { [...list.querySelectorAll('.ac-item')].forEach((el, i) => el.classList.toggle('active', i === act)); const a = list.querySelector('.ac-item.active'); a && a.scrollIntoView({block:'nearest'}); };
  const open = () => {
    close();
    const q = input.value.trim().toLowerCase();
    const all = getItems(), items = all.filter(i => i.label.toLowerCase().includes(q));
    const taken = !!(q && opts.taken && opts.taken(q)); // o nome escrito é de algo que já está associado: não se oferece criar um duplicado
    list = h('div', {class:'ac-list'});
    items.slice(0, 60).forEach(i => list.append(h('div', {class:'ac-item', onpointerdown:e => { e.preventDefault(); close(); onPick(i); }},
      i.color ? h('span', {class:'dot', style:{background:i.color}}) : null, i.label, i.hint ? h('span', {class:'ac-hint'}, i.hint) : null)));
    if (opts.create && q && !taken && !items.some(i => i.label.toLowerCase() === q))
      list.append(h('div', {class:'ac-item create', onpointerdown:e => { e.preventDefault(); const v = input.value.trim(); close(); opts.create(v); }}, _('+ Criar «{nome}»', {nome:input.value.trim()})));
    if (!list.children.length) list.append(h('div', {class:'ac-empty'}, taken ? _('Já está associado') : (q && all.length ? _('Sem resultados') : opts.empty || _('Sem resultados'))));
    const r = input.getBoundingClientRect();
    Object.assign(list.style, {left:r.left + 'px', top:(r.bottom + 2) + 'px', minWidth:Math.min(r.width, innerWidth - r.left - 8) + 'px', maxWidth:(innerWidth - r.left - 8) + 'px',
      maxHeight:Math.max(120, Math.min(260, innerHeight - r.bottom - 10)) + 'px'});
    document.body.append(list); act = 0; mark();
  };
  input.addEventListener('focus', open); input.addEventListener('input', open);
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape'){ if (list){ e.stopPropagation(); close(); } }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && list){ e.preventDefault(); const n = list.querySelectorAll('.ac-item').length;
      if (n){ act = (act + (e.key === 'ArrowDown' ? 1 : n - 1)) % n; mark(); } }
    // !e.repeat: manter Enter premido no botão que abriu a janela não escolhe sozinho o primeiro item
    if (e.key === 'Enter' && list && !e.repeat){ const f = list.querySelectorAll('.ac-item')[act]; if (f){ e.preventDefault(); f.dispatchEvent(new PointerEvent('pointerdown', {cancelable:true})); } }
  });
}

/* ----- paletas ----- */
/* O texto secundário e a cor de destaque garantem 4,5:1 contra a superfície mais desfavorável (o mínimo para texto normal);
   os contornos dos campos garantem 3:1 (o mínimo para componentes de interface). */
function paletteVars(p){
  const hh = p.h;
  if (p.mode === 'light'){
    const s2 = hsl2rgb(hh, 28, 93), tint = hsl2rgb(hh, 60, 88); // «tint»: o fundo de um separador ou botão ativo
    return {
      '--bg':`hsl(${hh} 30% 97%)`, '--surface':'#ffffff', '--surface2':`hsl(${hh} 28% 93%)`, '--border':`hsl(${hh} 18% 80%)`,
      '--border-strong':`hsl(${hh} 14% ${fitL(hh, 14, 58, s2, 3.2, -1)}%)`,
      '--text':`hsl(${hh} 25% 14%)`, '--muted':`hsl(${hh} 10% ${fitL(hh, 10, 40, s2, 4.9, -1)}%)`,
      '--accent':`hsl(${hh} 75% ${fitL(hh, 75, 42, tint, 4.6, -1)}%)`, '--accent-text':'#ffffff',
      '--narr':'#ffffff', '--narr-case':'rgba(0,0,0,.6)', '--shadow':'rgba(30,40,60,.22)', '--danger':'#b3261e', '--pov':'#7a4f00', '--book-tint':BOOK_TINT.light + '%',
      '--chrome':`hsl(${hh} 32% 93.5%)` };
  }
  const s2 = hsl2rgb(hh, 12, 18), tint = hsl2rgb(hh, 40, 26);
  return {
    '--bg':`hsl(${hh} 14% 9%)`, '--surface':`hsl(${hh} 13% 13%)`, '--surface2':`hsl(${hh} 12% 18%)`, '--border':`hsl(${hh} 10% 28%)`,
    '--border-strong':`hsl(${hh} 10% ${fitL(hh, 10, 46, s2, 3.2, 1)}%)`,
    '--text':`hsl(${hh} 20% 93%)`, '--muted':`hsl(${hh} 10% ${fitL(hh, 10, 66, s2, 4.6, 1)}%)`,
    '--accent':`hsl(${hh} 85% ${fitL(hh, 85, 74, tint, 4.6, 1)}%)`, '--accent-text':`hsl(${hh} 40% 10%)`,
    '--narr':'#ffffff', '--narr-case':'rgba(0,0,0,.4)', '--shadow':'rgba(0,0,0,.5)', '--danger':'#f6a59e', '--pov':'#f6bf26', '--book-tint':BOOK_TINT.dark + '%',
    '--chrome':`hsl(${hh} 16% 6.5%)` };
}
/* Claro ou escuro é deste dispositivo (não do projeto): «auto» segue o sistema operativo; «light» e «dark» ficam lembrados. */
const LS_THEME = 'narrativa.theme';
const themePref = () => { const v = lsGet(LS_THEME); return v === 'light' || v === 'dark' ? v : 'auto'; };
const OS_DARK = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
const effectiveMode = () => themePref() === 'auto' ? (OS_DARK && !OS_DARK.matches ? 'light' : 'dark') : themePref();
function setTheme(v){ lsSet(LS_THEME, v); applyPalette(); renderAll(); }
if (OS_DARK) try { OS_DARK.addEventListener('change', () => { if (themePref() === 'auto' && state){ applyPalette(); renderAll(); } }); } catch(e){}
window.addEventListener('storage', e => { if (e.key === LS_THEME && state){ applyPalette(); renderAll(); } }); // outra janela mudou o tema
function applyPalette(){
  const mode = effectiveMode(), v = paletteVars({h:state.project.palette.h, mode});
  for (const k in v) document.documentElement.style.setProperty(k, v[k]);
  const tc = $('meta[name="theme-color"]'); if (tc) tc.content = v['--chrome']; // barra da janela instalada, na cor da barra de topo
  document.documentElement.style.colorScheme = mode; // barras de deslocamento e controlos nativos no mesmo tom
  document.documentElement.dataset.mode = mode;
}
