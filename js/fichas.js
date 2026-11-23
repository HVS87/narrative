'use strict';
/* ===== Fichas (popups) ===== */
const GENDERS = [{value:'M', label:_('M — Masculino')}, {value:'F', label:_('F — Feminino')}, {value:'N/D', label:_('N/D — Não Definido')}];
const REF_TYPES = { document:_('Document'), link:_('Link'), audio:_('Audio'), video:_('Video'), note:_('Nota') };
const REF_ICON = { document:'📄', link:'🔗', audio:'🎧', video:'🎬', note:'📝' };
const touch = () => { save(); renderAll(); };
const closeFicha = m => { m.redraw = null; m.close(); };
function newNote(links){ const r = { id:uid('r'), type:'note', title:_('Nova Nota'), text:'', links:links || [], created:Date.now() }; state.refs.push(r); return r; }
function toggleMain(book, cid){ if (book.mainChars.includes(cid)) book.mainChars = book.mainChars.filter(c => c !== cid); else book.mainChars.push(cid); }
/* campo de nome: não pode ficar vazio — ao sair do campo repõe um nome por omissão */
function nameInput(obj, def, redraw){
  return h('input', {class:'inp', value:obj.name, oninput:e => { obj.name = e.target.value; touch(); },
    onchange:e => { if (!e.target.value.trim()){ obj.name = def; touch(); redraw(); } }});
}

/* janela pequena para associar algo que já existe (pesquisa com sugestão automática) ou criar um novo */
function associateDialog({title, label, placeholder, items, pick, create, taken, empty, foot}){
  const inp = h('input', {class:'inp', placeholder});
  const m = openModal({title, body:h('div', {class:'modal-body'}, field(label, inp), foot && h('div', {class:'modal-foot'}, foot(() => m.close())))});
  autocomplete(inp, items, it => { pick(it.id); touch(); m.close(); }, { create:create && (name => { create(name); touch(); m.close(); }), taken, empty });
  inp.focus();
}
/* nome de uma ficha, com alternativa enquanto o campo do nome está vazio */
const nameOf = x => x.name || _('Sem nome');
/* lista só de leitura de Sceneries (clicar abre a ficha) */
const sceneryLinks = list => list.map(x => h('span', {class:'chip click', onclick:() => openSceneryFicha(x.id)}, nameOf(x)));
/* Sceneries de uma Scene ou de um Character: lista + «Associar Scenery» */
function sceneriesChips(list, has, link, unlink, redraw){
  const assoc = () => associateDialog({title:_('Associar Cenário'), label:_('Escolher um Cenário ou criar um novo'), placeholder:_('Pesquisar Cenários…'),
    items:() => state.sceneries.filter(x => !has(x)).map(x => ({id:x.id, label:x.name})), pick:id => link(sceneryById(id)),
    create:name => link(newScenery(name)), taken:q => sameName(list, q), empty:_('Escreva um nome para criar um Cenário')});
  return h('div', {class:'chips'}, list.map(x => h('span', {class:'chip click'}, h('span', {onclick:() => openSceneryFicha(x.id)}, nameOf(x)),
    h('button', {class:'chip-x', onclick:() => { unlink(x); touch(); redraw(); }}, '✕'))),
    list.length ? null : h('span', {class:'muted small'}, _('Sem Cenários.')), h('button', {class:'btn small', onclick:assoc}, _('+ Associar Cenário')));
}

function section(title, actions, ...content){
  return h('div', {class:'sec'}, h('div', {class:'sec-head'}, h('div', {class:'sec-title'}, title), h('div', {class:'chips'}, actions)), ...content);
}

/* Notes + Referências associadas a uma entidade */
function refsSection(kind, id, redraw){
  const mine = state.refs.filter(r => r.links.some(l => l.kind === kind && l.id === id));
  const row = r => h('div', {class:'list-row'}, h('span', null, REF_ICON[r.type]),
    h('span', {class:'grow', onclick:() => openRefFicha(r.id)}, r.title || _('Sem título'),
      r.type === 'note' && r.text ? h('span', {class:'muted'}, ' — ' + r.text.slice(0, 80)) : null),
    h('span', {class:'muted small'}, REF_TYPES[r.type]),
    h('button', {class:'chip-x', title:_('Desassociar'), onclick:() => { r.links = r.links.filter(l => !(l.kind === kind && l.id === id)); touch(); redraw(); }}, '✕'));
  const notes = mine.filter(r => r.type === 'note'), others = mine.filter(r => r.type !== 'note');
  const createNote = () => { const r = newNote([{kind, id}]); touch(); openRefFicha(r.id); };
  const associate = () => associateDialog({title:_('Associar Referência'), label:_('Escolher uma Referência existente'), placeholder:_('Pesquisar Referências…'),
    items:() => state.refs.filter(r => !r.links.some(l => l.kind === kind && l.id === id)).map(r => ({id:r.id, label:r.title || _('Sem título'), hint:REF_TYPES[r.type]})),
    pick:rid => refById(rid).links.push({kind, id}), empty:_('Não há Referências por associar'),
    foot:close => h('button', {class:'btn', onclick:() => { close(); newRefDialog({kind, id}); }}, _('Nova Referência…'))});
  return h('div', null,
    section(_('Notas'), h('button', {class:'btn small', onclick:createNote}, _('+ Criar Nota')),
      notes.length ? notes.map(row) : h('div', {class:'muted small'}, _('Sem Notas.'))),
    section(_('Referências'), h('button', {class:'btn small', onclick:associate}, _('+ Associar Referência')),
      others.length ? others.map(row) : h('div', {class:'muted small'}, _('Sem Referências associadas.'))));
}

