'use strict';
/* ===== Vários projetos =====
   Cada projeto é guardado à parte neste dispositivo (gravação automática, como antes). Um índice diz quais estão abertos,
   qual é o ativo e quais foram fechados há pouco (os «recentes», que se podem reabrir).
   «Guardar Projeto» grava-o num ficheiro; «Abrir Projeto» abre um ficheiro como mais um projeto, sem fechar os outros;
   «Fechar Projeto» pergunta se quer guardar quando há alterações desde a última vez que foi guardado em ficheiro.
   O projeto ativo é o mesmo em todas as janelas deste dispositivo (incluindo o segundo ecrã).
   Sem nenhum projeto aberto, aparece a página inicial. */
const LS_PROJ = 'narrativa.projects', LEGACY_KEY = 'narrativa.project.v1', LS_LEAVE = 'narrativa.leaveWarn';
const LEGACY_ID = 'legado'; // o projeto que vem da versão de um só projeto continua guardado onde estava
const projKey = id => id === LEGACY_ID ? LEGACY_KEY : 'narrativa.p.' + id;
/* cópia do projeto tal como foi guardado (ou aberto) do ficheiro: é para ela que se volta ao fechar sem guardar */
const snapKey = id => projKey(id) + '.guardado';
const projSnap = (id, json) => { try { localStorage.setItem(snapKey(id), json); return true; } catch(e){ return false; } };
const PID_RE = /^[\w-]{4,40}$/;
const RECENT_MAX = 8;
/* assinatura do conteúdo, para saber se mudou desde a última vez que foi guardado em ficheiro */
const projSig = s => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return s.length + ':' + x; };

const Projects = { idx:null, hist:new Map(), handles:new Map(), leaving:false };
const projActive = () => Projects.idx.active;
const projNone = () => !Projects.idx.active;
const projMeta = id => Projects.idx.meta[id] || (Projects.idx.meta[id] = {name:_('Projeto'), savedSig:null, dirty:false});
/* todas as chaves de projetos guardados neste dispositivo, estejam ou não no índice */
function projStoredIds(){
  const out = [];
  try { for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i);
    if (k === LEGACY_KEY) out.push(LEGACY_ID); else if (/^narrativa\.p\.[\w-]{4,40}$/.test(k)) out.push(k.slice(12)); } } catch(e){}
  return out;
}
function projReadIdx(){
  let x = null; try { x = JSON.parse(lsGet(LS_PROJ)); } catch(e){}
  if (!x || typeof x !== 'object') return null;
  const ids = l => [...new Set((Array.isArray(l) ? l : []).filter(i => typeof i === 'string' && PID_RE.test(i)))];
  const open = ids(x.open), recent = ids(x.recent).filter(i => !open.includes(i));
  const meta = {};
  for (const id of [...open, ...recent]){ const m = x.meta && x.meta[id] || {};
    meta[id] = {name:typeof m.name === 'string' ? m.name.slice(0, 200) : _('Projeto'), savedSig:typeof m.savedSig === 'string' ? m.savedSig : null, dirty:!!m.dirty,
      savedAt:Number(m.savedAt) || 0, closedAt:Number(m.closedAt) || 0}; }
  return { v:1, open, recent, meta, active:open.includes(x.active) ? x.active : (open[0] || null) };
}
const projSaveIdx = () => lsSet(LS_PROJ, JSON.stringify(Projects.idx));
/* grava só os dados de um projeto no índice, por cima do que outra janela tenha entretanto gravado (lista e ativo incluídos) */
function projSaveMeta(id){
  const cur = projReadIdx();
  if (!cur){ projSaveIdx(); return; }
  if (cur.open.includes(id) || cur.recent.includes(id)){ cur.meta[id] = Projects.idx.meta[id]; lsSet(LS_PROJ, JSON.stringify(cur)); }
  Projects.idx.meta[id] = projMeta(id); // (a lista e o ativo desta janela acompanham os da outra pelo evento «storage»)
}
/* Índice em falta (primeira vez com esta versão, ou perdido): faz-se a partir dos projetos guardados.
   Também junta ao índice projetos guardados que ele não conheça (duas janelas que arrancaram ao mesmo tempo). */
function projRepair(idx){
  idx = idx || {v:1, open:[], recent:[], meta:{}, active:null};
  for (const id of projStoredIds()) if (!idx.open.includes(id) && !idx.recent.includes(id)){
    let name = _('Projeto'), sig = null;
    try { const raw = localStorage.getItem(projKey(id)), s = sanitize(JSON.parse(raw)); name = s.project.name; sig = projSig(JSON.stringify(s)); } catch(e){}
    // o projeto já existia antes desta versão: não conta como «por guardar em ficheiro» (só o que mudar a partir de agora)
    idx.open.push(id); idx.meta[id] = {name, savedSig:sig, dirty:false, savedAt:0, closedAt:0};
  }
  if (!idx.active || !idx.open.includes(idx.active)) idx.active = idx.open[0] || null;
  return idx;
}
Projects.idx = projRepair(projReadIdx());
projSaveIdx();
LS_KEY = projActive() ? projKey(projActive()) : null;

