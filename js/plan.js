'use strict';
/* ===== Calendarização e Objetivos =====
   Três fases: Pesquisa e Planeamento (objetivos de pesquisa, gerais ou ligados a um Book, Chapter ou Scene), Escrita e Revisão
   (Scene a Scene). Um Chapter está completo quando todas as suas Scenes estão; um Book, quando todos os seus Chapters estão —
   tudo calculado na hora, por isso acrescentar, mover ou eliminar Scenes atualiza logo as percentagens.
   Prazos em Scenes, Chapters, Books, objetivos e fases; calendário mensal; exportação para Google Calendar, Apple Calendar e
   Outlook / Teams (ficheiro .ics com identificadores fixos e ligações «Adicionar»). Não há servidor: a sincronização com esses
   calendários é num só sentido, da ferramenta para eles. */

const STAGES = { write:_('Escrita'), review:_('Revisão') };
const GOAL_TYPES = [
  ['livro', '📖', _('Consultar um livro')], ['mapa', '🗺️', _('Consultar um mapa')], ['local', '📍', _('Visitar um local')], ['entrevista', '🎙️', _('Entrevistar uma pessoa')],
  ['documentario', '🎬', _('Ver um documentário ou filme')], ['podcast', '🎧', _('Ouvir um podcast')], ['documento', '📄', _('Ler um artigo ou documento')],
  ['arquivo', '🏛️', _('Consultar um arquivo ou museu')], ['internet', '🔎', _('Pesquisar na internet')], ['outro', '✳️', _('Outro')]];
const goalType = k => GOAL_TYPES.find(t => t[0] === k) || GOAL_TYPES[GOAL_TYPES.length - 1];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/, TIME_RE = /^\d{2}:\d{2}$/;
const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const isoLocal = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const fmtDate = (iso, long) => iso ? new Date(iso + 'T12:00').toLocaleDateString(LOCALE, long ? {weekday:'short', day:'numeric', month:'long', year:'numeric'} : {day:'numeric', month:'short', year:'numeric'}) : '';
const goalById = id => (state.goals || []).find(g => g.id === id);

/* Só se guarda o que tem valor: uma Scene sem prazo nem conclusão não leva «prog», um Book sem prazos não leva «due».
   Assim, o que a normalização produz é igual ao que se cria durante o uso — condição para a sincronização comparar bem. */
const NO_STAGE = Object.freeze({done:false, at:0, due:null}), NO_PHASE = Object.freeze({start:null, end:null});
const emptyStage = x => !x.done && !x.due;
/* ---------- normalização (chamada pelo sanitize) ---------- */
function sanitizePlan(d){
  const date = v => typeof v === 'string' && DATE_RE.test(v) ? v : null;
  const stage = v => { v = v && typeof v === 'object' ? v : {}; const done = !!v.done; return {done, at:done ? Number(v.at) || 0 : 0, due:date(v.due)}; };
  for (const id in d.scenes){ const s = d.scenes[id]; const p = s.prog && typeof s.prog === 'object' ? s.prog : {};
    const w = stage(p.write), rv = stage(p.review);
    if (!w.done){ rv.done = false; rv.at = 0; } // só se revê o que está escrito
    if (emptyStage(w) && emptyStage(rv)) delete s.prog; else s.prog = {write:w, review:rv}; }
  const dues = x => { const v = x.due && typeof x.due === 'object' ? x.due : {}; const o = {write:date(v.write), review:date(v.review)};
    if (o.write || o.review) x.due = o; else delete x.due; };
  d.books.forEach(b => { dues(b); b.chapters.forEach(dues); });
  const pl = d.plan && typeof d.plan === 'object' ? d.plan : {}, ph = v => { v = v && typeof v === 'object' ? v : {}; return {start:date(v.start), end:date(v.end)}; };
  d.plan = {research:ph(pl.research), write:ph(pl.write), review:ph(pl.review)};
  if (!['research', 'write', 'review'].some(k => d.plan[k].start || d.plan[k].end)) delete d.plan;
  const chapters = new Set(); d.books.forEach(b => b.chapters.forEach(c => chapters.add(c.id)));
  const ok = { project:() => true, book:id => d.books.some(b => b.id === id), chapter:id => chapters.has(id), scene:id => !!d.scenes[id] };
  const seen = new Set();
  d.goals = (Array.isArray(d.goals) ? d.goals : []).filter(g => g && typeof g === 'object' && !(g.id != null && seen.has(String(g.id))) && (g.id == null || seen.add(String(g.id)))).map(g => {
    const t = g.target && typeof g.target === 'object' && Object.prototype.hasOwnProperty.call(ok, g.target.kind) && ok[g.target.kind](String(g.target.id)) ? {kind:g.target.kind, id:g.target.kind === 'project' ? null : String(g.target.id)} : {kind:'project', id:null};
    return {id:String(g.id || uid('g')), title:g.title == null ? '' : String(g.title), type:GOAL_TYPES.some(x => x[0] === g.type) ? g.type : 'outro', target:t,
      due:date(g.due), time:typeof g.time === 'string' && TIME_RE.test(g.time) ? g.time : null, notes:g.notes == null ? '' : String(g.notes), done:!!g.done, at:Number(g.at) || 0};
  });
  return d;
}

