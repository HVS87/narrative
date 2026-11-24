'use strict';
/* ===== Fichas (popups) ===== */
const GENDERS = [{value:'M', label:_('M — Masculino')}, {value:'F', label:_('F — Feminino')}, {value:'N/D', label:_('N/D — Não Definido')}];
const REF_TYPES = { document:_('Document'), link:_('Link'), audio:_('Audio'), video:_('Video'), note:_('Nota') };
const REF_ICON = { document:'note', link:'link', audio:'audio', video:'video', note:'pen' }; // ícones da família da barra de topo (nav.js)
const refIcon = t => svgIcon(REF_ICON[t] || 'note', 'ref-ic');
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
const locStar = x => x.main ? h('span', {class:'loc-star', role:'img', 'aria-label':_('Localização Principal')}, '★') : null;
const sceneryLinks = list => list.map(x => h('span', {class:'chip click', onclick:() => openSceneryFicha(x.id)}, locStar(x), nameOf(x)));
/* Sceneries de uma Scene ou de um Character: lista + «Associar Scenery» */
function sceneriesChips(list, has, link, unlink, redraw){
  const assoc = () => associateDialog({title:_('Associar Localização'), label:_('Escolher uma Localização ou criar uma nova'), placeholder:_('Pesquisar Localizações…'),
    items:() => state.sceneries.filter(x => !has(x)).map(x => ({id:x.id, label:x.name})), pick:id => link(sceneryById(id)),
    create:name => link(newScenery(name)), taken:q => sameName(list, q), empty:_('Escreva um nome para criar uma Localização')});
  return h('div', {class:'chips'}, list.map(x => h('span', {class:'chip click'}, locStar(x), h('span', {onclick:() => openSceneryFicha(x.id)}, nameOf(x)),
    h('button', {class:'chip-x', onclick:() => { unlink(x); touch(); redraw(); }}, '✕'))),
    list.length ? null : h('span', {class:'muted small'}, _('Sem Localizações.')), h('button', {class:'btn small', onclick:assoc}, _('+ Associar Localização')));
}

/* Cada secção abre e fecha (fica lembrado enquanto a ferramenta está aberta) e mostra quantos itens tem. */
const SecOff = new Set();
function section(title, actions, ...content){
  const kids = content.flat(Infinity).filter(x => x != null && x !== false), n = kids.filter(x => x.classList && x.classList.contains('list-row')).length;
  const key = typeof title === 'string' ? title : '', off = !!key && SecOff.has(key), body = h('div', {class:'sec-body', hidden:off}, ...kids);
  const tog = key ? h('button', {class:'sec-tog', 'aria-expanded':String(!off), 'aria-label':_('Abrir ou fechar a secção «{nome}»', {nome:key}),
    onclick:() => { const now = !body.hidden; body.hidden = now; tog.setAttribute('aria-expanded', String(!now)); if (now) SecOff.add(key); else SecOff.delete(key); }}, svgIcon('down')) : null;
  return h('div', {class:'sec'}, h('div', {class:'sec-head'}, h('div', {class:'sec-tw'}, tog, h('div', {class:'sec-title'}, title), n ? h('span', {class:'sec-n', 'aria-label':_n(n, '{n} item', '{n} itens')}, n) : null), h('div', {class:'chips'}, actions)), body);
}
/* Fichas em duas colunas, só na janela larga (não no painel ao lado nem no telemóvel): os campos — o que se escreve — à
   esquerda e as secções — listas, progresso, Notas e Referências — à direita. Numa coluna só, a ordem é a de sempre. */
function fichaCols(body){
  const box = body.closest('.modal'), kids = [...body.children]; if (!box || !kids.length) return;
  const isSec = k => k.classList.contains('sec') || !!k.querySelector(':scope > .sec'), foot = kids.filter(k => k.classList.contains('modal-foot'));
  const A = kids.filter(k => !k.classList.contains('modal-foot') && !isSec(k)), B = kids.filter(k => !k.classList.contains('modal-foot') && isSec(k));
  if (!A.length || !B.length) return;
  box.classList.add('two-col');
  body.replaceChildren(h('div', {class:'f-cols'}, h('div', {class:'f-col'}, ...A), h('div', {class:'f-col'}, ...B)), ...foot);
}
/* um campo com um ícone antes do nome (ficha da Cena) */
const fi = (icon, f) => { const l = f.querySelector(':scope > label'); if (l) l.prepend(svgIcon(icon, 'f-ic')); return f; };