/* chamada depois de cada gravação automática: atualiza o nome e o estado «por guardar» do projeto ativo */
function projTouched(json){
  const id = projActive(); if (!id || tourMode || Projects.quiet) return;
  const m = projMeta(id), dirty = !isBlankProject(state) && projSig(json) !== m.savedSig, name = state.project.name;
  if (m.dirty !== dirty || m.name !== name){ m.dirty = dirty; m.name = name; projSaveMeta(id); projUI(); }
}

/* ---------- trocar de projeto ---------- */
function projStash(){
  const id = projActive(); if (!id) return;
  if (saveT) flushSave();
  Projects.hist.set(id, {undo:Hist.undo, redo:Hist.redo, last:Hist.last});
}
/* passa a mostrar o projeto «id» (ou a página inicial, com null); usada também quando outra janela troca de projeto */
function projActivate(id){
  cancelDrags(); closeAllModals(); closeMenu(); endPickLink();
  LS_KEY = id ? projKey(id) : null;
  state = loadState();
  const h0 = id && Projects.hist.get(id);
  if (h0 && h0.last === JSON.stringify(state)){ Hist.undo = h0.undo; Hist.redo = h0.redo; Hist.last = h0.last; Hist.lastSoft = false; updateHistUI(); }
  else histInit();
  if (!id) activeTab = 'board';
  applyPalette(); renderAll(); setSaveUI('ok');
  if (typeof syncProjectChanged === 'function') syncProjectChanged();
}
function projSwitch(id){
  if (tourMode || id === projActive() || !Projects.idx.open.includes(id)) return;
  projStash(); Projects.idx.active = id; projSaveIdx(); projActivate(id);
}
/* acrescenta um projeto aos abertos e passa a mostrá-lo */
function projAdd(data, o){
  o = o || {}; if (tourMode) return null;
  const id = o.id && PID_RE.test(o.id) ? o.id : uid('p'), json = JSON.stringify(data);
  try { localStorage.setItem(projKey(id), json); } catch(e){ toast(_('Não há espaço neste dispositivo para mais um projeto. Remova projetos de que já não precise (na página inicial, em «Projetos recentes») e tente outra vez.')); return null; }
  projStash();
  const I = Projects.idx; I.recent = I.recent.filter(x => x !== id); if (!I.open.includes(id)) I.open.push(id);
  Object.assign(projMeta(id), {name:data.project.name, savedSig:o.saved ? projSig(json) : null, dirty:!o.saved && !isBlankProject(data), closedAt:0});
  if (o.saved) projSnap(id, json);
  I.active = id; projSaveIdx(); Projects.hist.delete(id); projActivate(id);
  return id;
}
function newProject(){
  if (tourMode) return;
  projAdd(blankProject()); activeTab = 'board'; renderAll();
  toast(_('Novo projeto criado. Os outros continuam abertos, no menu do nome do projeto.'));
}
/* reabrir um projeto fechado há pouco */
function projReopen(id){
  if (tourMode || !Projects.idx.recent.includes(id)) return;
  const raw = lsGet(projKey(id)); if (!raw){ projForget(id); return toast(_('Este projeto já não está guardado neste dispositivo.')); }
  projStash(); const I = Projects.idx;
  I.recent = I.recent.filter(x => x !== id); I.open.push(id); projMeta(id).closedAt = 0; I.active = id; projSaveIdx(); projActivate(id);
}