/* ---------- Scene ---------- */
function openSceneFicha(id){
  if (!state.scenes[id]) return;
  const body = h('div', {class:'ficha'});
  const m = openModal({title:_('Cena'), body, wide:true});
  const draw = () => {
    const s = state.scenes[id]; if (!s) return closeFicha(m);
    const arc = arcById(s.arcId), pos = findScenePos(id), nm = narrIndexMap();
    body.innerHTML = '';
    m.titleEl.innerHTML = ''; m.titleEl.append(h('span', {class:'dot', style:{background:arcStroke(arc), width:'14px', height:'14px'}}), _('Ficha da Cena'));
    const charInp = h('input', {class:'inp', placeholder:_('Adicionar Personagem…'), style:{width:'200px'}});
    autocomplete(charInp, () => state.characters.filter(c => !s.chars.includes(c.id)).map(c => ({id:c.id, label:c.name})),
      it => { s.chars.push(it.id); touch(); draw(); },
      { create:name => { const c = newCharacter(name); s.chars.push(c.id); touch(); draw(); }, taken:q => sameName(s.chars.map(charById), q), empty:_('Escreva um nome para criar uma Personagem') });
    const related = state.arcs.filter(a => a.id !== s.arcId).map(a => { const v = arcView(a.id, 'chron'); const i = v.findIndex(x => x.s.id === id); return i >= 0 ? {a, i} : null; }).filter(Boolean);
    const conv = s.convergeTo && state.scenes[s.convergeTo];
    add(body,
      field(_('Título'), h('input', {class:'inp', value:s.title, placeholder:_('Sem título'), oninput:e => { s.title = e.target.value; touch(); }})),
      field(_('Resumo'), h('textarea', {class:'inp', value:s.summary || '', placeholder:_('O que acontece nesta Cena?'), oninput:e => { s.summary = e.target.value; save(); }})),
      h('div', {class:'row'},
        field(_('Arco Narrativo'), selectEl(orderedArcs().map(l => ({value:l.arc.id, label:(l.depth ? '↳ ' : '') + l.arc.name})), s.arcId, v => {
          reassignForks(s); const old = s.arcId; const own = arcOwnScenes(v); s.arcId = v; s.chron = (own.length ? own[own.length - 1].chron : 0) + 1;
          if (s.convergeTo && state.scenes[s.convergeTo] && state.scenes[s.convergeTo].arcId === v) s.convergeTo = null;
          normalizeChron(old); normalizeChron(v); touch(); draw(); })),
        field(_('Personagem POV'), selectEl([{value:'', label:_('— nenhum —')}, ...state.characters.map(c => ({value:c.id, label:c.name}))], s.pov || '', v => { s.pov = v || null; touch(); draw(); }))),
      field(_('Personagens'), h('div', {class:'chips'},
        s.chars.map(cid => { const c = charById(cid); return c && h('span', {class:'chip click'}, h('span', {onclick:() => openCharFicha(cid)}, c.name || _('Sem nome')),
          h('button', {class:'chip-x', onclick:() => { s.chars = s.chars.filter(x => x !== cid); touch(); draw(); }}, '✕')); }), charInp)),
      field(_('Cenários'), sceneriesChips(s.sceneries.map(sceneryById).filter(Boolean), x => s.sceneries.includes(x.id), x => s.sceneries.push(x.id), x => { s.sceneries = s.sceneries.filter(y => y !== x.id); }, draw)),
      field(_('Posição'), h('div', {class:'posbox'},
        h('div', null, h('b', null, _('Ordem Narrativa: ')), '#' + (nm[id] + 1) + ' de ' + Object.keys(nm).length,
          pos ? h('span', {class:'muted'}, ' — ', bookDot(pos.book), _('Tomo «{tomo}» › Capítulo {c} «{cap}» › Cena {n}', {tomo:pos.book.name, c:pos.chIndex + 1, cap:pos.chapter.name, n:pos.index + 1})) : null),
        h('div', {style:{marginTop:'8px'}}, h('b', null, _('Ordem Cronológica ')), h('span', {class:'muted'}, _('em «{nome}»: ', {nome:arc.name})),
          h('input', {class:'inp', type:'number', min:1, value:s.chron, onchange:e => { const v = Math.max(1, parseInt(e.target.value, 10) || 1); s.chron = v; normalizeChron(s.arcId); touch(); draw(); }}),
          h('span', {class:'muted small'}, _(' (duas Cenas podem partilhar a mesma posição cronológica)'))),
        related.map(r => h('div', {class:'muted', style:{marginTop:'4px'}}, _('· no Arco Narrativo «{nome}»: posição {n} (herdada)', {nome:r.a.name, n:r.i + 1}))),
        conv ? h('div', {style:{marginTop:'8px'}}, h('b', null, _('Converge em: ')), `«${conv.title || _('Sem título')}» (${arcById(conv.arcId).name}) `,
          h('button', {class:'btn small', onclick:() => { s.convergeTo = null; touch(); draw(); }}, _('Remover convergência'))) : null)),
      sceneProgSection(id),
      refsSection('scene', id, draw),
      h('div', {class:'modal-foot'}, h('button', {class:'btn danger', onclick:async () => { if (await askDeleteScene(id)) closeFicha(m); }}, _('Eliminar Cena')),
        h('button', {class:'btn primary', onclick:() => m.close()}, _('Fechar'))));
  };
  m.redraw = draw; draw();
  if (!state.scenes[id].title) setTimeout(() => { const i = body.querySelector('input'); i && i.focus(); }, 30);
}

/* Escolher / criar Story Arc para uma nova Scene */
function chooseArcDialog(){
  return new Promise(res => {
    let done = false; const fin = v => { if (done) return; done = true; res(v); m.close(); };
    const search = h('input', {class:'inp', placeholder:_('Pesquisar Arcos Narrativos…')});
    const name = h('input', {class:'inp', placeholder:_('Nome do novo Arco Narrativo')});
    const create = () => { const v = name.value.trim(); if (!v) return name.focus(); const a = newArc(v); fin(a.id); };
    name.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); create(); } });
    const body = h('div', {class:'modal-body'},
      h('p', {class:'muted', style:{marginTop:0}}, _('Uma Cena pertence sempre a um Arco Narrativo.')),
      field(_('Escolher o Arco Narrativo'), search),
      field(_('Criar um novo Arco Narrativo'), h('div', {class:'row'}, name, h('button', {class:'btn primary fixed', onclick:create}, _('Criar')))));
    const m = openModal({title:_('Arco Narrativo da nova Cena'), body, onClose:() => fin(null)});
    autocomplete(search, () => orderedArcs().map(l => ({id:l.arc.id, label:(l.depth ? '↳ ' : '') + l.arc.name, color:arcStroke(l.arc)})), it => fin(it.id),
      {empty:_('Ainda não existem Arcos Narrativos — crie um abaixo')});
    (state.arcs.length ? search : name).focus();
  });
}