/* Notes + Referências associadas a uma entidade */
function refsSection(kind, id, redraw){
  const mine = state.refs.filter(r => r.links.some(l => l.kind === kind && l.id === id));
  const row = r => h('div', {class:'list-row'}, refIcon(r.type),
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
/* ----- percorrer as Cenas a partir da ficha: a fita do percurso e as setas -----
   A fita, no topo da ficha, tem duas linhas como as do quadro: a branca é a Ordem Narrativa (a ordem do livro) e a da cor
   do Arco Narrativo é a ordem do Arco. Cada linha liga a Cena anterior à posição desta («2 de 10») e à Cena seguinte, e
   acaba nas caixas dessas Cenas; onde o Arco se bifurca ou converge, a linha divide-se ou junta-se e aparecem as Cenas
   de cada caminho, cada uma na cor do seu Arco. Clicar numa Cena da fita leva a essa Cena.
   As setas — brancas para o livro, da cor do Arco para o Arco — ficam fora da ficha, a meio da altura, sempre no mesmo
   sítio; sem margem para elas, ficam nas pontas de cada linha da fita. Com um só caminho, a seta vai direta; numa
   bifurcação ou convergência mostra o símbolo, mistura as cores dos Arcos e abre a escolha do caminho. ← e → fazem o mesmo que as brancas; com Shift, as do Arco. */
function sceneArcLinks(s){
  const own = arcOwnScenes(s.arcId), i = own.findIndex(x => x.id === s.id), arc = arcById(s.arcId);
  const prev = [], next = [];
  if (i > 0) prev.push({id:own[i - 1].id, kind:'arc'});
  else if (arc && arc.parentId && state.scenes[arc.forkSceneId]) prev.push({id:arc.forkSceneId, kind:'fork'});
  Object.values(state.scenes).filter(x => x.convergeTo === s.id && x.arcId !== s.arcId).forEach(x => prev.push({id:x.id, kind:'merge'}));
  if (i >= 0 && i < own.length - 1) next.push({id:own[i + 1].id, kind:'arc'});
  state.arcs.filter(a => a.parentId === s.arcId && a.forkSceneId === s.id).forEach(a => { const f = arcOwnScenes(a.id)[0]; if (f) next.push({id:f.id, kind:'fork'}); });
  if (s.convergeTo && state.scenes[s.convergeTo] && state.scenes[s.convergeTo].arcId !== s.arcId) next.push({id:s.convergeTo, kind:'merge'});
  return {prev, next, i:i + 1, n:own.length};
}
/* As setas ficam fora da ficha quando há margem para elas (PC); senão, nas pontas das linhas, dentro da ficha.
   Conta com o tamanho do texto escolhido nas Definições e com a janela do segundo ecrã, onde a ficha é mais larga. */
const FICHA_2COL = 1180; // a partir desta largura de janela, as fichas têm duas colunas (ver styles.css)
const fitaWide = m => { const z = {l:1.15, xl:1.3}[document.body.dataset.fs] || 1, two = innerWidth >= FICHA_2COL;
  return !(m && m.docked) && !MOBILE_Q.matches && innerWidth >= z * ((document.body.classList.contains('second') ? (two ? 1100 : 900) : (two ? 1000 : 720)) + 140); };
window.addEventListener('resize', () => openModals.forEach(m => { if (m.fitaFit) m.fitaFit(); }));
/* devolve as linhas da fita, as setas laterais (quando há margem) e, para cada botão (data-nav), o destino:
   uma Cena (id) ou as Cenas de uma seta (list) */
function sceneFita(s, wide){
  const order = narrOrder(), ni = order.indexOf(s.id), arc = arcById(s.arcId), L = sceneArcLinks(s), to = {};
  const np = ni > 0 ? [{id:order[ni - 1], kind:'narr'}] : [], nn = ni >= 0 && ni < order.length - 1 ? [{id:order[ni + 1], kind:'narr'}] : [];
  const tone = x => x ? {'--arc':arcColor(x), '--arc-line':arcStroke(x)} : {};
  const an = x => { const y = arcById(x.arcId); return y ? y.name : ''; };
  const rel = (t, x, track, dir) => track === 'narr' ? (dir === 'prev' ? _('A Cena anterior na Ordem Narrativa. Clique para a abrir.') : _('A Cena seguinte na Ordem Narrativa. Clique para a abrir.'))
    : t.kind === 'fork' ? (dir === 'prev' ? _('A Cena de onde este Ramo parte, em «{arco}». Clique para a abrir.', {arco:an(x)}) : _('Aqui parte o Ramo «{arco}». Clique para o seguir.', {arco:an(x)}))
    : t.kind === 'merge' ? (dir === 'prev' ? _('O Arco Narrativo «{arco}» converge nesta Cena a partir daqui. Clique para a abrir.', {arco:an(x)}) : _('Este Arco Narrativo converge aqui, em «{arco}». Clique para a abrir.', {arco:an(x)}))
    : (dir === 'prev' ? _('A Cena anterior deste Arco Narrativo. Clique para a abrir.') : _('A Cena seguinte deste Arco Narrativo. Clique para a abrir.'));
  const node = (t, track, dir, i) => { const x = state.scenes[t.id], k = track + '-' + dir + '-' + i, name = x.title || _('Sem título'), r = rel(t, x, track, dir); to[k] = {id:t.id, dir};
    return h('button', {class:'ft-node' + (i ? ' alt' : ''), dataset:{nav:k, name, rel:r}, style:Object.assign({'--i':i}, tone(arcById(x.arcId))), 'aria-label':name + '. ' + r}, h('span', null, name)); };
  const cell = (list, track, dir) => h('div', {class:'ft-c ' + dir},
    list.length ? list.map((t, i) => node(t, track, dir, i))
      : h('span', {class:'ft-end'}, track === 'narr' ? (dir === 'prev' ? _('Início do livro') : _('Fim do livro')) : (dir === 'prev' ? _('Início do Arco') : _('Fim do Arco'))));
  const kindOf = list => list.some(t => t.kind === 'fork') ? 'fork' : list.some(t => t.kind === 'merge') ? 'merge' : '';
  const aria = (track, dir, kd) => track === 'narr' ? (dir === 'prev' ? _('Cena anterior na Ordem Narrativa') : _('Próxima Cena na Ordem Narrativa'))
    : kd === 'fork' ? (dir === 'prev' ? _('Cena anterior deste Arco Narrativo (bifurcação)') : _('Próxima Cena deste Arco Narrativo (bifurcação)'))
    : kd === 'merge' ? (dir === 'prev' ? _('Cena anterior deste Arco Narrativo (convergência)') : _('Próxima Cena deste Arco Narrativo (convergência)'))
    : (dir === 'prev' ? _('Cena anterior deste Arco Narrativo') : _('Próxima Cena deste Arco Narrativo'));
  /* numa bifurcação ou convergência, a seta mistura a cor deste Arco (do lado da ficha) com a dos Arcos que aqui se separam
     ou se juntam (do lado para onde aponta); são todas cores claras, por isso o símbolo escuro lê-se sempre */
  const mix = (list, dir) => { const cols = [arcColor(arc)];
    list.forEach(t => { if (t.kind !== 'fork' && t.kind !== 'merge') return; const col = arcColor(arcById(state.scenes[t.id].arcId)); if (!cols.includes(col)) cols.push(col); });
    if (cols.length < 2) return {};
    const seg = 100 / cols.length, stops = cols.map((col, i) => col + ' ' + (i ? Math.round(i * seg + seg * .4) : 0) + '% ' + (i < cols.length - 1 ? Math.round((i + 1) * seg - seg * .4) : 100) + '%');
    return {backgroundImage:'linear-gradient(' + (dir === 'prev' ? 'to left' : 'to right') + ', ' + stops.join(', ') + ')'}; };
  const arrow = (list, track, dir) => { const kd = track === 'arc' ? kindOf(list) : '', k = track + '-' + dir; to[k] = {list, dir};
    return h('button', {class:'ft-arrow ' + track + ' ' + dir + (kd ? ' ' + kd : ''), dataset:{nav:k}, 'aria-label':aria(track, dir, kd), disabled:!list.length,
      style:track === 'arc' ? Object.assign(tone(arc), kd ? mix(list, dir) : {}) : null},
      svgIcon(kd === 'fork' ? (dir === 'prev' ? 'forkL' : 'forkR') : kd === 'merge' ? (dir === 'prev' ? 'mergeL' : 'mergeR') : dir === 'prev' ? 'arrL' : 'arrR')); };
  const A = {np:arrow(np, 'narr', 'prev'), nn:arrow(nn, 'narr', 'next'), ap:arrow(L.prev, 'arc', 'prev'), an:arrow(L.next, 'arc', 'next')};
  /* cada linha tem a sua legenda — Ordem Narrativa (a do livro) e Ordem Cronológica (a do Arco) — e ocupa a largura toda da ficha:
     a Cena anterior encosta à esquerda, a seguinte à direita, e a linha estica-se entre elas e a posição, ao centro */
  const trk = (track, p, n, i, N, style, tip, a1, a2) => h('div', {class:'ft-trk ' + track + (p.length ? '' : ' no-prev') + (n.length ? '' : ' no-next'), style},
    h('div', {class:'ft-cap'}, h('i', {'aria-hidden':'true'}), track === 'narr' ? _('Ordem Narrativa') : _('Ordem Cronológica')),
    wide ? null : a1, cell(p, track, 'prev'),
    h('span', {class:'ft-here', dataset:{tip}}, h('span', {class:'ft-long'}, _('{n} de {total}', {n:i, total:N})), h('span', {class:'ft-short', 'aria-hidden':'true'}, i + '/' + N)),
    cell(n, track, 'next'), wide ? null : a2);
  return { to,
    rows:[trk('narr', np, nn, ni + 1, order.length, null, _('A posição desta Cena na Ordem Narrativa.'), A.np, A.nn),
      trk('arc', L.prev, L.next, L.i, L.n, tone(arc), _('A posição desta Cena no Arco Narrativo «{nome}».', {nome:arc ? arc.name : ''}), A.ap, A.an)],
    sides:wide ? [h('div', {class:'ft-side prev'}, A.np, A.ap), h('div', {class:'ft-side next'}, A.nn, A.an)] : [] };
}
/* ← e → percorrem a Ordem Narrativa e, com Shift, o Arco Narrativo — quando a ficha de uma Cena está por cima e não se está a escrever */
document.addEventListener('keydown', e => {
  if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.altKey || e.ctrlKey || e.metaKey || e.defaultPrevented) return;
  const top = openModals[openModals.length - 1]; if (!top || !top.sceneNav || menuEl || Tour.active || document.querySelector('.ac-list')) return;
  const t = e.target, tag = t && t.tagName;
  if (t && (t.isContentEditable || tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && !/^(checkbox|button|submit|reset|file|color)$/.test(t.type)))) return;
  e.preventDefault(); top.sceneNav(e.shiftKey ? 'arc' : 'narr', e.key === 'ArrowLeft' ? 'prev' : 'next', e.repeat);
});
/* Deslizar entre Cenas: uma cópia parada da ficha que se deixa (sem as setas) sai para um lado enquanto a nova entra do outro.
   Animações pela própria página (Web Animations), sem trocar classes — trocar a animação de CSS da caixa recomeçava a de abertura
   e a ficha piscava. */