/* ---------- fechar ---------- */
/* pergunta com três respostas: «save», «discard» ou null (cancelar) */
function askSaveBeforeClose(name, never){
  return new Promise(res => {
    let done = false; const fin = v => { if (done) return; done = true; res(v); m.close(); };
    const body = h('div', {class:'modal-body'},
      h('p', {style:{marginTop:0}}, never ? _('O projeto «{nome}» nunca foi guardado num ficheiro. Quer guardá-lo antes de fechar?', {nome:name}) : _('Quer guardar as alterações a «{nome}» antes de fechar?', {nome:name})),
      h('p', {class:'proj-warn small'}, never ? _('Se fechar sem guardar, o projeto e todo o seu conteúdo serão perdidos.') : _('Se fechar sem guardar, as alterações feitas desde a última vez que o guardou serão perdidas.')),
      h('div', {class:'modal-foot'}, h('button', {class:'btn', onclick:() => fin(null)}, _('Cancelar')), h('button', {class:'btn', onclick:() => fin('discard')}, _('Fechar sem guardar')),
        h('button', {class:'btn primary', onclick:() => fin('save')}, _('Guardar e fechar'))));
    const m = openModal({title:_('Fechar Projeto'), body, onClose:() => fin(null)});
    m.keep = true; body.querySelector('.btn.primary').focus();
  });
}
async function closeProject(){
  if (tourMode || projNone()) return;
  const id = projActive(); if (saveT) flushSave();
  const m = projMeta(id), never = !m.savedSig, blank = isBlankProject(state);
  let discard = false;
  if (!blank && (m.dirty || never)){
    const a = await askSaveBeforeClose(state.project.name, never);
    if (!a || projActive() !== id) return;
    if (a === 'save' && !await exportProject()) return; // a gravação foi cancelada: o projeto fica aberto
    discard = a === 'discard';
  }
  const I = Projects.idx;
  if (discard && never){ // nunca guardado: o projeto desaparece
    Projects.hist.delete(id); Projects.handles.delete(id); I.open = I.open.filter(x => x !== id); projDrop(id);
    I.active = I.open[I.open.length - 1] || null; projSaveIdx(); projActivate(I.active);
    return toast(_('«{nome}» fechado sem guardar.', {nome:m.name || _('Projeto')}));
  }
  if (discard){ // volta à versão guardada no ficheiro
    const raw = lsGet(snapKey(id));
    if (raw){ try { localStorage.setItem(projKey(id), raw); m.dirty = false; try { m.name = JSON.parse(raw).project.name; } catch(e){} } catch(e){ toast(_('Não foi possível repor a versão guardada; o projeto fica com as alterações, nos projetos recentes.')); } }
    else toast(_('Não há cópia da versão guardada neste dispositivo; o projeto fica com as alterações, nos projetos recentes.'));
  }
  Projects.hist.delete(id); Projects.handles.delete(id);
  I.open = I.open.filter(x => x !== id); I.recent = [id, ...I.recent.filter(x => x !== id)];
  m.closedAt = Date.now();
  // os recentes mais antigos saem da lista (e deste dispositivo) — mas nunca um com alterações por guardar em ficheiro
  for (let i = I.recent.length - 1; I.recent.length > RECENT_MAX && i >= 0; i--){ const x = I.recent[i]; if (!projMeta(x).dirty){ I.recent.splice(i, 1); projDrop(x); } }
  I.active = I.open[I.open.length - 1] || null; projSaveIdx();
  projActivate(I.active);
  toast(I.active ? _('«{nome}» fechado.', {nome:m.name}) : _('«{nome}» fechado. Pode reabri-lo em «Projetos recentes».', {nome:m.name}));
}
/* apaga de vez um projeto fechado (e os ficheiros das suas Referências que nenhum outro projeto use) */
function projDrop(id){
  let refs = []; try { refs = (JSON.parse(lsGet(projKey(id))).refs || []).map(r => r.id); } catch(e){}
  try { localStorage.removeItem(projKey(id)); localStorage.removeItem(snapKey(id)); } catch(e){}
  delete Projects.idx.meta[id];
  const used = projAllRefIds(); if (used) refs.filter(r => !used.has(r)).forEach(r => idb.del(r).catch(() => {}));
}
async function projForget(id){
  const I = Projects.idx; if (!I.recent.includes(id)) return;
  const name = projMeta(id).name;
  if (!await confirmDialog(_('Remover «{nome}» dos projetos recentes? O projeto deixa de estar guardado neste dispositivo (um ficheiro que tenha guardado continua a poder ser aberto).', {nome:name}), {title:_('Remover projeto'), ok:_('Remover')})) return;
  I.recent = I.recent.filter(x => x !== id); projDrop(id); projSaveIdx(); projUI();
}
/* as Referências de todos os projetos guardados neste dispositivo (para não apagar ficheiros de outro projeto) */
function projAllRefIds(){
  const set = new Set(); const I = Projects.idx;
  // todos os projetos guardados neste dispositivo, mesmo os que o índice não conheça, e as cópias de projetos danificados;
  // o projeto ativo conta pelo que está em memória (a cópia gravada pode ainda ter uma Referência acabada de eliminar)
  const keys = new Set(projStoredIds().map(projKey)); try { for (let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if (/^narrativa\.(p\.|project\.v1).*\.(danificado|guardado)$/.test(k)) keys.add(k); } } catch(e){}
  for (const k of keys) if (k !== LS_KEY || !state){
    const raw = lsGet(k); if (!raw) continue;
    try { (JSON.parse(raw).refs || []).forEach(r => set.add(r.id)); } catch(e){ return null; } } // um projeto ilegível: não se sabe que ficheiros usa, por isso nada se apaga
  if (state && !projNone()) state.refs.forEach(r => set.add(r.id));
  return set;
}