/* ---------- Book ---------- */
function openBookFicha(id, isNew){
  if (!bookById(id)) return;
  const body = h('div', {class:'ficha'});
  const m = openModal({title:_('Ficha do Tomo'), body, wide:true});
  const draw = () => {
    const b = bookById(id); if (!b) return closeFicha(m);
    body.innerHTML = ''; m.titleEl.innerHTML = ''; m.titleEl.append(bookDot(b) || '', _('Ficha do Tomo'));
    const chars = bookCharacters(b), arcIds = bookArcIds(b), scns = scenesSceneries(bookScenes(b));
    add(body,
      field(_('Nome'), nameInput(b, _('Tomo'), draw)),
      field(_('Cor do Tomo'), bookColorPicker(b, draw)),
      field(_('Tipo de narrador'), h('div', {class:'row'},
        selectEl([{value:'', label:_('— por definir —')}, ...NARRATORS.map(n => ({value:n.key, label:n.name}))], b.narrator, v => { b.narrator = v; touch(); draw(); }),
        h('button', {class:'btn fixed', disabled:!b.narrator, title:_('Abrir a ficha nos Materiais de Apoio'), onclick:() => openNarratorFicha(b.narrator)}, _('Ver ficha ↗')))),
      h('div', {class:'muted small'}, _n(b.chapters.length, '{n} Capítulo', '{n} Capítulos') + ' · ' + _n(bookScenes(b).length, '{n} Cena', '{n} Cenas')),
      section(_('Personagens'), null,
        chars.length ? chars.map(x => h('div', {class:'list-row'},
          h('span', {class:'grow', onclick:() => openCharFicha(x.ch.id)}, x.ch.name),
          badge(x.main ? _('Personagem Principal') : _('Personagem Secundária'), x.main ? 'main' : ''),
          x.pov ? badge(_('Personagem POV'), 'pov') : null,
          badge(x.ch.gender || 'N/D'), badge(x.ch.age ? x.ch.age + ' anos' : _('idade N/D')),
          h('button', {class:'btn small', onclick:() => { toggleMain(b, x.ch.id); touch(); draw(); }},
            x.main ? _('Desmarcar principal') : _('Marcar como principal'))))
          : h('div', {class:'muted small'}, _('Lista gerada automaticamente a partir das Personagens das Cenas deste Tomo.'))),
      section(_('Arcos Narrativos'), null, h('div', {class:'chips'}, arcIds.map(aid => { const a = arcById(aid);
        return a && h('span', {class:'chip click', onclick:() => openArcFicha(aid)}, h('span', {class:'dot', style:{background:arcStroke(a)}}), a.name); }),
        arcIds.length ? null : h('span', {class:'muted small'}, _('Sem Cenas.')))),
      section(_('Cenários'), null, h('div', {class:'chips'}, sceneryLinks(scns), scns.length ? null : h('span', {class:'muted small'}, _('Sem Cenários nas Cenas deste Tomo.')))),
      bookProgSection(b),
      refsSection('book', id, draw),
      h('div', {class:'modal-foot'}, h('button', {class:'btn danger', onclick:async () => { if (await askDeleteBook(id)) closeFicha(m); }}, _('Eliminar Tomo')),
        h('button', {class:'btn primary', onclick:() => m.close()}, _('Fechar'))));
  };
  m.redraw = draw; draw();
  if (isNew) setTimeout(() => { const i = body.querySelector('input'); if (i){ i.focus(); i.select(); } }, 30); // acabado de criar: o nome pronto a mudar
}

/* Cores sugeridas, «sem cor» e qualquer outra cor (o seletor do sistema).
   Um grupo de opções: uma só paragem do Tab, setas para mudar; cada escolha é um passo de anular. */
function bookColorPicker(b, redraw){
  const refocus = sel => { const el = [...document.querySelectorAll('.modal .swatches ' + sel)].pop(); el && el.focus({preventScroll:true}); };
  const set = c => { b.color = c; commit(); redraw(); refocus('[aria-checked="true"]'); };
  const custom = b.color && !BOOK_COLORS.some(x => x[0] === b.color);
  /* ao arrastar no seletor do sistema, só a pré-visualização muda; grava-se (um passo) quando a escolha termina */
  const preview = c => { const lab = other.closest('.sw'); if (lab){ lab.style.background = c; lab.textContent = ''; lab.append(other); }
    (els['b:' + b.id] || []).forEach(el => { el.classList.add('colored'); el.style.setProperty('--book', c); }); };
  const other = h('input', {type:'color', class:'sw-native', value:b.color || '#539bf5', role:'radio', 'aria-checked':String(!!custom), 'aria-label':_('Outra cor'),
    oninput:e => { const c = bookColorOk(e.target.value); if (c) preview(c); },
    onchange:e => { const c = bookColorOk(e.target.value); if (!c || c === b.color) return; b.color = c; commit(); redraw(); refocus('.sw-native'); }});
  const opts = [
    h('button', {class:'sw none' + (b.color ? '' : ' on'), role:'radio', 'aria-checked':String(!b.color), 'aria-label':_('Sem cor'), dataset:{tip:_('Sem cor')}, onclick:() => set(null)}),
    ...BOOK_COLORS.map(([c, nm]) => h('button', {class:'sw' + (b.color === c ? ' on' : ''), role:'radio', 'aria-checked':String(b.color === c), 'aria-label':nm, dataset:{tip:nm}, style:{background:c}, onclick:() => set(c)})),
    other];
  opts.forEach(o => o.tabIndex = o.getAttribute('aria-checked') === 'true' ? 0 : -1);
  const group = h('div', {class:'swatches', role:'radiogroup', 'aria-label':_('Cor do Tomo'), onkeydown:e => {
    const d = {ArrowRight:1, ArrowDown:1, ArrowLeft:-1, ArrowUp:-1}[e.key]; if (!d) return;
    e.preventDefault(); const i = opts.indexOf(document.activeElement); if (i < 0) return;
    const t = opts[(i + d + opts.length) % opts.length];
    if (t === other) t.focus(); else t.click(); // chegar a «Outra cor» só a seleciona; Enter ou Espaço abrem o seletor
  }}, opts.slice(0, -1),
    h('label', {class:'sw other' + (custom ? ' on' : ''), style:custom ? {background:b.color} : null, dataset:{tip:custom ? _('Cor personalizada — clique para mudar') : _('Outra cor…')}}, custom ? null : '+', other));
  return group;
}