const reduceMotion = () => document.body.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
const fitaFixed = fita => getComputedStyle(fita).position === 'sticky'; // telemóvel: a fita está presa em baixo e fica parada
function slideStop(back){ const s = back._slide; if (!s) return; back._slide = null; s.anims.forEach(a => { try { a.cancel(); } catch(e){} }); s.g.remove(); back.classList.remove('sliding'); }
function slideSnap(back, box){
  slideStop(back); box.getAnimations().forEach(a => { try { a.finish(); } catch(e){} }); // a ficha acabada de abrir ainda pode estar a crescer
  const r = box.getBoundingClientRect(), g = box.cloneNode(true), src = box.querySelectorAll('input,textarea,select'), dst = g.querySelectorAll('input,textarea,select');
  src.forEach((x, i) => { const y = dst[i]; if (!y) return; if (x.type === 'checkbox' || x.type === 'radio') y.checked = x.checked; else y.value = x.value; }); // o que se escreveu não vem na cópia
  g.querySelectorAll('.ft-sides' + (fitaFixed(box.querySelector('.scn-fita')) ? ', .scn-fita' : '')).forEach(x => x.remove());
  g.querySelectorAll('[id]').forEach(x => x.removeAttribute('id')); g.removeAttribute('id');
  g.classList.add('slide-ghost'); g.inert = true; g.setAttribute('aria-hidden', 'true');
  return {g, r};
}
function slidePlay(back, box, snap, dir, from){
  /* carrossel: as duas andam juntas a mesma distância — a que leva a que sai para fora da área visível no instante em que a
     nova chega ao lugar (num ecrã largo, uma largura da ficha não chegava e a anterior ficava parada à beira, à vista) */
  const br = back.getBoundingClientRect(), {g, r} = snap, s = dir === 'prev' ? 1 : -1;
  // «r» é onde a ficha estava à vista (já arrastada pelo dedo, «from»); a conta faz-se a partir do lugar dela, sem o arrasto
  const vl = Math.max(br.left, 0), vr = Math.min(br.right, innerWidth), D = Math.max(r.width + 32, Math.ceil(s < 0 ? r.right - from - vl : vr - (r.left - from)) + 24);
  Object.assign(g.style, {left:(r.left - br.left - back.clientLeft + back.scrollLeft) + 'px', top:(r.top - br.top - back.clientTop + back.scrollTop) + 'px', width:r.width + 'px', height:r.height + 'px'});
  back.classList.add('sliding'); box.before(g); // a nova ficha (e as setas que ficam paradas) por cima da que sai
  const o = {duration:Math.round(340 * Math.max(.4, 1 - Math.abs(from) / D)), easing:'cubic-bezier(.3,.7,.25,1)'}, still = [...box.querySelectorAll('.ft-side')];
  const fita = box.querySelector('.scn-fita'); if (fita && fitaFixed(fita)) still.push(fita);
  const anims = [g.animate([{transform:'none'}, {transform:'translateX(' + (s * D - from) + 'px)'}], o),
    box.animate([{transform:'translateX(' + (from - s * D) + 'px)'}, {transform:'none'}], o),
    ...still.map(x => x.animate([{translate:(s * D - from) + 'px 0'}, {translate:'0 0'}], o))];
  const me = back._slide = {g, anims};
  anims[1].finished.then(() => { if (back._slide === me) slideStop(back); }, () => {});
  setTimeout(() => { if (back._slide === me) slideStop(back); }, o.duration + 400); // janela escondida: as animações podem não acabar
}
function openSceneFicha(id){
  if (!state.scenes[id]) return;
  const body = h('div', {class:'ficha'});
  const m = openModal({title:_('Cena'), body, wide:true, cls:'scene-modal'});
  const box = m.back.querySelector('.modal'), fita = h('div', {class:'scn-fita', role:'group', 'aria-label':_('Percorrer as Cenas')}), sides = h('div', {class:'ft-sides'});
  m.back.querySelector('.modal-head').after(fita, sides);
  let to = {};
  /* Passa a outra Cena sem fechar a ficha: troca o conteúdo e volta ao topo; a Cena anterior sai para um lado e a nova entra
     do outro, como ao deslizar o dedo; as setas (e, no telemóvel, a fita em baixo) ficam paradas. Deixa o foco no mesmo botão
     (ou na seta do mesmo lado, se esse botão já não existir). «from»: onde o dedo largou a caixa, num gesto de deslizar. */
  const go = (nid, k, dir, quick, from) => {
    if (!state.scenes[nid] || nid === id) return false;
    const snap = !quick && !quietModals && !reduceMotion() ? slideSnap(m.back, box) : (slideStop(m.back), null); // «quick»: tecla premida, sem animação
    swipeOff();
    id = nid; if (m.entity) m.entity.id = nid;
    draw(); m.back.scrollTop = 0; Dual.report(); dockMark();
    if (snap) slidePlay(m.back, box, snap, dir, from || 0);
    const f = box.querySelector('[data-nav="' + k + '"]:not(:disabled)') || box.querySelector('.ft-arrow[data-nav="' + k.replace(/-\d+$/, '') + '"]:not(:disabled)') || box.querySelector('.ft-arrow:not(:disabled)');
    if (f) f.focus({preventScroll:true});
    return true;
  };
  /* uma Cena da fita leva a essa Cena; uma seta com um só caminho vai direta, e numa bifurcação ou convergência abre a
     escolha: primeiro o caminho deste Arco, depois os dos outros, cada um com o nome do seu Arco */
  const act = (k, anchor, quick) => {
    const t = to[k]; if (!t) return false;
    if (t.id) return go(t.id, k, t.dir, quick);
    if (!t.list.length) return false;
    if (t.list.length === 1) return go(t.list[0].id, k, t.dir, quick);
    if (!anchor) return false;
    const rc = anchor.getBoundingClientRect(), lab = x => { const sc = state.scenes[x.id], y = arcById(sc.arcId); return (sc.title || _('Sem título')) + (y ? ' · ' + y.name : ''); };
    const list = [...t.list].sort((a, b) => (a.kind === 'arc' ? 0 : 1) - (b.kind === 'arc' ? 0 : 1));
    showMenu(rc.left, rc.bottom + 4, list.map(x => ({label:lab(x), action:() => go(x.id, k, t.dir)})));
    const first = document.querySelector('.ctx-menu .ctx-item:not(:disabled)'); if (first) first.focus({preventScroll:true}); // pelo teclado, escolhe-se logo com ↑ ↓ e Enter
    return true;
  };
  box.addEventListener('click', e => { const b = e.target.closest('[data-nav]'); if (b && !b.disabled) act(b.dataset.nav, b); }); // as Cenas da fita e as setas
  /* ecrã tátil: deslizar o dedo para o lado passa à Cena seguinte ou à anterior, na Ordem Narrativa; a caixa segue o dedo */
  const still = () => [...box.querySelectorAll('.ft-side'), ...(fitaFixed(fita) ? [fita] : [])];
  const swipeOff = () => { box.style.transform = ''; still().forEach(x => x.style.translate = ''); };
  const canGo = d => { const t = to['narr-' + d]; return !!t && (t.id ? !!state.scenes[t.id] : t.list.length === 1); };
  let sw = null, swClick = 0;
  box.addEventListener('pointerdown', e => {
    sw = null; if (e.pointerType === 'mouse' || !e.isPrimary || tourMode || Tour.active || menuEl || document.querySelector('.ac-list')) return;
    if (e.target.closest('.scn-fita, select, input[type=range], .ctx-menu')) return;
    sw = {x:e.clientX, y:e.clientY, id:e.pointerId, on:false, dx:0, pts:[]};
  });
  box.addEventListener('pointermove', e => {
    if (!sw || e.pointerId !== sw.id) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (!sw.on){ if (Math.abs(dx) < 12) { if (Math.abs(dy) > 12) sw = null; return; }
      if (Math.abs(dx) < Math.abs(dy) * 1.4){ sw = null; return; }
      sw.on = true; sw.x = e.clientX; slideStop(m.back); try { box.setPointerCapture(e.pointerId); } catch(x){} }
    const d = e.clientX - sw.x; sw.dx = canGo(d < 0 ? 'next' : 'prev') ? d : d / 4; // sem Cena desse lado, resiste
    sw.pts.push([performance.now(), e.clientX]); if (sw.pts.length > 6) sw.pts.shift();
    box.style.transform = 'translateX(' + sw.dx + 'px)'; still().forEach(x => x.style.translate = (-sw.dx) + 'px 0');
  });
  const swipeEnd = cancel => {
    const s = sw; sw = null; if (!s || !s.on) return; swClick = performance.now();
    const p = s.pts, v = p.length > 1 ? (p[p.length - 1][1] - p[0][1]) / Math.max(1, p[p.length - 1][0] - p[0][0]) : 0; // px/ms
    const dir = s.dx < 0 ? 'next' : 'prev', far = Math.abs(s.dx) > Math.min(110, box.offsetWidth * .25), fast = Math.abs(v) > .45 && Math.sign(v) === Math.sign(s.dx) && Math.abs(s.dx) > 30;
    if (!cancel && (far || fast) && canGo(dir)){ const t = to['narr-' + dir]; if (go(t.id || t.list[0].id, 'narr-' + dir, dir, false, s.dx)) return; }
    const x = s.dx; swipeOff(); if (reduceMotion() || !x) return; // volta ao sítio
    const o = {duration:200, easing:'cubic-bezier(.22,.8,.25,1)'};
    box.animate([{transform:'translateX(' + x + 'px)'}, {transform:'none'}], o); still().forEach(el => el.animate([{translate:(-x) + 'px 0'}, {translate:'0 0'}], o));
  };
  box.addEventListener('pointerup', () => swipeEnd(false)); box.addEventListener('pointercancel', () => swipeEnd(true));
  box.addEventListener('click', e => { if (performance.now() - swClick < 400){ e.stopPropagation(); e.preventDefault(); } }, true); // o fim de um gesto não é um toque
  m.sceneNav = (track, dir, quick) => act(track + '-' + dir, box.querySelector('.ft-arrow[data-nav="' + track + '-' + dir + '"]'), quick);
  const drawFita = () => { const sc = state.scenes[id]; if (!sc) return; const wide = fitaWide(m), ft = sceneFita(sc, wide); to = ft.to; fita.replaceChildren(...ft.rows); sides.replaceChildren(...ft.sides); box.classList.toggle('ft-wide', wide); };
  m.fitaFit = () => { if (box.classList.contains('ft-wide') !== fitaWide(m)) drawFita(); }; // ao mudar o tamanho da janela, as setas mudam de sítio
  const draw = () => { draw0(); fichaCols(body); }; // na janela larga, campos à esquerda e secções à direita
  const draw0 = () => {
    const s = state.scenes[id]; if (!s) return closeFicha(m);
    drawFita();
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
      fi('pen', field(_('Título'), h('input', {class:'inp title-inp', value:s.title, placeholder:_('Sem título'), oninput:e => { s.title = e.target.value; touch(); }}))),
      fi('chapter', field(_('Resumo'), h('textarea', {class:'inp', value:s.summary || '', placeholder:_('O que acontece nesta Cena?'), oninput:e => { s.summary = e.target.value; save(); }}))),
      h('div', {class:'row'},
        fi('arc', field(_('Arco Narrativo'), selectEl(orderedArcs().map(l => ({value:l.arc.id, label:(l.depth ? '↳ ' : '') + l.arc.name})), s.arcId, v => {
          reassignForks(s); const old = s.arcId; const own = arcOwnScenes(v); s.arcId = v; s.chron = (own.length ? own[own.length - 1].chron : 0) + 1;
          if (s.convergeTo && state.scenes[s.convergeTo] && state.scenes[s.convergeTo].arcId === v) s.convergeTo = null;
          normalizeChron(old); normalizeChron(v); touch(); draw(); }))),
        fi('eye', field(_('Personagem POV'), selectEl([{value:'', label:_('— nenhum —')}, ...state.characters.map(c => ({value:c.id, label:c.name}))], s.pov || '', v => { s.pov = v || null; touch(); draw(); })))),
      fi('people', field(_('Personagens'), h('div', {class:'chips'},
        s.chars.map(cid => { const c = charById(cid); return c && h('span', {class:'chip click'}, h('span', {onclick:() => openCharFicha(cid)}, c.name || _('Sem nome')),
          h('button', {class:'chip-x', onclick:() => { s.chars = s.chars.filter(x => x !== cid); touch(); draw(); }}, '✕')); }), charInp))),
      fi('pin', field(_('Localizações'), sceneriesChips(s.sceneries.map(sceneryById).filter(Boolean), x => s.sceneries.includes(x.id), x => { s.sceneries.push(x.id); locNudge(x); }, x => { s.sceneries = s.sceneries.filter(y => y !== x.id); }, draw))),
      fi('list', field(_('Posição'), h('div', {class:'posbox'},
        h('div', null, h('b', null, _('Ordem Narrativa: ')), _('#{n} de {total}', {n:nm[id] + 1, total:Object.keys(nm).length}),
          pos ? h('span', {class:'muted'}, ' — ', bookDot(pos.book), _('Tomo «{tomo}» › Capítulo {c} «{cap}» › Cena {n}', {tomo:pos.book.name, c:pos.chIndex + 1, cap:pos.chapter.name, n:pos.index + 1})) : null),
        h('div', {style:{marginTop:'8px'}}, h('b', null, _('Ordem Cronológica ')), h('span', {class:'muted'}, _('em «{nome}»: ', {nome:arc.name})),
          h('input', {class:'inp', type:'number', min:1, value:s.chron, onchange:e => { const v = Math.max(1, parseInt(e.target.value, 10) || 1); s.chron = v; normalizeChron(s.arcId); touch(); draw(); }})),
        related.map(r => h('div', {class:'muted', style:{marginTop:'4px'}}, _('· no Arco Narrativo «{nome}»: posição {n} (herdada)', {nome:r.a.name, n:r.i + 1}))),
        conv ? h('div', {style:{marginTop:'8px'}}, h('b', null, _('Converge em: ')), `«${conv.title || _('Sem título')}» (${arcById(conv.arcId).name}) `,
          h('button', {class:'btn small', onclick:() => { s.convergeTo = null; touch(); draw(); }}, _('Remover convergência'))) : null))),
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
/* Principal ou Secundária neste Tomo: um só botão que mostra o estado e o troca (a estrela cheia é a Principal) */
const mainToggle = (main, toggle, loc) => h('button', {class:'main-tog' + (main ? ' on' : ''), 'aria-pressed':String(main), 'aria-label':main ? _('Desmarcar principal') : _('Marcar como principal'), onclick:toggle},
  h('span', {class:'star', 'aria-hidden':'true'}, main ? '★' : '☆'), loc ? (main ? _('Localização Principal') : _('Localização Secundária')) : (main ? _('Personagem Principal') : _('Personagem Secundária')));
/* sugestão para marcar como principal uma Localização que já aparece em várias Cenas (na ficha e na página das Localizações) */
function locSuggestBox(x, redraw){
  const n = sceneryScenes(x.id).length;
  return h('div', {class:'loc-sug', role:'note', dataset:{loc:x.id}}, svgIcon('bulb'), h('span', {class:'loc-sug-t'}, _('«{nome}» já aparece em {n} Cenas. Marcar como Localização Principal?', {nome:x.name, n})),
    h('button', {class:'btn small primary', dataset:{sug:'yes'}, onclick:() => { setLocMain(x, true); commit(); redraw && redraw(); }}, _('Marcar como principal')),
    h('button', {class:'btn small', dataset:{sug:'no'}, onclick:() => { x.noMain = true; commit(); redraw && redraw(); }}, _('Não, é secundária')));
}
/* ao associar uma Localização a mais uma Cena: se com essa passou a ser recorrente, a sugestão aparece logo, em baixo */
function locNudge(x){
  if (tourMode || !x || !locSuggest(x) || sceneryScenes(x.id).length !== LOC_MAIN_MIN) return;
  document.querySelectorAll('.toast.loc-nudge').forEach(t => t.remove());
  const t = h('div', {class:'toast snack loc-nudge', role:'status'}, h('span', {class:'snack-t'}, _('«{nome}» já aparece em {n} Cenas. Marcar como Localização Principal?', {nome:x.name, n:LOC_MAIN_MIN})),
    h('button', {class:'snack-undo', onclick:() => { t.remove(); const y = sceneryById(x.id); if (y){ setLocMain(y, true); commit(); redrawTop(); } }}, _('Marcar')), h('button', {class:'snack-undo', onclick:() => { t.remove(); const y = sceneryById(x.id); if (y){ y.noMain = true; commit(); } }}, _('Não')));
  $('#toasts').append(t); setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 12000);
}
function openBookFicha(id, isNew){
  if (!bookById(id)) return;
  const body = h('div', {class:'ficha'});
  const m = openModal({title:_('Ficha do Tomo'), body, wide:true});
  const draw = () => { draw0(); fichaCols(body); }; // na janela larga, campos à esquerda e secções à direita
  const draw0 = () => {
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
        chars.length ? chars.map(x => h('div', {class:'list-row char-row'},
          h('span', {class:'grow', onclick:() => openCharFicha(x.ch.id)}, x.ch.name),
          h('span', {class:'muted small cr-facts'}, (x.ch.gender || 'N/D') + ' · ' + (x.ch.age ? _('{n} anos', {n:x.ch.age}) : _('idade N/D'))),
          x.pov ? badge(_('Personagem POV'), 'pov') : null,
          mainToggle(x.main, () => { toggleMain(b, x.ch.id); touch(); draw(); })))
          : h('div', {class:'muted small'}, _('Lista gerada automaticamente a partir das Personagens das Cenas deste Tomo.'))),
      section(_('Arcos Narrativos'), null, h('div', {class:'chips'}, arcIds.map(aid => { const a = arcById(aid);
        return a && h('span', {class:'chip click', onclick:() => openArcFicha(aid)}, h('span', {class:'dot', style:{background:arcStroke(a)}}), a.name); }),
        arcIds.length ? null : h('span', {class:'muted small'}, _('Sem Cenas.')))),
      section(_('Localizações'), null, h('div', {class:'chips'}, sceneryLinks(scns), scns.length ? null : h('span', {class:'muted small'}, _('Sem Localizações nas Cenas deste Tomo.')))),
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
  const draw = () => { draw0(); fichaCols(body); }; // na janela larga, campos à esquerda e secções à direita
  const draw0 = () => {
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
            pov ? badge(_('Personagem POV'), 'pov') : null, mainToggle(main, () => { toggleMain(b, id); touch(); draw(); })); })
          : h('div', {class:'muted small'}, _('Ainda não figura em nenhuma Cena. Adicione-a na ficha de uma Cena.'))),
      section(_('Localizações'), null, sceneriesChips(charSceneries(id), x => x.chars.includes(id), x => x.chars.push(id), x => { x.chars = x.chars.filter(y => y !== id); }, draw),
        (() => { const more = scenesSceneries(Object.values(state.scenes).filter(s => s.pov === id || s.chars.includes(id))).filter(x => !x.chars.includes(id));
          return more.length ? h('div', {class:'chips also'}, h('span', {class:'muted small'}, _('Das Cenas em que figura:')), sceneryLinks(more)) : null; })()),
      refsSection('character', id, draw),
      h('div', {class:'modal-foot'}, h('button', {class:'btn danger', onclick:async () => {
        if (await confirmDialog(_('Eliminar a Personagem «{nome}»? Será removida de todas as Cenas e de todas as Localizações.', {nome:c.name}), {title:_('Eliminar Personagem'), ok:_('Eliminar')})){ deleteCharacter(id); closeFicha(m); commit(); } }}, _('Eliminar Personagem')),
        h('button', {class:'btn primary', onclick:() => m.close()}, _('Fechar'))));
  };
  m.redraw = draw; draw();
  if (isNew) setTimeout(() => { const i = body.querySelector('input'); if (i){ i.focus(); i.select(); } }, 30);
}