/* ---------- guardar e abrir ficheiros ---------- */
function projFileName(){ return (state.project.name.replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'projeto') + '.narrativa.json'; }
async function projFileData(){
  const data = JSON.parse(JSON.stringify(state)); data.pid = projActive(); data.files = {};
  for (const r of state.refs) if (r.fileName){ try { const b = await idb.get(r.id); if (b) data.files[r.id] = await blobToDataURL(b); } catch(e){} }
  return new Blob([JSON.stringify(data)], {type:'application/json'});
}
/* Guarda num ficheiro. Onde o browser o permite (Chrome e Edge no PC), escolhe-se o sítio uma vez e as gravações seguintes
   desta sessão vão para o mesmo ficheiro; nos outros, o ficheiro é descarregado. Devolve false se for cancelado. */
async function exportProject(){
  if (tourMode || projNone()) return false;
  if (saveT) flushSave();
  const id = projActive(), json = JSON.stringify(state), blob = await projFileData();
  let done = false;
  if (window.showSaveFilePicker && !coarse()){
    try {
      let hd = Projects.handles.get(id);
      if (!hd){ hd = await window.showSaveFilePicker({suggestedName:projFileName(), types:[{description:_('Projeto do Narrative'), accept:{'application/json':['.json']}}]}); Projects.handles.set(id, hd); }
      const w = await hd.createWritable(); await w.write(blob); await w.close(); done = true;
    } catch(e){ if (e && e.name === 'AbortError') return false; Projects.handles.delete(id); } // outro erro: descarrega
  }
  if (!done){
    const a = h('a', {href:URL.createObjectURL(blob), download:projFileName()});
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const m = projMeta(id); m.savedSig = projSig(json); m.dirty = false; m.savedAt = Date.now(); projSnap(id, json); projSaveMeta(id); projUI();
  toast(_('«{nome}» guardado.', {nome:state.project.name}));
  return true;
}
/* abre um ficheiro como mais um projeto; se for um projeto já aberto, pergunta se substitui o que está aberto */
async function importProject(file){
  if (tourMode) return;
  let data, files, pid; // o ficheiro é validado e normalizado antes de se tocar em qualquer projeto
  try { data = JSON.parse(await file.text()); if (!Array.isArray(data.books) || !data.scenes || typeof data.scenes !== 'object') throw 0;
    files = data.files && typeof data.files === 'object' ? data.files : {}; pid = typeof data.pid === 'string' && PID_RE.test(data.pid) ? data.pid : null;
    delete data.files; delete data.pid; data = sanitize(data); }
  catch(e){ return toast(_('O ficheiro não é um projeto válido.')); }
  const I = Projects.idx;
  if (pid && I.open.includes(pid)){
    const name = projMeta(pid).name;
    if (!await confirmDialog(_('O projeto «{nome}» já está aberto. Substituir o que está aberto pela versão deste ficheiro? Se escolher «Cancelar», passa apenas a mostrar o que já está aberto.', {nome:name}), {title:_('Abrir Projeto'), ok:_('Substituir')})){ projSwitch(pid); return; }
  } else if (pid && I.recent.includes(pid)){
    const name = projMeta(pid).name;
    if (!await confirmDialog(projMeta(pid).dirty ? _('O projeto «{nome}» está nos projetos recentes deste dispositivo, com alterações que não foram guardadas em ficheiro. Substituí-lo pela versão deste ficheiro? Se escolher «Cancelar», é reaberto como estava.', {nome:name}) : _('O projeto «{nome}» está nos projetos recentes deste dispositivo. Substituí-lo pela versão deste ficheiro? Se escolher «Cancelar», é reaberto como estava.', {nome:name}), {title:_('Abrir Projeto'), ok:_('Substituir')})){ projReopen(pid); return; }
  }
  // Referências com o mesmo identificador noutro projeto (um ficheiro aberto como cópia de outro): ganham identificadores novos
  const used = new Set(); for (const id of [...I.open, ...I.recent]) if (id !== pid){ try { (JSON.parse(lsGet(projKey(id))).refs || []).forEach(r => used.add(r.id)); } catch(e){} }
  if (pid !== projActive() && !projNone()) state.refs.forEach(r => used.add(r.id));
  for (const r of data.refs) if (used.has(r.id)){ const nid = uid('r'); if (files[r.id]){ files[nid] = files[r.id]; delete files[r.id]; } r.id = nid; }
  // só se aceitam ficheiros embutidos (data:), nunca endereços externos
  try { for (const r of data.refs) if (files[r.id] && /^data:/.test(files[r.id])) await idb.put(r.id, await (await fetch(files[r.id])).blob()); } catch(e){ toast(_('Algumas Referências não puderam ser abertas.')); }
  if (Tour.active) endTour();
  if (pid && I.open.includes(pid)){ // substituir o que está aberto
    const json = JSON.stringify(data);
    projStash(); // a gravação pendente vai para o sítio certo antes de o projeto ser substituído
    try { localStorage.setItem(projKey(pid), json); } catch(e){ return toast(_('Não há espaço neste dispositivo para abrir o projeto.')); }
    Object.assign(projMeta(pid), {name:data.project.name, savedSig:projSig(json), dirty:false}); projSnap(pid, json);
    Projects.hist.delete(pid); I.active = pid; markReset(); projSaveIdx(); projActivate(pid);
  } else if (!projAdd(data, {id:pid, saved:true})) return;
  activeTab = 'board'; renderAll(); toast(_('«{nome}» aberto.', {nome:data.project.name}));
}
function pickProjectFile(){
  const inp = h('input', {type:'file', accept:'.json,application/json', hidden:true, onchange:e => { const f = e.target.files[0]; if (f) importProject(f); inp.remove(); }});
  document.body.append(inp); inp.click();
}

/* ---------- seletor na barra de topo ---------- */
function projMenu(){
  const b = $('#projBtn'); if (!b || tourMode) return;
  if (Projects.menuWasOpen){ Projects.menuWasOpen = false; return; } // o mesmo clique que fechou o menu não o volta a abrir
  const r = b.getBoundingClientRect(), I = Projects.idx;
  const row = id => { const m = projMeta(id), on = id === projActive();
    return { label:h('span', {class:'proj-item' + (on ? ' on' : '')}, h('span', {class:'proj-check', 'aria-hidden':'true'}, on ? '✓' : ''), h('span', {class:'proj-nm'}, m.name),
      m.dirty ? h('span', {class:'proj-dirty', title:_('Alterações por guardar em ficheiro')}, '●') : null), action:() => projSwitch(id) }; };
  showMenu(r.left, r.bottom + 4, [...I.open.map(row), '-',
    {label:_('Novo Projeto'), action:newProject}, {label:_('Abrir Projeto…'), action:pickProjectFile},
    {label:_('Guardar Projeto'), action:exportProject}, {label:_('Fechar Projeto'), action:closeProject}]);
  b.setAttribute('aria-expanded', 'true');
  const menu = document.querySelector('.ctx-menu');
  if (menu){ menu.classList.add('proj-menu'); menu.onClose = () => { b.setAttribute('aria-expanded', 'false'); if (!document.activeElement || document.activeElement === document.body) b.focus({preventScroll:true}); };
    const first = menu.querySelector('.ctx-item'); first && first.focus({preventScroll:true}); }
}
function projUI(){
  const none = projNone() && !Tour.active, b = $('#projBtn');
  document.body.classList.toggle('no-project', none);
  if (b){ b.hidden = none; b.setAttribute('aria-expanded', String(!!document.querySelector('.proj-menu')));
    const dirty = !projNone() && projMeta(projActive()).dirty && !tourMode;
    b.classList.toggle('dirty', dirty); document.body.classList.toggle('proj-dirty', dirty); b.setAttribute('aria-label', dirty ? _('Projeto: {nome} (alterações por guardar em ficheiro). Abrir a lista de projetos', {nome:state ? state.project.name : ''}) : _('Projeto: {nome}. Abrir a lista de projetos', {nome:state ? state.project.name : ''})); }
  const L = $('#landing'); if (!L) return;
  L.hidden = !none;
  if (none) renderLanding(L);
  if (none) document.title = 'Narrative';
}

/* a silhueta de um projeto: as linhas dos seus Arcos Narrativos ao longo da narrativa, em miniatura (sem texto) */
function projThumb(id){
  let d = null; try { d = JSON.parse(lsGet(projKey(id))); } catch(e){}
  const W = 132, H = 44, box = h('span', {class:'land-thumb', 'aria-hidden':'true'});
  if (!d || !Array.isArray(d.books) || !d.scenes) return box;
  const order = []; d.books.forEach(b => (b.chapters || []).forEach(c => (c.scenes || []).forEach(s => { if (d.scenes[s]) order.push(s); })));
  const arcs = (d.arcs || []).filter(a => a && order.some(s => d.scenes[s].arcId === a.id)), n = order.length, rows = Math.max(arcs.length, 1);
  if (!n){ box.classList.add('empty'); return box; }
  const x = i => n === 1 ? W / 2 : 6 + i * (W - 12) / (n - 1), y = r => rows === 1 ? H / 2 : 7 + r * (H - 14) / (rows - 1);
  let out = '', bx = 0; d.books.forEach((b, bi) => { const k = (b.chapters || []).reduce((t, c) => t + (c.scenes || []).filter(s => d.scenes[s]).length, 0); if (bi && k && bx) out += '<path class="lt-book" d="M' + (x(bx) - (W - 12) / Math.max(1, n - 1) / 2).toFixed(1) + ',2V' + (H - 2) + '"/>'; bx += k; });
  arcs.forEach((a, r) => { const pts = order.map((s, i) => d.scenes[s].arcId === a.id ? [x(i), y(r)] : null).filter(Boolean), col = arcStroke(a);
    out += '<path d="M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L') + '" stroke="' + col + '"/>' + pts.map(p => '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.2" fill="' + col + '"/>').join(''); });
  box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '">' + out + '</svg>'; return box;
}