/* ---------- Character ---------- */
function openCharFicha(id, isNew){
  if (!charById(id)) return;
  const body = h('div', {class:'ficha'});
  const m = openModal({title:_('Ficha da Personagem'), body, wide:true});
  const draw = () => {
    const c = charById(id); if (!c) return closeFicha(m);
    body.innerHTML = '';
    const books = charBooks(id);
    add(body,
      h('div', {class:'row'},
        field(_('Nome'), nameInput(c, _('Personagem'), draw)),
        h('div', {class:'fixed', style:{width:'190px'}}, field(_('Género'), selectEl(GENDERS, c.gender || 'N/D', v => { c.gender = v; touch(); }))),
        h('div', {class:'fixed', style:{width:'100px'}}, field(_('Idade'), h('input', {class:'inp', value:c.age || '', placeholder:'—', oninput:e => { c.age = e.target.value; touch(); }})))),
      field(_('Descrição'), h('textarea', {class:'inp', value:c.description || '', oninput:e => { c.description = e.target.value; save(); }})),
      section(_('Tomos em que figura'), null,
        books.length ? books.map(b => { const main = b.mainChars.includes(id); const pov = bookScenes(b).some(s => s.pov === id);
          return h('div', {class:'list-row'}, bookDot(b), h('span', {class:'grow', onclick:() => openBookFicha(b.id)}, b.name),
            badge(main ? _('Personagem Principal') : _('Personagem Secundária'), main ? 'main' : ''), pov ? badge(_('Personagem POV'), 'pov') : null,
            h('button', {class:'btn small', onclick:() => { toggleMain(b, id); touch(); draw(); }}, main ? _('Desmarcar principal') : _('Marcar como principal'))); })
          : h('div', {class:'muted small'}, _('Ainda não figura em nenhuma Cena. Adicione-a na ficha de uma Cena.'))),
      section(_('Cenários'), null, sceneriesChips(charSceneries(id), x => x.chars.includes(id), x => x.chars.push(id), x => { x.chars = x.chars.filter(y => y !== id); }, draw),
        (() => { const more = scenesSceneries(Object.values(state.scenes).filter(s => s.pov === id || s.chars.includes(id))).filter(x => !x.chars.includes(id));
          return more.length ? h('div', {class:'chips also'}, h('span', {class:'muted small'}, _('Das Cenas em que figura:')), sceneryLinks(more)) : null; })()),
      refsSection('character', id, draw),
      h('div', {class:'modal-foot'}, h('button', {class:'btn danger', onclick:async () => {
        if (await confirmDialog(_('Eliminar a Personagem «{nome}»? Será removida de todas as Cenas e de todos os Cenários.', {nome:c.name}), {title:_('Eliminar Personagem'), ok:_('Eliminar')})){ deleteCharacter(id); closeFicha(m); commit(); } }}, _('Eliminar Personagem')),
        h('button', {class:'btn primary', onclick:() => m.close()}, _('Fechar'))));
  };
  m.redraw = draw; draw();
  if (isNew) setTimeout(() => { const i = body.querySelector('input'); if (i){ i.focus(); i.select(); } }, 30);
}

/* ---------- Scenery ---------- */
function openSceneryFicha(id, isNew){
  if (!sceneryById(id)) return;
  const body = h('div', {class:'ficha'});
  const m = openModal({title:_('Ficha do Cenário'), body, wide:true});
  const draw = () => {
    const x = sceneryById(id); if (!x) return closeFicha(m);
    body.innerHTML = '';
    const scenes = sceneryScenes(id), ni = narrIndexMap();
    const inScenes = [...new Set(scenes.flatMap(s => [...s.chars, s.pov]))].filter(c => c && !x.chars.includes(c)).map(charById).filter(Boolean);
    const addChar = () => associateDialog({title:_('Associar Personagem'), label:_('Escolher uma Personagem ou criar uma nova'), placeholder:_('Pesquisar Personagens…'),
      items:() => state.characters.filter(c => !x.chars.includes(c.id)).map(c => ({id:c.id, label:c.name})), pick:cid => x.chars.push(cid),
      create:name => x.chars.push(newCharacter(name).id), taken:q => sameName(x.chars.map(charById), q), empty:_('Escreva um nome para criar uma Personagem')});
    const addScene = () => associateDialog({title:_('Associar Cena'), label:_('Escolher uma Cena'), placeholder:_('Pesquisar Cenas…'),
      items:() => narrOrder().map(sid => state.scenes[sid]).filter(s => !s.sceneries.includes(id)).map(s => ({id:s.id, label:s.title || _('Sem título'), hint:'#' + (ni[s.id] + 1) + ' · ' + arcById(s.arcId).name, color:arcStroke(arcById(s.arcId))})),
      pick:sid => state.scenes[sid].sceneries.push(id), empty:_('Não há Cenas por associar')});
    add(body,
      field(_('Nome'), nameInput(x, _('Cenário'), draw)),
      section(_('Personagens associadas'), h('button', {class:'btn small', onclick:addChar}, _('+ Associar Personagem')), h('div', {class:'chips'},
        x.chars.map(cid => { const c = charById(cid); return c && h('span', {class:'chip click'}, h('span', {onclick:() => openCharFicha(cid)}, nameOf(c)),
          h('button', {class:'chip-x', onclick:() => { x.chars = x.chars.filter(y => y !== cid); touch(); draw(); }}, '✕')); }),
        x.chars.length ? null : h('span', {class:'muted small'}, _('Sem Personagens associadas.'))),
        inScenes.length ? h('div', {class:'chips also'}, h('span', {class:'muted small'}, _('Figuram nas Cenas deste Cenário:')), inScenes.map(c => h('span', {class:'chip click', onclick:() => openCharFicha(c.id)}, nameOf(c)))) : null),
      section(_('Cenas associadas'), h('button', {class:'btn small', onclick:addScene}, _('+ Associar Cena')),
        scenes.length ? scenes.map(s => { const pos = findScenePos(s.id), a = arcById(s.arcId);
          return h('div', {class:'list-row'}, h('span', {class:'dot', style:{background:arcStroke(a)}}),
            h('span', {class:'grow', onclick:() => openSceneFicha(s.id)}, s.title || _('Sem título'), h('span', {class:'muted'}, _(' — #{n} · {tomo} › Capítulo {c}', {n:ni[s.id] + 1, tomo:pos.book.name, c:pos.chIndex + 1}))),
            h('span', {class:'muted small'}, a.name),
            h('button', {class:'chip-x', title:_('Desassociar'), onclick:() => { s.sceneries = s.sceneries.filter(y => y !== id); touch(); draw(); }}, '✕')); })
          : h('div', {class:'muted small'}, _('Ainda não está associado a nenhuma Cena.'))),
      refsSection('scenery', id, draw),
      h('div', {class:'modal-foot'}, h('button', {class:'btn danger', onclick:async () => {
        if (await confirmDialog(_('Eliminar o Cenário «{nome}»? Será removido de todas as Cenas e de todas as Personagens.', {nome:x.name}), {title:_('Eliminar Cenário'), ok:_('Eliminar')})){ deleteScenery(id); closeFicha(m); commit(); } }}, _('Eliminar Cenário')),
        h('button', {class:'btn primary', onclick:() => m.close()}, _('Fechar'))));
  };
  m.redraw = draw; draw();
  if (isNew) setTimeout(() => { const i = body.querySelector('input'); if (i){ i.focus(); i.select(); } }, 30);
}