/* ---------- Scenery ---------- */
function openSceneryFicha(id, isNew){
  if (!sceneryById(id)) return;
  const body = h('div', {class:'ficha'});
  const m = openModal({title:_('Ficha da Localização'), body, wide:true});
  const draw = () => { draw0(); fichaCols(body); }; // na janela larga, campos à esquerda e secções à direita
  const draw0 = () => {
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
      field(_('Nome'), nameInput(x, _('Localização'), draw)),
      field(_('Importância'), h('div', {class:'loc-role'}, mainToggle(!!x.main, () => { setLocMain(x, !x.main); if (!x.main) x.noMain = true; touch(); draw(); }, true),
        h('span', {class:'muted small'}, _n(scenes.length, 'Aparece em {n} Cena.', 'Aparece em {n} Cenas.')))),
      locSuggest(x) ? locSuggestBox(x, draw) : null,
      section(_('Personagens associadas'), h('button', {class:'btn small', onclick:addChar}, _('+ Associar Personagem')), h('div', {class:'chips'},
        x.chars.map(cid => { const c = charById(cid); return c && h('span', {class:'chip click'}, h('span', {onclick:() => openCharFicha(cid)}, nameOf(c)),
          h('button', {class:'chip-x', onclick:() => { x.chars = x.chars.filter(y => y !== cid); touch(); draw(); }}, '✕')); }),
        x.chars.length ? null : h('span', {class:'muted small'}, _('Sem Personagens associadas.'))),
        inScenes.length ? h('div', {class:'chips also'}, h('span', {class:'muted small'}, _('Figuram nas Cenas desta Localização:')), inScenes.map(c => h('span', {class:'chip click', onclick:() => openCharFicha(c.id)}, nameOf(c)))) : null),
      section(_('Cenas associadas'), h('button', {class:'btn small', onclick:addScene}, _('+ Associar Cena')),
        scenes.length ? scenes.map(s => { const pos = findScenePos(s.id), a = arcById(s.arcId);
          return h('div', {class:'list-row'}, h('span', {class:'dot', style:{background:arcStroke(a)}}),
            h('span', {class:'grow', onclick:() => openSceneFicha(s.id)}, s.title || _('Sem título'), h('span', {class:'muted'}, _(' — #{n} · {tomo} › Capítulo {c}', {n:ni[s.id] + 1, tomo:pos.book.name, c:pos.chIndex + 1}))),
            h('span', {class:'muted small'}, a.name),
            h('button', {class:'chip-x', title:_('Desassociar'), onclick:() => { s.sceneries = s.sceneries.filter(y => y !== id); touch(); draw(); }}, '✕')); })
          : h('div', {class:'muted small'}, _('Ainda não está associado a nenhuma Cena.'))),
      refsSection('scenery', id, draw),
      h('div', {class:'modal-foot'}, h('button', {class:'btn danger', onclick:async () => {
        if (await confirmDialog(_('Eliminar a Localização «{nome}»? Será removida de todas as Cenas e de todas as Personagens.', {nome:x.name}), {title:_('Eliminar Localização'), ok:_('Eliminar')})){ deleteScenery(id); closeFicha(m); commit(); } }}, _('Eliminar Localização')),
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
  const draw = () => { draw0(); fichaCols(body); }; // na janela larga, campos à esquerda e secções à direita
  const draw0 = () => {
    const a = arcById(id); if (!a) return closeFicha(m);
    body.innerHTML = '';
    m.titleEl.innerHTML = ''; m.titleEl.append(h('span', {class:'dot', style:{background:arcStroke(a), width:'14px', height:'14px'}}), _('Ficha do Arco Narrativo'));
    const view = arcView(id, mode), nm = narrIndexMap();
    const parent = a.parentId && arcById(a.parentId), fork = a.forkSceneId && state.scenes[a.forkSceneId];
    const branches = state.arcs.filter(x => x.parentId === id);
    const chk = h('input', {type:'checkbox', checked:mode === 'chron', onchange:e => { mode = e.target.checked ? 'chron' : 'narr'; draw(); }});
    const rowEl = h('div', {class:'arc-row'});
    /* bifurcações e convergências por baixo da Cena onde acontecem, com o mesmo desenho da fita do percurso */
    const links = s => {
      const out = [], mk = (icon, arc, tx) => arc && out.push(h('span', {class:'arc-link', role:'button', tabindex:'0', dataset:{arc:arc.id, tx}, style:{'--lk':arcStroke(arc)}}, svgIcon(icon), arc.name));
      state.arcs.filter(x => x.parentId === s.arcId && x.forkSceneId === s.id).forEach(x => mk('forkR', x, _('Aqui diverge o Ramo «{nome}».', {nome:x.name})));
      const to = s.convergeTo && state.scenes[s.convergeTo]; if (to && to.arcId !== s.arcId){ const t = arcById(to.arcId); t && mk('mergeR', t, _('Este Arco Narrativo converge em «{nome}» depois desta Cena.', {nome:t.name})); }
      Object.values(state.scenes).filter(x => x.convergeTo === s.id && x.arcId !== s.arcId).forEach(x => { const f = arcById(x.arcId); f && mk('mergeL', f, _('«{nome}» converge nesta Cena.', {nome:f.name})); });
      return out.length ? h('div', {class:'arc-links'}, out) : null;
    };
    view.forEach(v => {
      const sa = arcById(v.s.arcId);
      const card = h('div', {class:'arc-card' + (v.inh ? ' inh' : ''), style:{background:arcColor(v.inh ? sa : a, !!v.inh)}, dataset:{scene:v.s.id, own:v.inh ? '' : '1'}},
        h('div', {class:'t'}, v.s.title || _('Sem título')),
        h('div', {class:'m'}, _('Narrativa #{n} · Cronologia {c}', {n:nm[v.s.id] + 1, c:v.s.chron}),
          v.inh ? h('div', null, (v.inh === 'pre' ? _('herdada de «{nome}» (antes da divergência)', {nome:sa.name}) : _('herdada de «{nome}» (após a convergência)', {nome:sa.name}))) : null),
        v.inh ? null : links(v.s));
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
      section(_('Localizações'), null, h('div', {class:'chips'}, sceneryLinks(scns), scns.length ? null : h('span', {class:'muted small'}, _('Sem Localizações nas Cenas deste Arco Narrativo.')))),
      refsSection('arc', id, draw),
      h('div', {class:'modal-foot'}, h('button', {class:'btn danger', disabled:!!(arcOwnScenes(id).length || branches.length), title:_('Só é possível eliminar um Arco Narrativo sem Cenas nem Ramos'),
        onclick:async () => { const a = arcById(id); if (!a || !await confirmDialog(_('Eliminar o Arco Narrativo «{nome}»?', {nome:a.name}), {title:_('Eliminar Arco Narrativo'), ok:_('Eliminar')})) return;
          state.arcs = state.arcs.filter(x => x.id !== id); unlinkRefs('arc', id); closeFicha(m); commit(); snack(_('Arco Narrativo «{nome}» eliminado.', {nome:a.name})); }}, _('Eliminar Arco Narrativo')),
        h('button', {class:'btn primary', onclick:() => m.close()}, _('Fechar'))));
  };
  m.redraw = draw; draw();
}
function wireArcRow(rowEl, arcId, getMode, redraw){
  let timer = null, d = null, moved = false;
  const STEP = 162;
  rowEl.addEventListener('click', e => { if (moved){ moved = false; return; } const l = e.target.closest('.arc-link'); if (l) return openArcFicha(l.dataset.arc); const c = e.target.closest('.arc-card'); if (c) openSceneFicha(c.dataset.scene); });
  rowEl.addEventListener('keydown', e => { const l = e.target.closest('.arc-link'); if (l && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); openArcFicha(l.dataset.arc); } });
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
    { // mover não pergunta antes: fica feito e a barra em baixo oferece «Anular»
      const prev = state.scenes[ids[dd.j - 1]], next = state.scenes[ids[dd.j + 1]];
      if (prev && next && prev.chron === next.chron) s.chron = prev.chron;
      else if (prev) s.chron = prev.chron + 0.5; else s.chron = next.chron - 0.5;
      normalizeChron(arcId); commit(); snack(_('Cena «{nome}» movida para a posição {n} da Ordem Cronológica deste Arco Narrativo.', {nome:s.title || _('Sem título'), n:dd.j + 1}));
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
  const draw = () => { draw0(); fichaCols(body); }; // na janela larga, campos à esquerda e secções à direita
  const draw0 = () => {
    const r = refById(id); if (!r) return closeFicha(m);
    body.innerHTML = '';
    m.titleEl.replaceChildren(refIcon(r.type), REF_TYPES[r.type]);
    const linkInp = h('input', {class:'inp', placeholder:_('Associar a Tomo, Cena, Arco Narrativo, Personagem, Localização ou objetivo…'), style:{width:'360px'}});
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
      h('div', {class:'modal-foot'}, h('button', {class:'btn danger', onclick:async () => { const nome = r.title || _('Sem título'), nota = r.type === 'note';
          if (!await confirmDialog(nota ? _('Eliminar a Nota «{nome}»?', {nome}) : _('Eliminar a Referência «{nome}»?', {nome}), {title:nota ? _('Eliminar Nota') : _('Eliminar Referência'), ok:_('Eliminar')})) return;
          state.refs = state.refs.filter(x => x.id !== id); /* o ficheiro fica guardado até ao próximo arranque, para se poder anular */ closeFicha(m); commit();
          snack(nota ? _('Nota «{nome}» eliminada.', {nome}) : _('Referência «{nome}» eliminada.', {nome})); }}, _('Eliminar')),
        h('button', {class:'btn primary', onclick:() => m.close()}, _('Fechar'))));
  };
  m.redraw = draw; draw();
}

/* ---------- Materiais de Apoio ---------- */
/* índice por nome: cada ficha sabe a que secção e grupo pertence */
const supportIndex = new Map();
/* nos textos dos Materiais de Apoio, *assim* aparece em itálico (o asterisco isolado, ou «* * *», fica como está) */
const supRich = s => { const out = []; let last = 0; String(s).replace(/\*([^*\s][^*]*?)\*/g, (m, t, i) => { out.push(s.slice(last, i), h('em', null, t)); last = i + m.length; return m; }); out.push(s.slice(last)); return out.filter(x => x !== ''); };
SUPPORT.forEach(sec => sec.groups.forEach(g => g.items.forEach(it => { supportIndex.set(it.n, {it, sec, g}); const o = (SUPPORT_ORIGINAL[LANG] || {})[it.n]; if (o) it.o = o; })));
/* o nome de uma ficha de apoio: quando vem de uma expressão estrangeira, o nome original segue entre parênteses */
const supTitle = it => it.o ? [it.n, ' ', h('span', {class:'sup-orig'}, '(' + it.o + ')')] : it.n;
const supLabel = it => it.o ? it.n + ' (' + it.o + ')' : it.n;
function openSupportFicha(name, q){
  const e = supportIndex.get(name); if (!e) return;
  const {it, sec, g} = e;
  const m = openModal({title:_('Materiais de Apoio — ') + sec.name, wide:true, body:h('div', {class:'ficha sup-ficha'},
    h('div', {class:'kicker'}, g.name),
    h('h2', null, supTitle(it)), it.a && h('div', {class:'muted sup-alt'}, it.a), h('p', null, supRich(it.d)),
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