/* ---------- página inicial (sem projetos abertos) ---------- */
function renderLanding(L){
  L.innerHTML = '';
  const I = Projects.idx;
  const card = (ic, title, text, fn, primary) => h('button', {class:'land-card' + (primary ? ' primary' : ''), onclick:fn}, h('span', {class:'land-ic', 'aria-hidden':'true'}, svgIcon(ic)), h('span', {class:'land-t'}, title), h('span', {class:'land-d'}, text));
  const logo = $('#topbar .logo').cloneNode(true); logo.classList.add('land-logo');
  add(L, h('div', {class:'land'},
    logo,
    h('h1', null, 'Narrative'),
    h('p', {class:'muted'}, _('Construa, desenhe e reorganize a sua narrativa: Tomos, Capítulos, Cenas e Arcos Narrativos num só quadro.')),
    h('div', {class:'land-cards'},
      card('plus', _('Criar novo Projeto'), _('Começa um projeto em branco.'), newProject, true),
      card('folder', _('Abrir Projeto'), _('Abre um projeto guardado num ficheiro.'), pickProjectFile),
      card('help', _('Correr visita guiada'), _('Mostra as principais funcionalidades em cerca de três minutos, sem alterar nada.'), () => startTour())),
    h('div', {class:'land-cards land-more'},
      card('spark', _('Começar com um exemplo'), _('Abre uma pequena narrativa já preenchida, para explorar, alterar e apagar à vontade.'), startExample),
      card('template', _('Começar de um modelo'), _('Três atos, jornada do herói ou duas linhas temporais: a estrutura fica criada, vazia, pronta a preencher.'), templateDialog)),
    h('p', {class:'small'}, h('button', {class:'linkish', onclick:() => startTour('deep')}, _('Ou faça já a visita detalhada')), h('span', {class:'muted'}, _(' — mais longa, funcionalidade a funcionalidade.'))),
    I.recent.length ? h('div', {class:'land-recent'}, h('h2', null, _('Projetos recentes')),
      I.recent.map((id, i) => { const m = projMeta(id);
        return h('div', {class:'list-row land-proj'}, projThumb(id), h('button', {class:'grow land-reopen', onclick:() => projReopen(id)}, h('b', null, m.name),
          h('span', {class:'muted small'}, m.closedAt ? _(' · fechado a {data}', {data:new Date(m.closedAt).toLocaleString(LOCALE, {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}) : '', m.dirty ? _(' · com alterações por guardar em ficheiro') : '')),
          h('button', {class:'btn small' + (i === 0 ? ' primary' : ''), onclick:() => projReopen(id)}, i === 0 ? _('Continuar') : _('Reabrir')), h('button', {class:'btn small', 'aria-label':_('Remover {nome}', {nome:m.name}), onclick:() => projForget(id)}, _('Remover'))); }))
      : null));
}

/* ---------- importar de outro projeto aberto: Personagens, Localizações e Referências ----------
   Copia para o projeto à vista o que se escolher de outro projeto aberto (o outro não é alterado). O que já existe cá com
   o mesmo nome fica assinalado e por escolher. As Localizações trazem a ligação às Personagens que também vierem (ou que
   já cá estejam, pelo nome); as Referências trazem os ficheiros e as ligações a essas Personagens e Localizações — as
   ligações a Cenas, Tomos e Arcos do outro projeto não vêm, porque essas coisas ficam lá. */
const IMPORT_KINDS = [['characters', _('Personagens'), 'people'], ['sceneries', _('Localizações'), 'pin'], ['refs', _('Referências'), 'mark']];
function importSource(id){ try { return sanitize(JSON.parse(lsGet(projKey(id)))); } catch(e){ return null; } }
function importDialog(pre){
  if (tourMode || projNone()) return;
  const others = Projects.idx.open.filter(id => id !== projActive());
  if (!others.length) return toast(_('Só se importa de outro projeto aberto. Abra-o primeiro: no menu do nome do projeto, «Abrir Projeto…».'));
  let src = others[0], data = null, m = null; const sel = {characters:new Set(), sceneries:new Set(), refs:new Set()};
  const lower = x => String(x || '').trim().toLowerCase();
  const exists = { characters:c => state.characters.some(x => lower(x.name) === lower(c.name)), sceneries:c => state.sceneries.some(x => lower(x.name) === lower(c.name)),
    refs:r => state.refs.some(x => x.type === r.type && lower(x.title) === lower(r.title) && lower(x.url) === lower(r.url) && lower(x.fileName) === lower(r.fileName)) };
  const label = { characters:c => c.name, sceneries:c => c.name, refs:r => r.title || _('Sem título') };
  const body = h('div', {class:'modal-body imp-body'});
  const load = () => { data = importSource(src); for (const k in sel) sel[k].clear();
    if (data && pre && data[pre]) data[pre].forEach(x => { if (!exists[pre](x)) sel[pre].add(x.id); }); };
  const total = () => sel.characters.size + sel.sceneries.size + sel.refs.size;
  const draw = () => {
    const pick = others.length > 1 ? field(_('Importar do projeto'), selectEl(others.map(id => ({value:id, label:projMeta(id).name})), src, v => { src = v; load(); draw(); })) : h('p', {class:'muted', style:{margin:'0 0 10px'}}, _('Do projeto «{nome}».', {nome:projMeta(src).name}));
    if (!data) return body.replaceChildren(pick, h('p', {class:'muted'}, _('Não foi possível ler esse projeto.')));
    const group = ([k, name, ic]) => { const list = data[k] || [], free = list.filter(x => !exists[k](x)), all = free.length > 0 && free.every(x => sel[k].has(x.id));
      return h('div', {class:'imp-group', dataset:{kind:k}},
        h('div', {class:'imp-head'}, svgIcon(ic), h('b', null, name), h('span', {class:'muted small'}, list.length ? _('{n} de {total} escolhidas', {n:sel[k].size, total:list.length}) : _('nenhuma')),
          free.length ? h('button', {class:'btn small imp-all', onclick:() => { if (all) free.forEach(x => sel[k].delete(x.id)); else free.forEach(x => sel[k].add(x.id)); draw(); }}, all ? _('Nenhuma') : _('Todas')) : null),
        list.length ? h('div', {class:'imp-list'}, list.map(x => { const dup = exists[k](x);
          return h('label', {class:'imp-item' + (dup ? ' dup' : '')}, h('input', {type:'checkbox', checked:sel[k].has(x.id), onchange:e => { if (e.target.checked) sel[k].add(x.id); else sel[k].delete(x.id); draw(); }}),
            k === 'refs' ? refIcon(x.type) : null, h('span', {class:'imp-name'}, label[k](x)), dup ? h('span', {class:'badge'}, _('já existe')) : null); })) : null); };
    const n = total();
    body.replaceChildren(pick, ...IMPORT_KINDS.map(group),
      h('p', {class:'muted small'}, _('O que escolher é copiado para este projeto; o outro não é alterado. As ligações a Cenas, Tomos e Arcos Narrativos do outro projeto não vêm.')),
      h('div', {class:'modal-foot'}, h('button', {class:'btn', onclick:() => m.close()}, _('Cancelar')),
        h('button', {class:'btn primary imp-go', disabled:!n, onclick:async () => { const done = await importFrom(data, sel); m.close(); if (done) toast(done); }}, n ? _n(n, 'Importar {n} elemento', 'Importar {n} elementos') : _('Importar'))));
  };
  load(); m = openModal({title:_('Importar de outro projeto'), body, wide:true, cls:'imp-modal'}); draw();
}
async function importFrom(data, sel){
  const lower = x => String(x || '').trim().toLowerCase(), cmap = {}, smap = {}; let nc = 0, ns = 0, nr = 0;
  /* quem não vem mas já cá está com o mesmo nome continua a contar para as ligações */
  data.characters.forEach(c => { const here = state.characters.find(x => lower(x.name) === lower(c.name));
    if (sel.characters.has(c.id)){ const n = Object.assign({}, c, {id:uid('ch')}); state.characters.push(n); cmap[c.id] = n.id; nc++; } else if (here) cmap[c.id] = here.id; });
  data.sceneries.forEach(x => { const here = state.sceneries.find(y => lower(y.name) === lower(x.name));
    if (sel.sceneries.has(x.id)){ const n = Object.assign({}, x, {id:uid('sc'), chars:[...new Set((x.chars || []).map(c => cmap[c]).filter(Boolean))]}); state.sceneries.push(n); smap[x.id] = n.id; ns++; } else if (here) smap[x.id] = here.id; });
  for (const r of data.refs){ if (!sel.refs.has(r.id)) continue;
    const links = (r.links || []).map(l => l.kind === 'character' && cmap[l.id] ? {kind:'character', id:cmap[l.id]} : l.kind === 'scenery' && smap[l.id] ? {kind:'scenery', id:smap[l.id]} : null).filter(Boolean);
    const n = Object.assign({}, r, {id:uid('r'), links, created:Date.now() + nr});
    if (r.fileName){ try { const blob = await idb.get(r.id); if (blob) await idb.put(n.id, blob); } catch(e){} } // o ficheiro vem com a Referência
    state.refs.push(n); nr++; }
  if (!(nc + ns + nr)) return '';
  commit();
  const parts = [nc ? _n(nc, '{n} Personagem', '{n} Personagens') : null, ns ? _n(ns, '{n} Localização', '{n} Localizações') : null, nr ? _n(nr, '{n} Referência', '{n} Referências') : null].filter(Boolean);
  return _('Importado: {lista}.', {lista:parts.join(', ')});
}

/* ---------- primeiros passos: um exemplo para mexer e modelos de estrutura ---------- */
function startExample(){
  if (tourMode) return;
  const d = sanitize(demoProject()); d.project.palette = {h:homeHue(), mode:'dark'}; // com as cores escolhidas na página inicial
  if (!projAdd(d)) return;
  activeTab = 'board'; renderAll();
  toast(_('Exemplo aberto. É um projeto como os outros: pode alterá-lo, guardá-lo ou fechá-lo.'));
}
const TEMPLATES = [
  ['atos', _('Três atos'), _('Apresentação, confronto e resolução: a estrutura clássica, num Tomo com três Capítulos.')],
  ['heroi', _('Jornada do herói'), _('As doze etapas, do mundo comum ao regresso com o elixir: um Capítulo para cada uma.')],
  ['linhas', _('Duas linhas temporais'), _('Dois Arcos Narrativos, «Presente» e «Passado», que se alternam ao longo dos Capítulos.')]];
function templateProject(k){
  if (tourMode || !projAdd(blankProject())) return;
  const chapters = { atos:[_('Ato I — Apresentação'), _('Ato II — Confronto'), _('Ato III — Resolução')],
    heroi:[_('O mundo comum'), _('A chamada à aventura'), _('A recusa da chamada'), _('O encontro com o mentor'), _('A travessia do primeiro limiar'), _('Provas, aliados e inimigos'),
      _('A aproximação da caverna oculta'), _('A provação'), _('A recompensa'), _('O caminho de volta'), _('A ressurreição'), _('O regresso com o elixir')],
    linhas:[_('Abertura'), _('As duas linhas avançam'), _('As duas linhas aproximam-se'), _('Desfecho')] }[k];
  const arcs = { atos:[_('Trama principal')], heroi:[_('Jornada do herói')], linhas:[_('Presente'), _('Passado')] }[k];
  state.books[0].chapters = chapters.map(n => ({id:uid('c'), name:n, scenes:[]}));
  arcs.forEach(n => newArc(n));
  activeTab = 'board'; commit(); histInit(); // o projeto começa aqui: não há nada para anular
  toast(_('Modelo criado: os Capítulos e os Arcos Narrativos estão prontos a receber Cenas.'));
}
function templateDialog(){
  if (tourMode) return; let m = null;
  m = openModal({title:_('Começar de um modelo'), body:h('div', {class:'modal-body'},
    h('p', {class:'muted', style:{marginTop:'0'}}, _('O modelo cria os Capítulos e os Arcos Narrativos, sem Cenas. Depois pode mudar tudo: nomes, ordem e número de Capítulos.')),
    h('div', {class:'tpl-list'}, TEMPLATES.map(([k, name, desc]) => h('button', {class:'tpl-item', dataset:{tpl:k}, onclick:() => { m.close(); templateProject(k); }}, h('b', null, name), h('span', {class:'muted small'}, desc)))))});
}

/* ---------- outra janela deste dispositivo mudou a lista ou o projeto ativo ---------- */
window.addEventListener('storage', e => {
  if (e.key !== LS_PROJ || !state) return;
  const fresh = projReadIdx(); if (!fresh) return;
  const was = projActive();
  if (saveT && !Tour.active && fresh.active !== was){ Projects.quiet = true; try { flushSave(); } finally { Projects.quiet = false; } } // ainda no projeto anterior
  Projects.idx = fresh;
  if (Tour.active){ projUI(); return; } // no fim da visita, endTour acerta o projeto mostrado
  if (fresh.active !== was){ if (was) Projects.hist.set(was, {undo:Hist.undo, redo:Hist.redo, last:Hist.last}); projActivate(fresh.active); }
  else projUI();
});

/* ---------- aviso ao sair com projetos por guardar em ficheiro ---------- */
const leaveWarnOn = () => lsGet(LS_LEAVE) !== '0';
window.addEventListener('beforeunload', e => {
  if (Projects.leaving || !leaveWarnOn() || tourMode || Dual.role === 'second') return;
  if (Projects.idx.open.some(id => projMeta(id).dirty)){ e.preventDefault(); e.returnValue = ''; } // o browser mostra a sua própria pergunta
});

function initProjects(){
  // na janela e na fase de captura: antes de o clique fora do menu o fechar
  window.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('#projBtn')) Projects.menuWasOpen = !!document.querySelector('.proj-menu'); }, true);
  $('#projBtn').addEventListener('click', projMenu);
  $('#projNewBtn').addEventListener('click', newProject);
  $('#projSaveBtn').addEventListener('click', () => exportProject());
  $('#projOpenBtn').addEventListener('click', pickProjectFile);
  $('#projCloseBtn').addEventListener('click', () => closeProject());
  const r0 = Upd.reload; Upd.reload = () => { Projects.leaving = true; r0(); }; // a atualização automática não pergunta nada (o projeto fica gravado neste dispositivo)
  projUI();
}
window.addEventListener('DOMContentLoaded', initProjects);