/* ---------- leitura e escrita (sem criar campos vazios) ---------- */
const stg = (s, k) => (s && s.prog && s.prog[k]) || NO_STAGE;
function editStage(s, fn){
  if (!s.prog) s.prog = {write:{done:false, at:0, due:null}, review:{done:false, at:0, due:null}};
  fn(s.prog);
  if (!s.prog.write.done){ s.prog.review.done = false; s.prog.review.at = 0; }
  if (emptyStage(s.prog.write) && emptyStage(s.prog.review)) delete s.prog;
}
const dueOf = (x, k) => (x && x.due && x.due[k]) || null;
function setDue(x, k, v){ x.due = x.due || {write:null, review:null}; x.due[k] = DATE_RE.test(v) ? v : null; if (!x.due.write && !x.due.review) delete x.due; commit(); redrawTop(); }
const phaseOf = k => (state.plan && state.plan[k]) || NO_PHASE;
function setPhase(k, f, v){
  state.plan = state.plan || {research:{start:null, end:null}, write:{start:null, end:null}, review:{start:null, end:null}};
  state.plan[k][f] = DATE_RE.test(v) ? v : null;
  if (!['research', 'write', 'review'].some(x => state.plan[x].start || state.plan[x].end)) delete state.plan;
  commit();
}

/* ---------- progresso ---------- */
const isDone = (s, k) => stg(s, k).done;
function progOf(scenes, k){ const total = scenes.length, done = scenes.filter(s => isDone(s, k)).length; return {done, total, pct:total ? Math.round(done / total * 100) : 0, complete:total > 0 && done === total}; }
const chapterScenes = c => c.scenes.map(id => state.scenes[id]).filter(Boolean);
const chapterProg = (c, k) => progOf(chapterScenes(c), k);
/* um Book está completo quando todos os seus Chapters estão (um Chapter sem Scenes não está) */
const bookProg = (b, k) => { const p = progOf(bookScenes(b), k); p.complete = p.complete && b.chapters.length > 0 && b.chapters.every(c => chapterProg(c, k).complete); return p; };
const allScenes = () => state.books.flatMap(bookScenes);
const projectProg = k => progOf(allScenes(), k);
function researchProg(){ const g = state.goals || []; const done = g.filter(x => x.done).length; return {done, total:g.length, pct:g.length ? Math.round(done / g.length * 100) : 0, complete:g.length > 0 && done === g.length}; }
/* conclusão global: objetivos de pesquisa + Scenes escritas + Scenes revistas */
function overallProg(){ const r = researchProg(), w = projectProg('write'), v = projectProg('review'); const total = r.total + w.total + v.total, done = r.done + w.done + v.done;
  return {done, total, pct:total ? Math.round(done / total * 100) : 0}; }

/* marcar (ou desmarcar, para reescrever ou rever outra vez) uma Scene */
function setStage(sid, k, val){
  const s = state.scenes[sid]; if (!s) return;
  if (k === 'review' && val && !isDone(s, 'write')) return toast(_('Primeiro marque a Cena como escrita.'));
  const hadReview = isDone(s, 'review');
  editStage(s, p => { p[k].done = !!val; p[k].at = val ? Date.now() : 0; });
  if (k === 'write' && !val && hadReview) toast(_('Revisão desmarcada: depois de reescrita, a Cena precisa de ser revista outra vez.'));
  const pos = findScenePos(sid);
  commit(); redrawTop();
  if (val && pos){ // a Scene que faltava fecha o Chapter, ou o Book
    if (bookProg(pos.book, k).complete) toast(k === 'write' ? _('Escrita do Tomo «{nome}» completa.', {nome:pos.book.name}) : _('Revisão do Tomo «{nome}» completa.', {nome:pos.book.name}));
    else if (chapterProg(pos.chapter, k).complete) toast(k === 'write' ? _('Escrita do Capítulo «{nome}» completa.', {nome:pos.chapter.name}) : _('Revisão do Capítulo «{nome}» completa.', {nome:pos.chapter.name}));
  }
}
function setSceneDue(sid, k, v){ const s = state.scenes[sid]; if (!s) return; editStage(s, p => { p[k].due = DATE_RE.test(v) ? v : null; }); commit(); redrawTop(); }

/* ---------- barra em camadas dos Books e Chapters ---------- */
/* Pesquisa por baixo (só se houver objetivos ligados ao Book ou ao Chapter, ou às suas Scenes), Escrita por cima, Revisão por cima de tudo */
function layerProg(kind, obj){
  const scenes = kind === 'book' ? bookScenes(obj) : chapterScenes(obj), sids = new Set(scenes.map(s => s.id));
  const chs = new Set(kind === 'book' ? obj.chapters.map(c => c.id) : [obj.id]);
  const gs = (state.goals || []).filter(g => (kind === 'book' && g.target.kind === 'book' && g.target.id === obj.id) || (g.target.kind === 'chapter' && chs.has(g.target.id)) || (g.target.kind === 'scene' && sids.has(g.target.id)));
  const r = gs.length ? {done:gs.filter(g => g.done).length, total:gs.length} : null; if (r) r.pct = Math.round(r.done / r.total * 100);
  return {r, w:progOf(scenes, 'write'), v:progOf(scenes, 'review')};
}
function layerText(p){
  const sc = _n(p.w.total, '{n} Cena', '{n} Cenas');
  return (p.r ? _('Pesquisa {pct}% ({done} de {total} objetivos)', {pct:p.r.pct, done:p.r.done, total:p.r.total}) + ' · ' : '') + _('Escrita {w}% · Revisão {v}% ({cenas})', {w:p.w.pct, v:p.v.pct, cenas:sc});
}
function layerBar(kind, obj, cls){
  const p = layerProg(kind, obj); if (!p.w.total && !p.r) return null;
  const seg = (c, pct) => h('span', {class:'lb ' + c, style:{width:pct + '%'}});
  return h('div', {class:'lbar' + (cls ? ' ' + cls : ''), role:'img', 'aria-label':layerText(p), dataset:{tip:layerText(p)}},
    p.r ? seg('lb-r', p.r.pct) : null, seg('lb-w', p.w.pct), seg('lb-v', p.v.pct));
}
const layerLegend = () => h('span', {class:'lbar-legend small muted'}, h('span', {class:'ev-dot ev-goal'}), _('Pesquisa') + ' ', h('span', {class:'ev-dot ev-write'}), _('Escrita') + ' ', h('span', {class:'ev-dot ev-review'}), _('Revisão'));