/* ---------- Story Arc ---------- */
function openArcFicha(id){
  if (!arcById(id)) return;
  const body = h('div', {class:'ficha'}); let mode = 'narr';
  const m = openModal({title:_('Ficha do Arco Narrativo'), body, wide:true});
  const draw = () => {
    const a = arcById(id); if (!a) return closeFicha(m);
    body.innerHTML = '';
    m.titleEl.innerHTML = ''; m.titleEl.append(h('span', {class:'dot', style:{background:arcStroke(a), width:'14px', height:'14px'}}), _('Ficha do Arco Narrativo'));
    const view = arcView(id, mode), nm = narrIndexMap();
    const parent = a.parentId && arcById(a.parentId), fork = a.forkSceneId && state.scenes[a.forkSceneId];
    const branches = state.arcs.filter(x => x.parentId === id);
    const chk = h('input', {type:'checkbox', checked:mode === 'chron', onchange:e => { mode = e.target.checked ? 'chron' : 'narr'; draw(); }});
    const rowEl = h('div', {class:'arc-row'});
    view.forEach(v => {
      const sa = arcById(v.s.arcId);
      const card = h('div', {class:'arc-card' + (v.inh ? ' inh' : ''), style:{background:arcColor(v.inh ? sa : a, !!v.inh)}, dataset:{scene:v.s.id, own:v.inh ? '' : '1'}},
        h('div', {class:'t'}, v.s.title || _('Sem título')),
        h('div', {class:'m'}, _('Narrativa #{n} · Cronologia {c}', {n:nm[v.s.id] + 1, c:v.s.chron}),
          v.inh ? h('div', null, (v.inh === 'pre' ? _('herdada de «{nome}» (antes da divergência)', {nome:sa.name}) : _('herdada de «{nome}» (após a convergência)', {nome:sa.name}))) : null));
      rowEl.append(card);
    });
    if (!view.length) rowEl.append(h('div', {class:'muted'}, _('Este Arco Narrativo ainda não tem Cenas.')));
    wireArcRow(rowEl, id, () => mode, draw);
    const chars = arcCharIds(id), scns = scenesSceneries(arcOwnScenes(id));
    add(body,
      field(_('Nome'), nameInput(a, _('Arco Narrativo'), draw)),
      field(_('Descrição'), h('textarea', {class:'inp', value:a.description || '', placeholder:_('De que trata este Arco Narrativo?'), oninput:e => { a.description = e.target.value; save(); }})),
      parent ? h('div', {class:'muted', style:{marginBottom:'10px'}}, _('Ramo de '), h('a', {href:'#', onclick:e => { e.preventDefault(); openArcFicha(parent.id); }}, '«' + parent.name + '»'),
        fork ? _(' — diverge a partir da Cena «{nome}»', {nome:fork.title || _('Sem título')}) : '') : null,
      branches.length ? h('div', {class:'chips', style:{marginBottom:'10px'}}, h('span', {class:'muted small'}, _('Ramos:')),
        branches.map(x => h('span', {class:'chip click', onclick:() => openArcFicha(x.id)}, h('span', {class:'dot', style:{background:arcStroke(x)}}), x.name))) : null,
      section(_('Cenas'), h('label', {class:'switch-wrap'}, h('span', null, _('Ordem Narrativa')), chk, h('span', {class:'slider'}), h('span', null, _('Ordem Cronológica'))),
        rowEl, h('div', {class:'muted small'}, mode === 'chron' ? _('Clique longo numa Cena deste Arco Narrativo para a arrastar e alterar a Ordem Cronológica.') : _('A Ordem Narrativa altera-se no quadro principal.'))),
      section(_('Personagens'), null, h('div', {class:'chips'}, chars.map(cid => { const c = charById(cid); return c && h('span', {class:'chip click', onclick:() => openCharFicha(cid)}, c.name); }),
        chars.length ? null : h('span', {class:'muted small'}, _('Sem Personagens.')))),
      section(_('Cenários'), null, h('div', {class:'chips'}, sceneryLinks(scns), scns.length ? null : h('span', {class:'muted small'}, _('Sem Cenários nas Cenas deste Arco Narrativo.')))),
      refsSection('arc', id, draw),
      h('div', {class:'modal-foot'}, h('button', {class:'btn danger', disabled:!!(arcOwnScenes(id).length || branches.length), title:_('Só é possível eliminar um Arco Narrativo sem Cenas nem Ramos'),
        onclick:() => { state.arcs = state.arcs.filter(x => x.id !== id); unlinkRefs('arc', id); closeFicha(m); commit(); }}, _('Eliminar Arco Narrativo')),
        h('button', {class:'btn primary', onclick:() => m.close()}, _('Fechar'))));
  };
  m.redraw = draw; draw();
}
function wireArcRow(rowEl, arcId, getMode, redraw){
  let timer = null, d = null, moved = false;
  const STEP = 162;
  rowEl.addEventListener('click', e => { if (moved){ moved = false; return; } const c = e.target.closest('.arc-card'); if (c) openSceneFicha(c.dataset.scene); });
  rowEl.addEventListener('pointerdown', e => {
    const card = e.target.closest('.arc-card'); if (!card || e.button !== 0 || getMode() !== 'chron' || !card.dataset.own || tourMode) return;
    const sx = e.clientX, sy = e.clientY;
    const cancel = () => { clearTimeout(timer); window.removeEventListener('pointermove', pre); window.removeEventListener('pointerup', cancel); };
    const pre = ev => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) cancel(); };
    window.addEventListener('pointermove', pre); window.addEventListener('pointerup', cancel);
    timer = setTimeout(() => {
      cancel();
      const own = [...rowEl.querySelectorAll('.arc-card[data-own="1"]')]; const i = own.indexOf(card);
      d = { card, own, i, j:i, sx, scroll:rowEl.scrollLeft }; moved = true;
      card.classList.add('drag'); card.style.transform = 'scale(1.06) translateY(-4px)'; document.body.classList.add('dragging');
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
      window.addEventListener('keydown', esc, true); window.addEventListener('pointercancel', abort); window.addEventListener('blur', abort);
    }, 380);
  });
  const unwire = () => { document.body.classList.remove('dragging'); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
    window.removeEventListener('keydown', esc, true); window.removeEventListener('pointercancel', abort); window.removeEventListener('blur', abort); };
  const abort = () => { unwire(); d = null; redraw(); setTimeout(() => moved = false, 0); };
  const esc = e => { if (e.key === 'Escape'){ e.stopPropagation(); e.preventDefault(); abort(); } }; // Esc cancela o arrasto, não fecha a ficha
  const mv = ev => {
    const dx = ev.clientX - d.sx + (rowEl.scrollLeft - d.scroll);
    d.card.style.transform = `translate(${dx}px,-4px) scale(1.06)`;
    d.j = Math.max(0, Math.min(d.own.length - 1, Math.round(d.i + dx / STEP)));
    d.own.forEach((el, k) => { if (el === d.card) return;
      const sh = (d.i < d.j && k > d.i && k <= d.j) ? -STEP : (d.j < d.i && k >= d.j && k < d.i) ? STEP : 0;
      el.style.transform = sh ? `translateX(${sh}px)` : ''; });
  };
  const up = async () => {
    unwire();
    const dd = d; d = null;
    dd.card.classList.remove('drag'); dd.card.style.transform = `translateX(${(dd.j - dd.i) * STEP}px)`;
    if (dd.j === dd.i){ redraw(); return; }
    const ids = dd.own.map(el => el.dataset.scene); const sid = ids.splice(dd.i, 1)[0]; ids.splice(dd.j, 0, sid);
    const s = state.scenes[sid];
    const ok = await confirmDialog(_('Mover a Cena «{nome}» para a posição {n} da Ordem Cronológica deste Arco Narrativo?', {nome:s.title || _('Sem título'), n:dd.j + 1}));
    if (ok){
      const prev = state.scenes[ids[dd.j - 1]], next = state.scenes[ids[dd.j + 1]];
      if (prev && next && prev.chron === next.chron) s.chron = prev.chron;
      else if (prev) s.chron = prev.chron + 0.5; else s.chron = next.chron - 0.5;
      normalizeChron(arcId); touch();
    }
    redraw();
  };
}