/* ---------- elementos de interface ---------- */
function progBar(p, cls){
  return h('span', {class:'pbar' + (cls ? ' ' + cls : '') + (p.complete ? ' full' : ''), role:'progressbar', 'aria-valuemin':0, 'aria-valuemax':100, 'aria-valuenow':p.pct, 'aria-label':p.pct + '%'},
    h('span', {class:'pbar-fill', style:{width:p.pct + '%'}}));
}
const progLabel = (p, unit) => p.total ? _('{pct}% · {done} de {total} {u}', {pct:p.pct, done:p.done, total:p.total, u:unit}) : _('Sem {u}', {u:unit});
/* grava só com a data completa: ao escrever o ano à mão, o browser avisa a cada algarismo (0002, 0020, 0202…) */
function dueInput(value, onset, label, done){
  const late = value && !done && value < todayISO();
  return h('input', {type:'date', class:'inp due' + (late ? ' late' : ''), value:value || '', 'aria-label':label || _('Prazo'),
    onchange:e => { const v = e.target.value; if (!v || v.slice(0, 4) >= '1900') onset(v); }});
}
/* a ficha aberta por cima mostra logo o novo estado */
const redrawTop = () => { const t = openModals[openModals.length - 1]; if (t && t.redraw) t.redraw(); };
function stageCheck(s, k){
  const done = isDone(s, k), blocked = k === 'review' && !isDone(s, 'write');
  return h('label', {class:'chk' + (blocked ? ' off' : ''), title:blocked ? _('Primeiro marque a Cena como escrita') : ''},
    h('input', {type:'checkbox', checked:done, disabled:blocked, 'aria-label':k === 'write' ? _('Escrita da Cena «{nome}»', {nome:s.title || _('Sem título')}) : _('Revisão da Cena «{nome}»', {nome:s.title || _('Sem título')}), onchange:e => setStage(s.id, k, e.target.checked)}),
    h('span', null, done ? (k === 'write' ? _x('estado', 'Escrita') : _('Revista')) : (k === 'write' ? _('Por escrever') : _('Por rever'))));
}
function targetLabel(t){
  if (!t || t.kind === 'project') return _('Projeto (pesquisa geral)');
  if (t.kind === 'book'){ const b = bookById(t.id); return b ? _('Tomo: ') + b.name : _('Projeto'); }
  if (t.kind === 'chapter'){ const f = findChapter(t.id); return f ? _('Capítulo: {tomo} › {nome}', {tomo:f.book.name, nome:f.chapter.name}) : _('Projeto'); }
  if (t.kind === 'scene'){ const s = state.scenes[t.id]; return s ? _('Cena: ') + (s.title || _('Sem título')) : _('Projeto'); }
  return _('Projeto');
}
function targetOptions(){
  const o = [{value:'project:', label:_('Projeto (pesquisa geral)')}];
  state.books.forEach(b => { o.push({value:'book:' + b.id, label:_('Tomo: ') + b.name});
    b.chapters.forEach((c, ci) => { o.push({value:'chapter:' + c.id, label:'\u00a0\u00a0\u00a0' + _('Capítulo {n}: {nome}', {n:ci + 1, nome:c.name})});
      chapterScenes(c).forEach((s, si) => o.push({value:'scene:' + s.id, label:'\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0' + _('Cena {n}: {nome}', {n:(ci + 1) + '.' + (si + 1), nome:s.title || _('Sem título')})})); }); });
  return o;
}
const goalsFor = (kind, id) => (state.goals || []).filter(g => g.target.kind === kind && (kind === 'project' || g.target.id === id));

/* ---------- objetivos de pesquisa ---------- */
function newGoal(target){
  if (!state.goals) state.goals = [];
  const g = {id:uid('g'), title:'', type:'livro', target:target || {kind:'project', id:null}, due:null, time:null, notes:'', done:false, at:0};
  state.goals.push(g); return g;
}
function openGoalFicha(id, isNew){
  if (!goalById(id)) return;
  const body = h('div', {class:'ficha'});
  const m = openModal({title:_('Objetivo de pesquisa'), body, wide:true});
  const draw = () => {
    const g = goalById(id); if (!g) return closeFicha(m);
    body.innerHTML = '';
    const ev = goalEvent(g);
    add(body,
      field(_('Objetivo'), h('input', {class:'inp', value:g.title, placeholder:_('Ex.: Ler o diário de bordo da Nau Catrineta'), oninput:e => { g.title = e.target.value; touch(); }, onchange:() => draw()})),
      h('div', {class:'row'},
        field(_('Tipo'), selectEl(GOAL_TYPES.map(t => ({value:t[0], label:t[1] + ' ' + t[2]})), g.type, v => { g.type = v; touch(); draw(); })),
        field(_('Associado a'), selectEl(targetOptions(), g.target.kind + ':' + (g.target.id || ''), v => { const [k, i] = v.split(':'); g.target = {kind:k, id:k === 'project' ? null : i}; touch(); draw(); }))),
      h('div', {class:'row'},
        h('div', {class:'fixed'}, field(_('Data'), dueInput(g.due, v => { g.due = DATE_RE.test(v) ? v : null; commit(); draw(); }, _('Data do objetivo'), g.done))),
        h('div', {class:'fixed'}, field(_('Hora (opcional)'), h('input', {type:'time', class:'inp', value:g.time || '', 'aria-label':_('Hora do objetivo'), onchange:e => { g.time = TIME_RE.test(e.target.value) ? e.target.value : null; commit(); draw(); }}))),
        field(_('Estado'), h('label', {class:'chk'}, h('input', {type:'checkbox', checked:g.done, onchange:e => { g.done = e.target.checked; g.at = g.done ? Date.now() : 0; commit(); draw(); }}), h('span', null, g.done ? _('Feito') : _('Por fazer'))))),
      field(_('Notas'), h('textarea', {class:'inp', value:g.notes, placeholder:_('O que procurar, onde, com quem, o que se quer saber…'), oninput:e => { g.notes = e.target.value; save(); }})),
      ev ? field(_('Calendário'), calLinks(ev)) : null,
      refsSection('goal', id, draw),
      h('div', {class:'modal-foot'}, h('button', {class:'btn danger', onclick:async () => {
        if (await confirmDialog(_('Eliminar o objetivo «{nome}»? As Referências associadas mantêm-se.', {nome:g.title || _('Sem título')}), {title:_('Eliminar objetivo'), ok:_('Eliminar')})){
          state.goals = state.goals.filter(x => x.id !== id); state.refs.forEach(r => { r.links = r.links.filter(l => !(l.kind === 'goal' && l.id === id)); }); closeFicha(m); commit(); } }}, _('Eliminar objetivo')),
        h('button', {class:'btn primary', onclick:() => m.close()}, _('Fechar'))));
  };
  m.redraw = draw; draw();
  if (isNew) setTimeout(() => { const i = body.querySelector('input'); i && i.focus(); }, 30);
}
function createGoal(target){ const g = newGoal(target); commit(); openGoalFicha(g.id, true); return g; }
function goalRow(g){
  const t = goalType(g.type), late = g.due && !g.done && g.due < todayISO();
  return h('div', {class:'list-row goal-row' + (g.done ? ' done' : '')},
    h('input', {type:'checkbox', checked:g.done, 'aria-label':_('Objetivo «{nome}» feito', {nome:g.title || _('Sem título')}), onchange:e => { g.done = e.target.checked; g.at = g.done ? Date.now() : 0; commit(); redrawTop(); }}),
    h('span', {class:'goal-ic', 'aria-hidden':'true'}, t[1]),
    h('span', {class:'grow goal-t', role:'button', tabIndex:0, onclick:() => openGoalFicha(g.id), onkeydown:e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openGoalFicha(g.id); } }}, g.title || _('Sem título'), h('span', {class:'muted small'}, ' · ' + t[2] + ' · ' + targetLabel(g.target))),
    g.due ? h('span', {class:'small' + (late ? ' late-t' : ' muted')}, (late ? _('Em atraso') + ' · ' : '') + fmtDate(g.due) + (g.time ? ' ' + g.time : '')) : h('span', {class:'muted small'}, _('Sem data')));
}
/* secção «Pesquisa» para as fichas de Book e Scene */
function goalsSection(kind, id){
  const list = goalsFor(kind, id);
  return section(_('Objetivos de pesquisa'), h('button', {class:'btn small', onclick:() => createGoal({kind, id})}, _('+ Objetivo de pesquisa')),
    list.length ? list.map(goalRow) : h('div', {class:'muted small'}, _('Sem objetivos de pesquisa.')));
}

/* ---------- eventos do calendário ---------- */
function goalEvent(g){ return g.due ? {key:'goal-' + g.id, date:g.due, time:g.time, title:_('Pesquisa: ') + (g.title || _('Sem título')), kind:'goal', done:g.done,
  desc:goalType(g.type)[2] + ' · ' + targetLabel(g.target) + (g.notes ? '\n' + g.notes : ''), open:() => openGoalFicha(g.id)} : null; }
function planEvents(){
  const ev = [], push = e => e && ev.push(e);
  (state.goals || []).forEach(g => push(goalEvent(g)));
  state.books.forEach(b => {
    for (const k in STAGES){
      if (dueOf(b, k)) push({key:`book-${k}-${b.id}`, date:dueOf(b, k), title:STAGES[k] + ': ' + _('Tomo «{nome}»', {nome:b.name}), kind:k, done:bookProg(b, k).complete, empty:!bookProg(b, k).total, desc:_('Prazo do Tomo · ') + progLabel(bookProg(b, k), _('Cenas')), open:() => openBookFicha(b.id)});
      b.chapters.forEach(c => { if (dueOf(c, k)) push({key:`chapter-${k}-${c.id}`, date:dueOf(c, k), title:STAGES[k] + ': ' + _('Capítulo «{nome}»', {nome:c.name}), kind:k, done:chapterProg(c, k).complete, empty:!chapterProg(c, k).total, desc:_('Tomo «{nome}»', {nome:b.name}) + ' · ' + progLabel(chapterProg(c, k), _('Cenas')), open:() => openBookFicha(b.id)});
        chapterScenes(c).forEach(s => { const p = stg(s, k); if (p.due) push({key:`scene-${k}-${s.id}`, date:p.due, title:`${STAGES[k]}: «${s.title || _('Sem título')}»`, kind:k, done:p.done, desc:_('Tomo «{nome}»', {nome:b.name}) + ' › ' + _('Capítulo «{nome}»', {nome:c.name}), open:() => openSceneFicha(s.id)}); }); });
    }
  });
  const PH = {research:_('Pesquisa e Planeamento'), write:_('Escrita'), review:_('Revisão')};
  for (const k in PH){ const f = phaseOf(k);
    if (f.start) push({key:`phase-${k}-start`, date:f.start, title:_('Início: {fase}', {fase:PH[k]}), kind:'phase', done:false, desc:_('Fase do projeto'), open:null});
    if (f.end) push({key:`phase-${k}-end`, date:f.end, title:_('Fim: {fase}', {fase:PH[k]}), kind:'phase', done:false, desc:_('Fase do projeto'), open:null}); }
  return ev.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
}