/* ---------- Referências ---------- */
function fmtSize(n){ if (!n) return ''; return n > 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
function refTypeOfFile(f){ const t = f.type || ''; return t.startsWith('audio/') ? 'audio' : t.startsWith('video/') ? 'video' : 'document'; }
async function addFilesAsRefs(files, linkTo){
  if (tourMode) return;
  let n = 0;
  for (const f of files){
    const r = { id:uid('r'), type:refTypeOfFile(f), title:f.name.replace(/\.[^.]+$/, ''), fileName:f.name, mime:f.type, size:f.size, links:linkTo ? [linkTo] : [], created:Date.now() };
    state.refs.push(r);
    try { await idb.put(r.id, f); n++; } catch(e){ state.refs = state.refs.filter(x => x !== r); toast(_('Não foi possível guardar «{nome}».', {nome:f.name})); }
  }
  commit(); if (n) toast(_n(n, '{n} Referência guardada localmente.', '{n} Referências guardadas localmente.'));
}
const httpURL = u => /^https?:\/\/\S+$/i.test(u || '');
/* Endereços de vídeo e áudio que se podem ver ou ouvir dentro da ficha (YouTube, Vimeo, Dailymotion, Spotify, SoundCloud,
   Apple Podcasts, e ficheiros de áudio e vídeo na web). Devolve {kind:'video'|'audio', src, h, tag} ou null. */
function mediaEmbed(url){
  if (!httpURL(url)) return null;
  let u, m; try { u = new URL(url); } catch(e){ return null; }
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, ''), path = u.pathname, q = u.searchParams;
  if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com' || host === 'youtu.be'){
    // começar num momento do vídeo: t=90, t=1m30s ou start=90
    const tm = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(q.get('t') || q.get('start') || ''), start = tm ? (+tm[1] || 0) * 3600 + (+tm[2] || 0) * 60 + (+tm[3] || 0) : 0;
    const id = host === 'youtu.be' ? (/^\/([\w-]{11})$/.exec(path) || [])[1] : path === '/watch' ? (/^[\w-]{11}$/.exec(q.get('v') || '') || [])[0] : (/^\/(?:shorts|embed|live|v)\/([\w-]{11})/.exec(path) || [])[1];
    if (id) return {kind:'video', src:'https://www.youtube-nocookie.com/embed/' + id + (start ? '?start=' + start : ''), ratio:true};
    if (path === '/playlist' && /^[\w-]+$/.test(q.get('list') || '')) return {kind:'video', src:'https://www.youtube-nocookie.com/embed/videoseries?list=' + q.get('list'), ratio:true};
    return null;
  }
  // os vídeos não listados do Vimeo têm um código depois do número (vimeo.com/123/abc), que o leitor também precisa
  if (host === 'vimeo.com' || host === 'player.vimeo.com'){
    m = /^\/(?:video\/|channels\/[\w-]+\/|groups\/[\w-]+\/videos\/)?(\d+)(?:\/([\da-f]+))?\/?$/.exec(path); const hh = m && (m[2] || (/^[\da-f]+$/.exec(q.get('h') || '') || [])[0]);
    return m ? {kind:'video', src:'https://player.vimeo.com/video/' + m[1] + (hh ? '?h=' + hh : ''), ratio:true} : null;
  }
  if (host === 'dailymotion.com' && (m = /^\/(?:embed\/)?video\/([a-z0-9]+)/i.exec(path))) return {kind:'video', src:'https://geo.dailymotion.com/player.html?video=' + m[1], ratio:true};
  if (host === 'dai.ly' && (m = /^\/([a-z0-9]+)$/i.exec(path))) return {kind:'video', src:'https://geo.dailymotion.com/player.html?video=' + m[1], ratio:true};
  if (host === 'open.spotify.com' && (m = /^\/(?:intl-[a-z-]+\/)?(?:embed\/)?(episode|track|show|album|playlist)\/([A-Za-z0-9]+)/.exec(path))) return {kind:'audio', src:`https://open.spotify.com/embed/${m[1]}/${m[2]}`, h:/episode|track/.test(m[1]) ? 152 : 352};
  if (host === 'soundcloud.com' && path.split('/').filter(Boolean).length >= 2) return {kind:'audio', src:'https://w.soundcloud.com/player/?visual=false&url=' + encodeURIComponent(u.origin + path), h:166};
  if (host === 'podcasts.apple.com' && /\/id\d+/.test(path)) return {kind:'audio', src:'https://embed.podcasts.apple.com' + path + (/^\d+$/.test(q.get('i') || '') ? '?i=' + q.get('i') : ''), h:q.get('i') ? 175 : 450};
  // ficheiros partilhados no Google Drive (vídeo, áudio, PDF…) têm uma pré-visualização própria
  if (host === 'drive.google.com' && (m = /^\/file\/d\/([\w-]+)/.exec(path))) return {kind:'document', src:'https://drive.google.com/file/d/' + m[1] + '/preview', doc:true};
  if (/\.(mp3|m4a|aac|ogg|oga|opus|wav|flac)$/i.test(path)) return {kind:'audio', tag:'audio', src:url};
  if (/\.(mp4|m4v|webm|ogv|mov)$/i.test(path)) return {kind:'video', tag:'video', src:url};
  return null;
}
function embedEl(e){
  if (e.tag === 'audio') return h('audio', {controls:true, preload:'metadata', src:e.src, style:{width:'100%'}});
  if (e.tag === 'video') return h('video', {controls:true, preload:'metadata', src:e.src, class:'media'});
  const f = h('iframe', {src:e.src, class:'embed' + (e.ratio ? ' ratio' : ''), loading:'lazy', referrerPolicy:'strict-origin-when-cross-origin', title:_('Leitor incorporado'),
    allow:'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture', allowFullscreen:true,
    sandbox:'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox'});
  if (e.h) f.style.height = e.h + 'px';
  if (e.doc) f.className = 'embed doc-view';
  return f;
}
const extLink = (u, text, cls) => h('a', {href:u, target:'_blank', rel:'noopener noreferrer', class:cls || 'ext-link'}, text || u);
/* os endereços escritos numa Note, para se abrirem com um clique */
const urlsIn = t => [...new Set((String(t || '').match(/https?:\/\/[^\s<>«»"')\]]+/gi) || []).map(u => u.replace(/[.,;:!?]+$/, '')))];
function newRefDialog(linkTo){
  const fileInp = h('input', {type:'file', multiple:true, hidden:true, onchange:async e => { const fs = [...e.target.files]; if (fs.length){ await addFilesAsRefs(fs, linkTo); m.close(); } }});
  const dz = h('div', {class:'dropzone', onclick:() => fileInp.click()}, h('div', {style:{fontSize:'28px'}}, '⬆'), _('Clique para carregar ficheiros do disco'), h('br'), _('ou arraste-os do ambiente de trabalho para aqui'),
    h('div', {class:'small', style:{marginTop:'6px'}}, _('Documents · Audio · Video')));
  const url = h('input', {class:'inp', placeholder:'https://…'}), title = h('input', {class:'inp', placeholder:_('Título (opcional)')});
  const addLink = () => { const u = url.value.trim(); if (!u) return url.focus();
    const em = mediaEmbed(u); // um vídeo ou um episódio de podcast passa a Referência de Video ou Audio, que se vê e ouve na ficha
    state.refs.push({ id:uid('r'), type:em ? em.kind : 'link', title:title.value.trim() || u, url:u, links:linkTo ? [linkTo] : [], created:Date.now() }); commit(); m.close(); };
  const body = h('div', {class:'modal-body'}, dz, fileInp,
    section(_('Link'), null, h('div', {class:'row'}, url, title, h('button', {class:'btn fixed', onclick:addLink}, _('Adicionar Link')))),
    section(_('Nota'), h('button', {class:'btn small', onclick:() => { const r = newNote(linkTo ? [linkTo] : []); commit(); m.close(); openRefFicha(r.id); }}, _('+ Nova Nota em branco'))));
  const m = openModal({title:_('Nova Referência'), body, wide:true});
  const over = on => dz.classList.toggle('over', on);
  m.back.addEventListener('dragover', e => { e.preventDefault(); over(true); });
  m.back.addEventListener('dragleave', e => { if (e.target === m.back) over(false); });
  m.back.addEventListener('drop', async e => { e.preventDefault(); over(false); const fs = [...e.dataTransfer.files]; if (fs.length){ await addFilesAsRefs(fs, linkTo); m.close(); } });
}
function openRefFicha(id){
  if (!refById(id)) return;
  const body = h('div', {class:'ficha'});
  let objUrl = null;
  const m = openModal({title:_('Referência'), body, wide:true, onClose:() => { if (objUrl) URL.revokeObjectURL(objUrl); }});
  const draw = () => {
    const r = refById(id); if (!r) return closeFicha(m);
    body.innerHTML = '';
    m.titleEl.textContent = REF_ICON[r.type] + ' ' + REF_TYPES[r.type];
    const linkInp = h('input', {class:'inp', placeholder:_('Associar a Tomo, Cena, Arco Narrativo, Personagem, Cenário ou objetivo…'), style:{width:'360px'}});
    autocomplete(linkInp, () => {
      const all = [...state.books.map(b => ({kind:'book', id:b.id})), ...state.arcs.map(a => ({kind:'arc', id:a.id})),
        ...state.characters.map(c => ({kind:'character', id:c.id})), ...state.sceneries.map(x => ({kind:'scenery', id:x.id})), ...Object.values(state.scenes).map(s => ({kind:'scene', id:s.id})),
        ...(state.goals || []).map(g => ({kind:'goal', id:g.id}))];
      return all.filter(x => !r.links.some(l => l.kind === x.kind && l.id === x.id)).map(x => ({kind:x.kind, id:x.id, label:entityLabel(x.kind, x.id)}));
    }, it => { r.links.push({kind:it.kind, id:it.id}); touch(); draw(); });
    const media = h('div', {class:'field'});
    add(body,field(_('Título'), h('input', {class:'inp', value:r.title || '', oninput:e => { r.title = e.target.value; touch(); }})));
    if (r.type === 'note'){
      const links = h('div', {class:'note-links'});
      const drawLinks = () => { links.innerHTML = ''; const us = urlsIn(r.text); if (us.length) add(links, h('div', {class:'muted small'}, _('Ligações nesta Nota:')), h('div', {class:'chips'}, us.map(u => extLink(u, u, 'chip ext-link')))); };
      add(body, field(_('Texto'), h('textarea', {class:'inp', style:{minHeight:'200px'}, value:r.text || '', placeholder:_('Escreva aqui…'), oninput:e => { r.text = e.target.value; save(); drawLinks(); }}), links)); drawLinks();
    }
    else if (r.url || r.type === 'link'){
      const em = mediaEmbed(r.url);
      add(body, field(_('Endereço'), h('div', {class:'row'}, h('input', {class:'inp', value:r.url || '', oninput:e => { r.url = e.target.value; save(); },
          onchange:() => { const e2 = mediaEmbed(r.url); r.type = e2 ? e2.kind : 'link'; touch(); draw(); }}),
        httpURL(r.url) ? extLink(r.url, _('Abrir ↗'), 'btn fixed') : h('span', {class:'muted small fixed'}, _('O endereço deve começar por http:// ou https://')))));
      if (em) add(body, h('div', {class:'field embed-wrap'}, embedEl(em), h('div', {class:'muted small'}, navigator.onLine === false ? _('Sem ligação à internet: o leitor aparece quando a ligação voltar.') : _('Se o leitor não aparecer, use «Abrir ↗» (alguns sítios não permitem ser incorporados).'))));
    }
    else {
      add(body,h('div', {class:'muted small', style:{marginBottom:'8px'}}, _('{nome} · {tam} · guardado localmente', {nome:r.fileName, tam:fmtSize(r.size)})), media);
      idb.get(r.id).then(blob => {
        if (!blob){ media.append(h('div', {class:'muted'}, _('Ficheiro não disponível neste browser.'))); return; }
        // só se abrem no browser tipos que não executam código na origem da aplicação (um HTML importado ou recebido, por exemplo,
        // só se descarrega). Conta o tipo do ficheiro guardado e o da Referência; os outros ficam como «dados binários».
        const SAFE = /^(image\/(png|jpeg|gif|webp|avif|bmp)|audio\/[\w.+-]+|video\/[\w.+-]+|application\/pdf|text\/plain)$/;
        const safe = SAFE.test(blob.type || '') && SAFE.test(r.mime || ''), mime = r.mime || '', name = (r.fileName || '').toLowerCase();
        if (objUrl) URL.revokeObjectURL(objUrl); objUrl = URL.createObjectURL(safe ? blob : new Blob([blob], {type:'application/octet-stream'}));
        if (r.type === 'audio' || (safe && mime.startsWith('audio/'))) media.append(h('audio', {controls:true, src:objUrl, style:{width:'100%'}}));
        else if (r.type === 'video' || (safe && mime.startsWith('video/'))) media.append(h('video', {controls:true, src:objUrl, class:'media'}));
        else if (safe && mime.startsWith('image/')) media.append(h('img', {src:objUrl, class:'media', style:{objectFit:'contain'}}));
        else if (/^image\/svg\+xml$/.test(mime)){ const su = URL.createObjectURL(new Blob([blob], {type:'image/svg+xml'})); media.append(h('img', {src:su, class:'media', style:{objectFit:'contain'}, onload:() => URL.revokeObjectURL(su)})); } // numa <img>, um SVG não corre código
        else if (safe && mime === 'application/pdf') media.append(h('iframe', {src:objUrl, class:'doc-view', title:_('Pré-visualização do documento')}));
        else if (/^text\/(plain|markdown|csv)$/.test(mime) || /\.(txt|md|csv)$/.test(name)) blob.slice(0, 200000).text().then(t => media.prepend(h('pre', {class:'doc-text'}, t + (blob.size > 200000 ? '\n…' : ''))));
        else media.append(h('div', {class:'muted small'}, _('Este tipo de ficheiro (por exemplo, Word ou Excel) não se pode mostrar dentro da ferramenta: use «Descarregar» e abra-o no programa habitual.')));
        media.append(h('div', {class:'chips', style:{marginTop:'8px'}}, safe ? h('a', {class:'btn', href:objUrl, target:'_blank', rel:'noopener'}, _('Abrir')) : null, h('a', {class:'btn', href:objUrl, download:r.fileName}, _('Descarregar'))));
      }).catch(() => media.append(h('div', {class:'muted'}, _('Não foi possível ler o ficheiro.'))));
    }
    add(body,section(_('Associada a'), null, h('div', {class:'chips'},
      r.links.map(l => { const lab = entityLabel(l.kind, l.id); return lab && h('span', {class:'chip click'}, l.kind === 'book' ? bookDot(bookById(l.id)) : null, h('span', {onclick:() => openEntity(l.kind, l.id)}, lab),
        h('button', {class:'chip-x', onclick:() => { r.links = r.links.filter(x => x !== l); touch(); draw(); }}, '✕')); }), linkInp)),
      h('div', {class:'modal-foot'}, h('button', {class:'btn danger', onclick:async () => {
        if (await confirmDialog(_('Eliminar a Referência «{nome}»?', {nome:r.title || _('Sem título')}), {title:_('Eliminar Referência'), ok:_('Eliminar')})){
          state.refs = state.refs.filter(x => x.id !== id); /* o ficheiro fica guardado até ao próximo arranque, para se poder anular */ closeFicha(m); commit(); } }}, _('Eliminar')),
        h('button', {class:'btn primary', onclick:() => m.close()}, _('Fechar'))));
  };
  m.redraw = draw; draw();
}

/* ---------- Materiais de Apoio ---------- */
/* índice por nome: cada ficha sabe a que secção e grupo pertence */
const supportIndex = new Map();
/* nos textos dos Materiais de Apoio, *assim* aparece em itálico (o asterisco isolado, ou «* * *», fica como está) */
const supRich = s => { const out = []; let last = 0; String(s).replace(/\*([^*\s][^*]*?)\*/g, (m, t, i) => { out.push(s.slice(last, i), h('em', null, t)); last = i + m.length; return m; }); out.push(s.slice(last)); return out.filter(x => x !== ''); };
SUPPORT.forEach(sec => sec.groups.forEach(g => g.items.forEach(it => supportIndex.set(it.n, {it, sec, g}))));
function openSupportFicha(name, q){
  const e = supportIndex.get(name); if (!e) return;
  const {it, sec, g} = e;
  const m = openModal({title:_('Materiais de Apoio — ') + sec.name, wide:true, body:h('div', {class:'ficha sup-ficha'},
    h('div', {class:'kicker'}, g.name),
    h('h2', null, it.n), it.a && h('div', {class:'muted sup-alt'}, it.a), h('p', null, supRich(it.d)),
    it.f && field(_('Pontos fortes'), h('div', null, supRich(it.f))),
    it.u && field(_('Como usar'), h('div', null, supRich(it.u))),
    it.c && field(it.f ? _('Riscos') : _('Cuidado'), h('div', null, supRich(it.c))),
    it.x && field(_('Exemplos'), it.x.length > 1 ? h('ul', {class:'sup-ex'}, it.x.map(x => h('li', null, supRich(x)))) : h('div', null, supRich(it.x[0]))),
    it.t && field(_('Na ferramenta'), h('div', {class:'sup-tool'}, supRich(it.t))),
    it.w && it.w.length ? wordList(it.w, q) : null,
    it.s && field(_('Ver também'), h('div', {class:'chips'}, it.s.filter(n => supportIndex.has(n)).map(n =>
      h('span', {class:'chip click', onclick:() => { m.close(); openSupportFicha(n); }}, n)))))});
}
/* lista de palavras de uma ficha (por exemplo, as que mudaram numa reforma ortográfica): pesquisável, sem acentos nem maiúsculas */
function wordList(w, q){
  const hasNote = w.some(r => r[2]), inp = h('input', {class:'inp', type:'search', placeholder:_('Procurar uma palavra (antes ou depois)…'), 'aria-label':_('Procurar na lista de palavras')});
  const count = h('div', {class:'muted small', role:'status', 'aria-live':'polite'}), tb = h('tbody');
  const hay = w.map(r => supNorm(r.join(' ')));
  const draw = () => { const words = supNorm(inp.value).split(/s+/).filter(Boolean); tb.innerHTML = ''; let n = 0;
    w.forEach((r, i) => { if (!words.every(x => hay[i].includes(x))) return; n++;
      tb.append(h('tr', null, h('td', {class:'wl-old'}, r[0]), h('td', {class:'wl-arrow', 'aria-hidden':'true'}, '→'), h('td', {class:'wl-new'}, r[1]), hasNote ? h('td', {class:'muted small'}, r[2] || '') : null)); });
    count.textContent = words.length ? _n(w.length, '{k} de {n} palavra', '{k} de {n} palavras', {k:n}) : _n(w.length, '{n} palavra', '{n} palavras'); };
  inp.addEventListener('input', draw);
  if (q){ const words = supNorm(q).split(/s+/).filter(Boolean); if (hay.some(x => words.every(y => x.includes(y)))) inp.value = q; }
  draw();
  return field(_('Lista de palavras'), h('div', {class:'wl'}, h('div', {class:'wl-bar'}, inp, count),
    h('div', {class:'wl-scroll'}, h('table', {class:'wl-table'}, h('thead', null, h('tr', null, h('th', {scope:'col'}, _('Antes')), h('th', {'aria-hidden':'true'}), h('th', {scope:'col'}, _('Depois')), hasNote ? h('th', {scope:'col'}, _('Nota')) : null)), tb))));
}
function openNarratorFicha(key){ const n = narratorByKey(key); if (n) openSupportFicha(n.name); }