/* ---------- exportação: Google, Apple, Outlook / Teams ---------- */
const icsEsc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsDate = iso => iso.replace(/-/g, '');
const nextDay = iso => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + 1); return isoLocal(d); };
/* fim de um evento com hora: uma hora depois (passando para o dia seguinte se for preciso); hora «flutuante», sem fuso nem mudança de hora */
function endOf(e){ const [y, mo, d] = e.date.split('-').map(Number), [hh, mm] = e.time.split(':').map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d, hh + 1, mm)); return {date:t.toISOString().slice(0, 10), time:t.toISOString().slice(11, 16)}; }
/* linhas de no máximo 75 octetos (UTF-8), cortadas sem partir caracteres */
function icsFold(line){
  const enc = new TextEncoder(), out = []; let cur = '', n = 0, max = 75;
  for (const ch of line){ const b = enc.encode(ch).length; if (n + b > max){ out.push(cur); cur = ' '; n = 1; max = 75; } cur += ch; n += b; }
  out.push(cur); return out.join('\r\n');
}
function buildICS(events){
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const pid = (typeof projActive === 'function' && projActive()) || 'projeto', name = state.project.name;
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Narrative//Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + icsEsc(name)];
  for (const e of events){
    // SEQUENCE crescente: os calendários que atualizam por UID (Apple, Outlook) ficam com a versão mais recente
    L.push('BEGIN:VEVENT', `UID:${pid}-${e.key}@ferramenta-narrativa`, 'DTSTAMP:' + stamp, 'LAST-MODIFIED:' + stamp, 'SEQUENCE:' + Math.floor(Date.now() / 1000));
    if (e.time){ const en = endOf(e); L.push(`DTSTART:${icsDate(e.date)}T${e.time.replace(':', '')}00`, `DTEND:${icsDate(en.date)}T${en.time.replace(':', '')}00`); }
    else L.push('DTSTART;VALUE=DATE:' + icsDate(e.date), 'DTEND;VALUE=DATE:' + icsDate(nextDay(e.date)));
    L.push('SUMMARY:' + icsEsc((e.done ? '✓ ' : '') + e.title), 'DESCRIPTION:' + icsEsc(name + ' — ' + e.desc), 'TRANSP:TRANSPARENT', 'END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.map(icsFold).join('\r\n') + '\r\n';
}
function exportICS(){
  const ev = planEvents();
  if (!ev.length) return toast(_('Ainda não há prazos nem objetivos com data para exportar.'));
  const blob = new Blob([buildICS(ev)], {type:'text/calendar;charset=utf-8'});
  const a = h('a', {href:URL.createObjectURL(blob), download:(state.project.name.replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'projeto') + '-' + _('calendario') + '.ics'});
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast(_n(ev.length, 'Calendário exportado ({n} evento). Importe o ficheiro no Google Calendar, no Apple Calendar ou no Outlook.', 'Calendário exportado ({n} eventos). Importe o ficheiro no Google Calendar, no Apple Calendar ou no Outlook.'));
}
const qs = p => Object.entries(p).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&'); // espaços como %20 (o Outlook mostra «+» à letra)
function googleURL(e){
  const en = e.time && endOf(e);
  const dates = e.time ? `${icsDate(e.date)}T${e.time.replace(':', '')}00/${icsDate(en.date)}T${en.time.replace(':', '')}00` : `${icsDate(e.date)}/${icsDate(nextDay(e.date))}`;
  return 'https://calendar.google.com/calendar/render?' + qs({action:'TEMPLATE', text:e.title, dates, details:state.project.name + ' — ' + e.desc});
}
function outlookURL(e, work){
  const p = {path:'/calendar/action/compose', rru:'addevent', subject:e.title, body:state.project.name + ' — ' + e.desc};
  if (e.time){ const en = endOf(e); p.startdt = `${e.date}T${e.time}:00`; p.enddt = `${en.date}T${en.time}:00`; }
  else { p.startdt = e.date; p.enddt = nextDay(e.date); p.allday = 'true'; }
  return (work ? 'https://outlook.office.com' : 'https://outlook.live.com') + '/calendar/0/deeplink/compose?' + qs(p);
}
function calLinks(e){
  const a = (href, t, tip) => h('a', {class:'btn small', href, target:'_blank', rel:'noopener', title:tip}, t);
  return h('div', {class:'chips cal-links'}, a(googleURL(e), _('Google Calendar'), _('Adicionar este evento ao Google Calendar')),
    a(outlookURL(e, false), _('Outlook'), _('Adicionar ao Outlook (conta pessoal: outlook.com, hotmail)')),
    a(outlookURL(e, true), _('Outlook / Teams'), _('Adicionar ao Outlook da conta de trabalho ou escola (o calendário do Microsoft Teams)')),
    h('button', {class:'btn small', title:_('Descarrega este evento (.ics) para o Apple Calendar ou outro'), onclick:() => {
      const blob = new Blob([buildICS([e])], {type:'text/calendar;charset=utf-8'}); const x = h('a', {href:URL.createObjectURL(blob), download:'evento.ics'});
      document.body.append(x); x.click(); setTimeout(() => { URL.revokeObjectURL(x.href); x.remove(); }, 500); }}, _('Apple Calendar (.ics)')));
}

/* ---------- o separador ---------- */
const PLAN_VIEWS = [['overview', _('Visão global')], ['research', _('Pesquisa e Planeamento')], ['write', _('Escrita')], ['review', _('Revisão')], ['calendar', _('Calendário')]];
function pagePlan(page){
  if (!PLAN_VIEWS.some(v => v[0] === filters.planView)) filters.planView = 'overview';
  const v = filters.planView;
  page.append(h('div', {class:'page-head'}, h('h1', null, _('Calendarização e Objetivos')), h('span', {class:'spacer'}),
    h('button', {class:'btn', onclick:exportICS}, _('Exportar calendário (.ics)'))));
  page.append(h('div', {class:'seg plan-nav', role:'tablist'}, PLAN_VIEWS.map(([k, l]) => h('button', {class:k === v ? 'on' : '', role:'tab', 'aria-selected':String(k === v), onclick:() => { filters.planView = k; renderAll(); }}, l))));
  const box = h('div', {class:'plan-view'}); page.append(box);
  ({overview:planOverview, research:planResearch, write:b => planStage(b, 'write'), review:b => planStage(b, 'review'), calendar:planCalendar})[v](box);
}
function planOverview(box){
  const o = overallProg(), r = researchProg(), w = projectProg('write'), rv = projectProg('review');
  const row = (label, p, unit, view) => h('div', {class:'prog-row click', onclick:() => { filters.planView = view; renderAll(); }},
    h('span', {class:'prog-name'}, label), progBar(p), h('span', {class:'muted small prog-num'}, progLabel(p, unit)));
  const PH = [['research', _('Pesquisa e Planeamento')], ['write', _('Escrita')], ['review', _('Revisão')]], t = todayISO();
  const phaseState = (k, f) => { const p = k === 'research' ? r : k === 'write' ? w : rv;
    if (p.complete) return badge(_('Concluída'), 'ok'); if (f.end && f.end < t) return badge(_('Em atraso'), 'late'); if (f.start && f.start <= t) return badge(_('Em curso'), 'main');
    return f.start ? badge(_('Por começar')) : badge(_('Sem datas')); };
  const ev = planEvents(), late = ev.filter(e => !e.done && !e.empty && e.kind !== 'phase' && e.date < t), next = ev.filter(e => !e.done && e.date >= t).slice(0, 8);
  const evRow = e => h('div', {class:'list-row' + (e.open ? ' click' : ''), onclick:e.open || null, role:e.open ? 'button' : null, tabIndex:e.open ? 0 : null, onkeydown:e.open ? (k => { if (k.key === 'Enter') e.open(); }) : null}, h('span', {class:'ev-dot ev-' + e.kind, 'aria-hidden':'true'}), h('span', {class:'grow'}, e.title), h('span', {class:'muted small'}, fmtDate(e.date) + (e.time ? ' ' + e.time : '')));
  add(box,
    h('div', {class:'card static'}, h('h3', null, _('Progresso do projeto')),
      h('div', {class:'big-pct'}, o.pct + '%', h('span', {class:'muted small'}, ' ' + _('concluído · {done} de {total} etapas', {done:o.done, total:o.total}))),
      row(_('Pesquisa e Planeamento'), r, _('objetivos'), 'research'), row(_('Escrita'), w, _('Cenas'), 'write'), row(_('Revisão'), rv, _('Cenas'), 'review')),
    h('div', {class:'card static'}, h('h3', null, _('Fases')),
      h('p', {class:'muted small'}, _('Defina o início e o fim de cada fase. As fases podem sobrepor-se: pode continuar a pesquisar enquanto escreve.')),
      PH.map(([k, l]) => h('div', {class:'phase-row'}, h('b', {class:'phase-name'}, l),
        h('label', {class:'small muted'}, _('Início') + ' ', dueInput(phaseOf(k).start, val => setPhase(k, 'start', val), _('Início: {fase}', {fase:l}))),
        h('label', {class:'small muted'}, _('Fim') + ' ', dueInput(phaseOf(k).end, val => setPhase(k, 'end', val), _('Fim: {fase}', {fase:l}))),
        phaseState(k, phaseOf(k))))),
    h('div', {class:'card static'}, h('h3', null, _('Tomos e Capítulos') + ' ', layerLegend()),
      state.books.map(b => h('div', {class:'book-prog'}, h('div', {class:'book-prog-head click', onclick:() => openBookFicha(b.id)}, bookDot(b), h('b', null, b.name)),
        layerBar('book', b, 'big') || h('div', {class:'muted small'}, _('Sem Cenas nem objetivos.')), h('div', {class:'muted small'}, layerText(layerProg('book', b))),
        b.chapters.map((c, ci) => h('div', {class:'ch-prog'}, h('span', {class:'small ch-prog-name'}, (ci + 1) + '. ' + c.name), layerBar('chapter', c) || h('span', {class:'muted small'}, _('Sem Cenas')))))) ),
    late.length ? h('div', {class:'card static'}, h('h3', null, _('Em atraso')), late.map(evRow)) : null,
    h('div', {class:'card static'}, h('h3', null, _('Próximos prazos')), next.length ? next.map(evRow) : h('div', {class:'muted small'}, _('Sem prazos marcados. Defina-os em Escrita, Revisão, Pesquisa ou nas fichas.'))));
}
function planStage(box, k){
  if (!allScenes().length) return add(box, h('div', {class:'empty'}, _('Ainda não há Cenas. Crie-as no quadro (separador Narrativa).')));
  add(box, h('p', {class:'muted small'}, k === 'write'
    ? _('Marque cada Cena quando estiver escrita. Um Capítulo fica completo quando todas as suas Cenas estão; um Tomo, quando todos os seus Capítulos estão. Desmarcar uma Cena (para a reescrever) desmarca também a revisão.')
    : _('Marque cada Cena quando estiver revista (só depois de escrita). Desmarque para a rever outra vez.')));
  state.books.forEach(b => {
    const bp = bookProg(b, k);
    const bookEl = h('div', {class:'card static stage-book'},
      h('div', {class:'stage-head'}, bookDot(b), h('b', {class:'grow click', onclick:() => openBookFicha(b.id)}, b.name), bp.complete ? badge(_('Completo'), 'ok') : null,
        progBar(bp), h('span', {class:'muted small prog-num'}, progLabel(bp, _('Cenas'))), dueInput(dueOf(b, k), val => setDue(b, k, val), (k === 'write' ? _('Prazo de escrita do Tomo {nome}', {nome:b.name}) : _('Prazo de revisão do Tomo {nome}', {nome:b.name})), bp.complete)));
    b.chapters.forEach((c, ci) => {
      const cp = chapterProg(c, k);
      bookEl.append(h('div', {class:'stage-ch'},
        h('div', {class:'stage-head'}, h('span', {class:'ch-num-s'}, ci + 1), h('span', {class:'grow'}, c.name), cp.complete ? badge(_('Completo'), 'ok') : null,
          progBar(cp, 'sm'), h('span', {class:'muted small prog-num'}, progLabel(cp, _('Cenas'))), dueInput(dueOf(c, k), val => setDue(c, k, val), (k === 'write' ? _('Prazo de escrita do Capítulo {nome}', {nome:c.name}) : _('Prazo de revisão do Capítulo {nome}', {nome:c.name})), cp.complete)),
        chapterScenes(c).map(s => { const p = stg(s, k), arc = arcById(s.arcId);
          return h('div', {class:'list-row stage-scene' + (p.done ? ' done' : '')}, stageCheck(s, k),
            h('span', {class:'dot', style:{background:arcStroke(arc)}}), h('span', {class:'grow click', onclick:() => openSceneFicha(s.id)}, s.title || _('Sem título')),
            p.done && p.at ? h('span', {class:'muted small'}, fmtDate(isoLocal(new Date(p.at)))) : null,
            dueInput(p.due, val => setSceneDue(s.id, k, val), (k === 'write' ? _('Prazo de escrita da Cena {nome}', {nome:s.title || _('Sem título')}) : _('Prazo de revisão da Cena {nome}', {nome:s.title || _('Sem título')})), p.done)); }),
        c.scenes.length ? null : h('div', {class:'muted small'}, _('Capítulo sem Cenas.'))));
    });
    box.append(bookEl);
  });
}
function planResearch(box){
  const f = filters.goalFilter || 'all', goals = (state.goals || []).filter(g => f === 'all' || (f === 'open' ? !g.done : g.done));
  const r = researchProg();
  add(box,
    h('div', {class:'page-head sub'}, h('div', {class:'seg'}, [['all', _('Todos')], ['open', _('Por fazer')], ['done', _('Feitos')]].map(([k, l]) => h('button', {class:k === f ? 'on' : '', onclick:() => { filters.goalFilter = k; renderAll(); }}, l))),
      h('span', {class:'muted small'}, progLabel(r, _('objetivos'))), h('span', {class:'spacer'}), h('button', {class:'btn primary', onclick:() => createGoal()}, _('+ Objetivo de pesquisa'))),
    h('p', {class:'muted small'}, _('Consultar um livro ou um mapa, visitar um local, entrevistar uma pessoa, ver um documentário, ouvir um podcast… Cada objetivo pode ser geral ou ligado a um Tomo, Capítulo ou Cena, ter data e hora, e ter Notas e Referências associadas.')),
    goals.length ? h('div', {class:'card static'}, goals.slice().sort((a, b) => (a.done - b.done) || (a.due || '9999').localeCompare(b.due || '9999')).map(goalRow))
      : h('div', {class:'empty'}, f === 'all' ? _('Ainda não há objetivos de pesquisa.') : _('Nenhum objetivo neste filtro.')));
}
function planCalendar(box){
  const t = todayISO(); if (!filters.calMonth) filters.calMonth = t.slice(0, 7);
  const [y, mo] = filters.calMonth.split('-').map(Number), first = new Date(y, mo - 1, 1), days = new Date(y, mo, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // semana a começar à segunda-feira
  const ev = planEvents(), month = filters.calMonth, inMonth = ev.filter(e => e.date.slice(0, 7) === month);
  const shift = n => { const d = new Date(y, mo - 1 + n, 1); filters.calMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); filters.calDay = null; renderAll(); };
  if (filters.calDay && filters.calDay.slice(0, 7) !== month) filters.calDay = null;
  const shown = filters.calDay ? inMonth.filter(e => e.date === filters.calDay) : inMonth;
  const grid = h('div', {class:'cal-grid'}, [0, 1, 2, 3, 4, 5, 6].map(i => h('div', {class:'cal-dow'}, new Date(2024, 0, 1 + i).toLocaleDateString(LOCALE, {weekday:'short'}).replace('.', ''))));
  for (let i = 0; i < lead; i++) grid.append(h('div', {class:'cal-day empty'}));
  for (let d = 1; d <= days; d++){
    const iso = month + '-' + String(d).padStart(2, '0'), list = inMonth.filter(e => e.date === iso);
    grid.append(h('div', {class:'cal-day' + (iso === t ? ' today' : '') + (iso === filters.calDay ? ' sel' : '') + (list.length ? ' has' : ''),
      onclick:list.length ? (e => { if (e.target.closest('.cal-ev') && innerWidth > 640) return; filters.calDay = filters.calDay === iso ? null : iso; renderAll(); }) : null}, h('div', {class:'cal-num'}, d),
      list.slice(0, 3).map(e => h('button', {class:'cal-ev ev-' + e.kind + (e.done ? ' done' : ''), title:e.title + (e.time ? ' · ' + e.time : ''), onclick:ev2 => { if (innerWidth <= 640) return; ev2.stopPropagation(); e.open && e.open(); }}, e.title)),
      list.length > 3 ? h('div', {class:'muted small'}, '+' + (list.length - 3)) : null));
  }
  add(box,
    h('div', {class:'page-head sub'}, h('button', {class:'btn small', 'aria-label':_('Mês anterior'), onclick:() => shift(-1)}, '‹'),
      h('b', {class:'cal-title'}, (s => s.charAt(0).toUpperCase() + s.slice(1))(first.toLocaleDateString(LOCALE, {month:'long', year:'numeric'}))),
      h('button', {class:'btn small', 'aria-label':_('Mês seguinte'), onclick:() => shift(1)}, '›'),
      h('button', {class:'btn small', onclick:() => { filters.calMonth = t.slice(0, 7); filters.calDay = null; renderAll(); }}, _('Hoje')), h('span', {class:'spacer'}),
      h('span', {class:'cal-legend small muted'}, h('span', {class:'ev-dot ev-goal'}), _('Pesquisa') + ' ', h('span', {class:'ev-dot ev-write'}), _('Escrita') + ' ', h('span', {class:'ev-dot ev-review'}), _('Revisão') + ' ', h('span', {class:'ev-dot ev-phase'}), _('Fases'))),
    grid,
    h('div', {class:'card static'}, h('h3', null, filters.calDay ? _('Eventos de {data}', {data:fmtDate(filters.calDay, true)}) : _('Eventos do mês'),
        filters.calDay ? h('button', {class:'btn small', style:{marginLeft:'10px'}, onclick:() => { filters.calDay = null; renderAll(); }}, _('Ver o mês todo')) : null),
      shown.length ? shown.map(e => h('div', {class:'cal-item' + (e.done ? ' done' : '')},
        h('div', {class:'list-row' + (e.open ? ' click' : ''), onclick:e.open || null}, h('span', {class:'ev-dot ev-' + e.kind}), h('span', {class:'grow'}, (e.done ? '✓ ' : '') + e.title),
          h('span', {class:'muted small'}, fmtDate(e.date, true) + (e.time ? ' · ' + e.time : ''))), calLinks(e)))
        : h('div', {class:'muted small'}, _('Sem eventos neste mês.'))),
    h('div', {class:'card static'}, h('h3', null, _('Sincronizar com outros calendários')),
      h('p', {class:'muted small'}, _('«Exportar calendário (.ics)» cria um ficheiro com todos os prazos e objetivos, para importar no Google Calendar (Definições › Importar e exportar), no Apple Calendar (Ficheiro › Importar) ou no Outlook (Adicionar calendário › Carregar a partir de ficheiro) — o calendário do Microsoft Teams é o do Outlook. Cada evento tem um identificador fixo: ao importar uma versão nova, o Apple Calendar costuma atualizar os eventos; no Google Calendar os eventos já importados não mudam, e no Outlook pode ser preciso apagar os antigos — por isso, para acompanhar alterações, é mais simples criar um calendário só para o projeto e substituí-lo. Os prazos apagados aqui não desaparecem dos outros calendários. Em cada evento, os botões acrescentam-no diretamente a cada calendário. A sincronização é num só sentido — da ferramenta para os calendários —, porque a ferramenta não tem servidor nem acede às suas contas.'))));
}

/* ---------- integração com as fichas ---------- */
function sceneProgSection(id){
  const s = state.scenes[id]; if (!s) return null;
  return section(_('Progresso'), null, h('div', {class:'stage-grid'},
    ...Object.keys(STAGES).map(k => h('div', {class:'stage-cell'}, h('b', {class:'small'}, STAGES[k]), stageCheck(s, k),
      h('label', {class:'small muted'}, _('Prazo') + ' ', dueInput(stg(s, k).due, v => setSceneDue(id, k, v), k === 'write' ? _('Prazo de escrita') : _('Prazo de revisão'), isDone(s, k)))))),
    goalsSection('scene', id));
}
function bookProgSection(b){
  return section(_('Progresso'), layerLegend(), layerBar('book', b, 'big'), ...Object.keys(STAGES).map(k => h('div', {class:'prog-row'}, h('span', {class:'prog-name small'}, STAGES[k]), progBar(bookProg(b, k)),
    h('span', {class:'muted small prog-num'}, progLabel(bookProg(b, k), _('Cenas'))))), goalsSection('book', b.id));
}
