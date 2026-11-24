'use strict';
/* ===== Quadro principal: Books (colunas) × Story Arcs (linhas) ===== */
const B = { GUT:170, HEAD_BOOK:54, HEAD_CH:34, SW:140, SH:56, SG:24, CP:14, CG:10, BP:12, LANE:86, TOP:6, MIN_CH:120, MIN_BOOK:240,
  CH_NAME_MAX:300, BOOK_NAME_MAX:440, HINT_CH:280, LO:10, LANE_OFF:30 };
/* O que se vê no quadro — nada disto altera o projeto: a ampliação e a vista são deste dispositivo;
   os Arcos Narrativos recolhidos e os filtros são de cada projeto, enquanto a ferramenta está aberta (view.js). */
const View = { zoom:1, dens:'normal', by:{} };
const VIEW_NONE = { hidden:new Set(), f:{} };
const Z = () => View.zoom || 1;
function viewFor(){
  if (tourMode || typeof projActive !== 'function' || !projActive()) return VIEW_NONE; // a visita mostra sempre tudo
  const id = projActive(); return View.by[id] || (View.by[id] = {hidden:new Set(), f:{}});
}
const arcHidden = id => viewFor().hidden.has(id);
/* a faixa (Arco Narrativo) que está a esta altura do quadro; -1 fora das faixas */
const laneAt = by => L ? L.laneTop.findIndex((t, i) => by >= t && by < t + L.laneH[i]) : -1;
/* Os blocos alargam até caber o nome (até um limite razoável; daí para a frente, o nome termina em «…» e aparece inteiro no explicador). */
let measureCtx = null, measureFont = '';
const measureCache = new Map();
function textWidth(t, px){
  const k = px + '|' + t; let w = measureCache.get(k); if (w != null) return w;
  if (!measureCtx){ measureCtx = document.createElement('canvas').getContext('2d'); measureFont = getComputedStyle(document.body).fontFamily; }
  measureCtx.font = px + 'px ' + measureFont; w = measureCtx.measureText(t).width; measureCache.set(k, w); return w;
}
/* largura de que o cabeçalho de um Chapter precisa: margens, número, intervalo, nome */
const chNeed = (name, n) => Math.ceil(10 + Math.max(20, String(n).length * 7 + 10) + 8 + Math.min(textWidth(name || _('Sem título'), 13), B.CH_NAME_MAX) + 10 + 6);
/* e o de um Book: margens do cabeçalho, nome e o espaço dos botões ⓘ e + à direita */
const bookNeed = name => Math.ceil(14 + Math.min(textWidth(name || _('Sem nome'), 18), B.BOOK_NAME_MAX) + (coarse() ? 84 : 60) + 10 + 6);
/* o Chapter da mensagem inicial: largo o bastante para ela caber em poucas linhas, mas nunca mais largo do que o ecrã */
const hintChW = () => { const sc = $('#board-scroll'); return Math.max(B.SW + 2 * B.CP, Math.min(B.HINT_CH, (sc ? sc.clientWidth : innerWidth) / Z() - B.GUT - 2 * B.BP - 8)); };
let hintW = 0; // largura com que a mensagem inicial foi desenhada
const HEAD_H = B.HEAD_BOOK + B.HEAD_CH;
const PROPS = ['x', 'y', 'w'];

let L = null;            // layout alvo atual
let arcSeqs = [];        // sequência cronológica das Scenes de cada Story Arc (para as linhas)
let target = {};
const cur = {};
const els = {};
let drag = null, linkDrag = null, rafOn = false, press = null;
let suppressClick = false, suppressCtx = false, suppressUntil = 0;
let lastPtr = 'mouse';   // o último ponteiro a tocar no quadro: 'mouse', ou 'touch' (dedo, ou caneta sem botão premido)
let pickLink = null;     // Scene de origem enquanto se escolhe, com um toque, a Scene onde o Story Arc converge
/* o botão lateral de uma caneta é um botão direito: segue o caminho do rato */
const isTouchPtr = e => e.pointerType === 'touch' || (e.pointerType === 'pen' && e.button === 0);
const coarse = () => matchMedia('(pointer:coarse)').matches;

function structFromState(){ return cloneStruct(state.books); }
function cloneStruct(s){ return s.map(b => ({id:b.id, chapters:b.chapters.map(c => ({id:c.id, scenes:[...c.scenes]}))})); }
function applyStruct(st){
  const bm = {}, cm = {};
  state.books.forEach(b => { bm[b.id] = b; b.chapters.forEach(c => cm[c.id] = c); });
  state.books = st.map(sb => { const b = bm[sb.id];
    b.chapters = sb.chapters.map(sc => { const c = cm[sc.id]; c.scenes = [...sc.scenes]; return c; }); return b; });
}

function computeLayout(st){
  const lanes = orderedArcs(); const laneIdx = {}; lanes.forEach((l, i) => laneIdx[l.arc.id] = i);
  const names = {}; state.books.forEach(b => { names['b:' + b.id] = b.name; b.chapters.forEach(c => names['c:' + c.id] = c.name); });
  // projeto ainda sem Scenes: o primeiro Chapter alarga para a mensagem inicial caber lá dentro em poucas linhas
  let hintCh = Object.keys(state.scenes).length ? null : (st.find(b => b.chapters.length) || {chapters:[]}).chapters[0];
  const pos = {}, chapters = [], books = []; let x = B.GUT;
  // altura de cada faixa: um Arco Narrativo recolhido (sem visto) ocupa só uma linha fina
  const hid = viewFor().hidden, nLanes = Math.max(lanes.length, 4), laneTop = [], laneH = []; let ly = B.TOP;
  for (let i = 0; i < nLanes; i++){ const hh = i < lanes.length && hid.has(lanes[i].arc.id) ? B.LANE_OFF : B.LANE; laneTop.push(ly); laneH.push(hh); ly += hh; }
  for (const b of st){
    const bx = x; x += B.BP;
    b.chapters.forEach((c, ci) => {
      const n = c.scenes.length;
      const inner = Math.max(n * B.SW + Math.max(0, n - 1) * B.SG, B.MIN_CH - 2 * B.CP);
      const w = Math.max(inner + 2 * B.CP, chNeed(names['c:' + c.id], ci + 1), c === hintCh ? hintChW() : 0);
      pos['c:' + c.id] = {x, y:0, w}; chapters.push({id:c.id, bookId:b.id, x, w});
      c.scenes.forEach((sid, i) => { const s = state.scenes[sid]; const li = (s && laneIdx[s.arcId]) || 0;
        pos['s:' + sid] = {x:x + B.CP + i * (B.SW + B.SG), y:laneTop[li] + (laneH[li] - B.SH) / 2, w:B.SW}; });
      x += w + B.CG;
    });
    if (b.chapters.length) x -= B.CG;
    x += B.BP;
    const bw = Math.max(x - bx, B.MIN_BOOK, bookNeed(names['b:' + b.id]));
    pos['b:' + b.id] = {x:bx, y:0, w:bw}; books.push({id:b.id, x:bx, w:bw}); x = bx + bw;
  }
  pos['addbook'] = {x:x + 12, y:0, w:32};
  return {pos, chapters, books, lanes, laneTop, laneH, width:x + 110, bodyH:ly + 60};
}

function setTargets(layout, struct){
  L = layout; target = layout.pos;
  const order = []; struct.forEach(b => b.chapters.forEach(c => order.push(...c.scenes)));
  const nm = {}; order.forEach((id, i) => nm[id] = i);
  arcSeqs = layout.lanes.map(l => ({arc:l.arc, seq:arcOwnScenes(l.arc.id, nm).map(s => s.id)}));
  L.order = order;
  for (const k in cur) if (!target[k]) delete cur[k];
  for (const k in target){ if (!cur[k]){ const t = target[k]; cur[k] = {x:t.x, y:t.y, w:t.w}; } applyPos(k, cur[k]); }
  fitBoard(); drawLines(); kick();
}
function fitBoard(){
  const board = $('#board'), sc = $('#board-scroll'); if (!board || !L) return;
  const bodyH = Math.max(L.bodyH, sc.clientHeight / Z() - HEAD_H - 2);
  board.style.width = Math.max(L.width, sc.clientWidth / Z()) + 'px';
  board.style.height = (HEAD_H + bodyH) + 'px';
  $('#gutter').style.height = bodyH + 'px';
}
window.addEventListener('resize', fitBoard);
/* quadro vazio: a largura do Chapter da mensagem inicial depende do tamanho da janela */
window.addEventListener('resize', () => requestAnimationFrame(() => { // depois de device.js ajustar a coluna dos Story Arcs
  if (!state || activeTab !== 'board' || drag || Object.keys(state.scenes).length) return;
  if (document.querySelector('#board .rename') || openModals.length || hintChW() === hintW) return;
  renderBoard();
}));

function renderBoard(){
  const head = $('#headLayer'), body = $('#bodyLayer'), gut = $('#gutter');
  head.querySelectorAll('.book-head,.ch-head,.add-book').forEach(e => e.remove());
  body.querySelectorAll('.book-col,.ch-body,.scene,.lane-row,.board-hint').forEach(e => e.remove());
  gut.innerHTML = '';
  for (const k in els) delete els[k];
  const st = structFromState(); const layout = computeLayout(st);
  const nl = layout.laneTop.length, hid = viewFor().hidden, canHide = !tourMode;
  for (let i = 0; i < nl; i++) body.append(h('div', {class:'lane-row' + (layout.laneH[i] < B.LANE ? ' off' : ''), style:{top:layout.laneTop[i] + 'px', height:layout.laneH[i] + 'px'}}));
  /* cada Arco Narrativo tem um visto da sua cor: sem visto, a faixa recolhe-se e as suas Cenas deixam de se ver (nada é apagado) */
  layout.lanes.forEach((l, i) => { const off = hid.has(l.arc.id);
    gut.append(h('div', {class:'lane-label' + (l.depth ? ' branch' : '') + (off ? ' off' : ''), title:_('Abrir ficha do Arco Narrativo'), dataset:{arc:l.arc.id},
      style:{top:layout.laneTop[i] + 'px', height:layout.laneH[i] + 'px'}, onclick:() => openArcFicha(l.arc.id)},
      canHide ? h('button', {class:'lane-ck' + (off ? '' : ' on'), role:'checkbox', 'aria-checked':String(!off), 'aria-label':_('Mostrar o Arco Narrativo «{nome}» no quadro', {nome:l.arc.name}), style:{'--c':arcStroke(l.arc)},
        onclick:e => { e.stopPropagation(); toggleArcShown(l.arc.id); }}, svgIcon('check')) : h('span', {class:'dot', style:{background:arcStroke(l.arc)}}),
      h('span', {class:'lane-name'}, (l.depth ? '↳ ' : '') + l.arc.name))); });
  const lastL = layout.lanes.length - 1;
  gut.append(h('button', {class:'btn small add-arc', style:{top:((lastL >= 0 ? layout.laneTop[lastL] + layout.laneH[lastL] : B.TOP) + 12) + 'px'}, onclick:promptNewArc}, _('+ Arco Narrativo')));
  const nm = narrIndexMap();
  hideHover(); // o «+ Scene» e o «+» voltam a ser calculados no próximo movimento do rato
  const leaf = new Set();
  if (state.arcs.length > 1) state.arcs.forEach(a => { const own = arcOwnScenes(a.id, nm); if (!own.length) return; const lc = own[own.length - 1].chron; own.forEach(o => { if (!o.convergeTo && o.chron === lc) leaf.add(o.id); }); });
  state.books.forEach((b, bi) => {
    // a cor do Book: faixa no cabeçalho e fundo leve na coluna
    const col = h('div', {class:'book-col' + (b.color ? ' colored' : '')}); if (b.color) col.style.setProperty('--book', b.color); body.append(col);
    const hd = h('div', {class:'book-head' + (b.color ? ' colored' : ''), dataset:{book:b.id}},
      h('div', {class:'book-kicker'}, bookDot(b), _('TOMO {n}', {n:bi + 1})),
      h('div', {class:'book-name', title:_('Clique para renomear · clique longo para arrastar')}, b.name || _('Sem nome')),
      h('div', {class:'book-actions'},
        h('button', {class:'icon-btn', title:_('Ficha do Tomo'), 'aria-label':_('Ficha do Tomo'), dataset:{act:'ficha'}}, svgIcon('info')),
        h('button', {class:'icon-btn', title:_('Novo Capítulo'), 'aria-label':_('Novo Capítulo'), dataset:{act:'addch'}}, svgIcon('plus'))),
      layerBar('book', b, 'on-head')); // progresso: Pesquisa, Escrita e Revisão
    if (b.color) hd.style.setProperty('--book', b.color);
    head.append(hd); els['b:' + b.id] = [hd, col];
    b.chapters.forEach((c, ci) => {
      const ch = h('div', {class:'ch-head', dataset:{chapter:c.id}, title:_('Clique no nome para renomear · clique longo para arrastar')},
        h('span', {class:'ch-num'}, ci + 1), h('span', {class:'ch-name'}, c.name || _('Sem título')), layerBar('chapter', c, 'on-ch'));
      const cb = h('div', {class:'ch-body', dataset:{chapter:c.id}});
      head.append(ch); body.append(cb); els['c:' + c.id] = [ch, cb];
      c.scenes.forEach(sid => {
        const s = state.scenes[sid]; const arc = arcById(s.arcId); const pov = s.pov && charById(s.pov);
        const w = isDone(s, 'write'), rv = isDone(s, 'review'), stTxt = rv ? _('Revista') : w ? _x('estado', 'Escrita') : _('Por escrever');
        const el = h('div', {class:'scene' + (hid.has(s.arcId) ? ' gone' : ''), dataset:{scene:sid}, style:{background:arcColor(arc)}},
          h('div', {class:'scene-title'}, s.title || _('Sem título')),
          h('div', {class:'scene-meta'}, h('span', null, '#' + (nm[sid] + 1)), lateMark(s), pov ? h('span', {class:'scene-pov'}, _('POV {nome}', {nome:pov.name.split(' ')[0]})) : null,
            // o estado da Cena: círculo (por escrever), um visto (escrita), dois vistos (revista); um clique avança
            h('button', {class:'scene-st' + (rv ? ' rv' : w ? ' wr' : ''), tabIndex:-1, 'aria-label':_('Estado: {estado}. Clique para avançar.', {estado:stTxt}), dataset:{st:stTxt}}, svgIcon(rv ? 'check2' : w ? 'check' : 'circle'))),
          leaf.has(sid) ? h('button', {class:'conv-h', tabIndex:-1, 'aria-label':_('Criar convergência'), style:{background:arcStroke(arc)}}) : null);
        body.append(el); els['s:' + sid] = [el];
      });
    });
  });
  const ab = h('button', {class:'add-book', title:_('Novo Tomo'), 'aria-label':_('Novo Tomo'), onclick:addBook}, svgIcon('plus'));
  head.append(ab); els['addbook'] = [ab];
  body.querySelectorAll('.first-scene').forEach(e => e.remove());
  if (!Object.keys(state.scenes).length){
    const c0 = layout.chapters[0], tap = coarse();
    // dentro do primeiro Chapter, com quebra de linha à largura dele; sem Chapters, junto à coluna dos Story Arcs
    const hint = h('div', {class:'board-hint'}, c0 ? (tap ? _('Faça um toque longo neste Capítulo para criar a primeira Cena.') : _('Passe o rato por este Capítulo e clique em «+ Cena» para criar a primeira Cena — ou use o botão direito.'))
      : (tap ? _('Crie um Capítulo com o botão + do Tomo; depois, um toque longo dentro dele cria a primeira Cena.') : _('Crie um Capítulo com o botão + do Tomo; depois, o botão direito dentro dele cria a primeira Cena.')));
    if (c0) Object.assign(hint.style, {left:(c0.x + B.CP) + 'px', width:(c0.w - 2 * B.CP) + 'px', maxWidth:'none'});
    hintW = hintChW();
    body.append(hint);
    /* quadro vazio: o cartão «+ Cena» já está à vista na primeira faixa do primeiro Capítulo (sem ser preciso passar o rato) */
    if (c0 && !tourMode){ hint.classList.add('below'); hint.style.top = (layout.laneTop[0] + layout.laneH[0] + 6) + 'px';
      body.append(h('button', {class:'ghost-scene first-scene', 'aria-label':_('Criar a primeira Cena'), style:{translate:(c0.x + B.CP) + 'px ' + (layout.laneTop[0] + (layout.laneH[0] - B.SH) / 2) + 'px', width:B.SW + 'px'},
        onclick:e => { e.stopPropagation(); hideHover(); quickCreate({chId:c0.id, idx:0, arc:layout.lanes.length ? layout.lanes[0].arc : null}); }}, svgIcon('plus'), h('span', null, _('Cena')))); }
  }
  setTargets(layout, st);
  if (pickLink && els['s:' + pickLink]) els['s:' + pickLink][0].classList.add('link-from');
  if (typeof Dual !== 'undefined') Dual.mark();
  if (typeof viewAfterBoard === 'function') viewAfterBoard(); // filtros, ficha aberta ao lado e mini-mapa
}

function applyPos(k, c){
  const e = els[k]; if (!e) return;
  if (k[0] === 's') e[0].style.translate = c.x + 'px ' + c.y + 'px';
  else for (const el of e){ el.style.left = c.x + 'px'; el.style.width = c.w + 'px'; }
}
function kick(){ if (!rafOn){ rafOn = true; requestAnimationFrame(tick); } }
function tick(){
  let moving = false;
  if (drag) autoScroll(); else if (linkDrag && !linkDrag.fake) autoScrollLink();
  const off = drag && target[drag.mainKey] ? (drag.px - drag.grab) - target[drag.mainKey].x : 0;
  for (const k in target){
    const t = target[k]; let c = cur[k];
    if (!c) c = cur[k] = {x:t.x, y:t.y, w:t.w};
    if (drag && drag.keys.has(k)){ c.x = t.x + off; c.y = t.y; c.w = t.w; }
    else for (const p of PROPS){ const d = t[p] - c[p]; if (Math.abs(d) > 0.4){ c[p] += d * 0.2; moving = true; } else c[p] = t[p]; }
    applyPos(k, c);
  }
  drawLines();
  if (moving || drag || linkDrag) requestAnimationFrame(tick); else rafOn = false;
}

function drawLines(){
  const svg = $('#lines'); if (!svg || !L) return;
  const hid = viewFor().hidden, SW = B.SW, SH = B.SH, LO = B.LO; let out = '';
  const P = id => { if (hid.size){ const s = state.scenes[id]; if (s && hid.has(s.arcId)) return null; } return cur['s:' + id]; }; // as Cenas de um Arco recolhido não têm linhas
  const order = hid.size ? L.order.filter(id => P(id)) : L.order; let d = '';
  for (let i = 0; i < order.length - 1; i++){
    const a = P(order[i]), b = P(order[i + 1]); if (!a || !b) continue;
    const ax = a.x + SW, ay = a.y + SH / 2 - LO, bx = b.x, by = b.y + SH / 2 - LO;
    const k = Math.max(12, Math.min(70, Math.abs(bx - ax) / 2));
    d += `M${ax},${ay}C${ax + k},${ay} ${bx - k},${by} ${bx},${by}`;
  }
  for (const {arc, seq} of arcSeqs){
    const col = arcStroke(arc); if (hid.has(arc.id)) continue;
    for (let i = 0; i < seq.length - 1; i++){
      const a = P(seq[i]), b = P(seq[i + 1]); if (!a || !b) continue;
      if (b.x >= a.x + SW - 1){
        const y = a.y + SH / 2 + LO;
        out += `<path class="arcline" stroke="${col}" d="M${a.x + SW},${y}L${b.x},${b.y + SH / 2 + LO}"/>`;
      } else {
        const ax = a.x + SW / 2, ay = a.y + SH, bx = b.x + SW / 2, by = b.y + SH;
        out += `<path class="arcline back" stroke="${col}" d="M${ax},${ay}C${ax},${ay + 34} ${bx},${by + 34} ${bx},${by}"/>`;
      }
    }
    if (arc.parentId && arc.forkSceneId && seq.length){
      const f = P(arc.forkSceneId), t = P(seq[0]);
      if (f && t){
        const fx = f.x + SW / 2 + 24, fy = f.y + (t.y > f.y ? SH : 0), ty = t.y + SH / 2 + LO;
        const tx = t.x >= fx ? t.x : t.x + SW;
        out += `<path class="arcline" stroke="${col}" d="M${fx},${fy}C${fx},${ty} ${fx},${ty} ${tx},${ty}"/><circle cx="${fx}" cy="${fy}" r="4.5" fill="${col}"/>`;
      }
    }
    for (const sid of seq){
      const s = state.scenes[sid]; const ts = s && s.convergeTo && state.scenes[s.convergeTo];
      if (!ts || ts.arcId === arc.id) continue;
      const a = P(sid), t = P(s.convergeTo); if (!a || !t) continue;
      out += convPath(a.x + SW, a.y + SH / 2 + LO, t, col);
    }
  }
  if (linkDrag){
    const a = P(linkDrag.from); const s = state.scenes[linkDrag.from];
    if (a && s){ const col = arcStroke(arcById(s.arcId));
      out += `<path class="arcline temp" stroke="${col}" d="M${a.x + SW},${a.y + SH / 2 + LO}L${linkDrag.x},${linkDrag.y}"/><circle cx="${linkDrag.x}" cy="${linkDrag.y}" r="6" fill="${col}"/>`; }
  }
  svg.innerHTML = out + `<path class="narr-case" d="${d}"/><path class="narr" d="${d}"/>` + frontierMarks(P);
}
/* «A escrita vai aqui» e «A revisão vai aqui»: uma linha vertical antes da primeira Cena (pela Ordem Narrativa)
   ainda por escrever e antes da primeira ainda por rever — como um marcador de livro. */
const escXML = x => String(x).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'})[c]);
function frontiers(){
  const order = narrOrder(), out = [];
  if (!order.length) return out;
  const first = k => order.find(id => !isDone(state.scenes[id], k));
  const w = first('write'), r = first('review');
  if (w) out.push({k:'write', id:w, label:_('A escrita vai aqui')});
  if (r && r !== w && order.some(id => isDone(state.scenes[id], 'write'))) out.push({k:'review', id:r, label:_('A revisão vai aqui')});
  return out;
}
function frontierMarks(P){
  if (!L) return '';
  const H = Math.max(L.bodyH, ($('#board-scroll') || {}).clientHeight / Z() - HEAD_H - 2 || 0);
  /* a legenda repete-se no cimo, por cima das Cenas: a da escrita à direita da linha, a da revisão à esquerda
     (para as duas nunca se taparem quando as linhas estão perto); junto à margem esquerda, ambas à direita */
  return frontiers().map((f, i) => { const p = P(f.id); if (!p) return '';
    const x = Math.round(p.x - 9), y = H - 22 - i * 20, end = f.k === 'review' && x > 140;
    return `<g class="frontier fr-${f.k}"><path d="M${x},2V${y - 14}"/><circle cx="${x}" cy="${y - 14}" r="3.5"/>`
      + `<text class="fr-top" x="${end ? x - 6 : x + 6}" y="14" text-anchor="${end ? 'end' : 'start'}">${escXML(f.label)}</text>`
      + `<text x="${x}" y="${y}" text-anchor="middle">${escXML(f.label)}</text></g>`; }).join('');
}
function convPath(ax, ay, t, col){
  let tx, ty, dd;
  if (t.x >= ax){ tx = t.x; ty = t.y + B.SH / 2 + B.LO; const k = Math.max(20, (tx - ax) / 2); dd = `M${ax},${ay}C${ax + k},${ay} ${tx - k},${ty} ${tx},${ty}`; }
  else { tx = t.x + B.SW / 2 - 24; const below = t.y < ay; ty = t.y + (below ? B.SH : 0); const k = below ? 40 : -40;
    dd = `M${ax},${ay}C${ax + 50},${ay} ${tx},${ty + k * 1.5} ${tx},${ty}`; }
  return `<path class="arcline" stroke="${col}" d="${dd}"/><circle cx="${tx}" cy="${ty}" r="5.5" fill="${col}" stroke="#fff" stroke-width="1.5"/>`;
}

/* ---------- clique longo + drag-and-drop ---------- */
function cancelPress(){ if (press){ clearTimeout(press.t); press = null; } }
function startPress(e, fn){
  cancelPress();
  press = { x:e.clientX, y:e.clientY, last:e, right:e.button === 2, ctx:null, t:setTimeout(() => { const p = press; press = null; fn(p.last); }, 380) };
}
function boardPointerDown(e){
  lastPtr = isTouchPtr(e) ? 'touch' : 'mouse';
  const hd = e.target.closest('.conv-h');
  if (hd){ if (!tourMode && !isTouchPtr(e) && e.button === 0){ e.preventDefault(); beginLink(hd.closest('.scene').dataset.scene, e); if (linkDrag) Object.assign(linkDrag, {handle:true, x0:e.clientX, y0:e.clientY}); } return; }
  if (tourMode || e.target.closest('button,input')) return;
  const sceneEl = e.target.closest('.scene'), chEl = e.target.closest('.ch-head'), bkEl = e.target.closest('.book-head');
  /* Ecrã tátil ou caneta: o toque longo faz de clique longo e de botão direito.
     Toque longo e arrastar move; toque longo e largar (ou num espaço vazio) abre o menu. */
  if (isTouchPtr(e)){
    if (e.isPrimary === false || pickLink){ cancelPress(); return; }
    if (sceneEl) startPress(e, ev => beginDrag('scene', sceneEl.dataset.scene, ev, true));
    else if (chEl) startPress(e, ev => beginDrag('chapter', chEl.dataset.chapter, ev, true));
    else if (bkEl) startPress(e, ev => beginDrag('book', bkEl.dataset.book, ev, true));
    else if (e.target.closest('#bodyLayer')) startPress(e, ev => { suppressUntil = performance.now() + 700; touchHold = true; buzz(); boardMenu(e.target, ev.clientX, ev.clientY); });
    return;
  }
  if (e.button === 2){ if (sceneEl) startPress(e, ev => beginLink(sceneEl.dataset.scene, ev)); return; }
  if (e.button !== 0) return;
  if (sceneEl) startPress(e, ev => beginDrag('scene', sceneEl.dataset.scene, ev));
  else if (chEl) startPress(e, ev => beginDrag('chapter', chEl.dataset.chapter, ev));
  else if (bkEl) startPress(e, ev => beginDrag('book', bkEl.dataset.book, ev));
}
window.addEventListener('pointermove', e => {
  if (press){ press.last = e; if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) cancelPress(); }
  if (drag){ drag.cx = e.clientX; drag.cy = e.clientY; if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 10) drag.moved = true; dragUpdate(); }
  if (linkDrag && !linkDrag.fake) linkMove(e);
});
/* Depois de uma ligação com o botão direito, o menu de contexto que o browser dispara a seguir é ignorado */
let ctxT = null;
function holdCtx(ms){ suppressCtx = true; clearTimeout(ctxT); ctxT = setTimeout(() => suppressCtx = false, ms); }
window.addEventListener('contextmenu', e => { if (suppressCtx || (linkDrag && !linkDrag.fake)) e.preventDefault(); }, true);
/* Esc (ou perder a janela a meio) cancela um arrasto ou uma ligação em curso, sem alterar nada */
function cancelDrags(keepPick){
  cancelPress(); if (keepPick !== true) endPickLink();
  if (drag){ drag = null; document.body.classList.remove('dragging'); renderBoard(); }
  if (linkDrag && !linkDrag.fake){ linkDrag = null; document.body.classList.remove('linking'); holdCtx(4000); renderBoard(); }
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !tourMode) cancelDrags(); });
/* deslocar o quadro com o dedo (pointercancel) ou mudar de janela não desiste da escolha de uma convergência — só Esc */
window.addEventListener('pointercancel', () => cancelDrags(true));
/* Durante um arrasto por toque, o dedo move o que foi levantado — não desloca a página. */
let touchHold = false; // o dedo ainda está no ecrã depois de abrir um menu: um pequeno movimento não deve deslocar o quadro (e fechar o menu)
document.addEventListener('touchmove', e => { if (drag || touchHold || (linkDrag && !linkDrag.fake) || document.body.classList.contains('dragging')) e.preventDefault(); }, {passive:false});
for (const ev of ['pointerup', 'pointercancel', 'touchend', 'touchcancel']) window.addEventListener(ev, () => { touchHold = false; }, true);
const buzz = () => { try { navigator.vibrate && navigator.vibrate(12); } catch(e){} };
window.addEventListener('blur', () => { if (!tourMode) cancelDrags(true); });
window.addEventListener('pointerup', () => {
  const p = press; cancelPress(); if (suppressClick) setTimeout(() => suppressClick = false, 0);
  if (drag) dragEnd();
  if (linkDrag && !linkDrag.fake) linkEnd();
  // macOS/Linux: o menu de contexto é pedido ao premir; só o mostramos ao largar, se não chegou a ser um clique longo
  if (p && p.ctx) boardMenu(p.ctx.target, p.ctx.x, p.ctx.y);
});

function beginDrag(kind, id, e, byTouch){
  const st = structFromState(), base = cloneStruct(st); const keys = new Set(); let item = null, mainKey;
  if (kind === 'scene'){
    base.forEach(b => b.chapters.forEach(c => { const i = c.scenes.indexOf(id); if (i >= 0) c.scenes.splice(i, 1); }));
    mainKey = 's:' + id; keys.add(mainKey);
  } else if (kind === 'chapter'){
    base.forEach(b => { const i = b.chapters.findIndex(c => c.id === id); if (i >= 0) item = b.chapters.splice(i, 1)[0]; });
    mainKey = 'c:' + id; keys.add(mainKey); item.scenes.forEach(s => keys.add('s:' + s));
  } else {
    item = base.splice(base.findIndex(b => b.id === id), 1)[0];
    mainKey = 'b:' + id; keys.add(mainKey); item.chapters.forEach(c => { keys.add('c:' + c.id); c.scenes.forEach(s => keys.add('s:' + s)); });
  }
  if (!cur[mainKey]) return;
  const bx = (e.clientX - $('#board').getBoundingClientRect().left) / Z();
  drag = { kind, id, item, base, baseL:computeLayout(base), keys, mainKey, grab:bx - cur[mainKey].x, px:bx, cx:e.clientX, cy:e.clientY, x0:e.clientX, y0:e.clientY, touch:!!byTouch, moved:false, preview:st, sig:'' };
  if (byTouch){ suppressUntil = performance.now() + 700; buzz(); }
  keys.forEach(k => els[k] && els[k].forEach(el => el.classList.add(k === mainKey ? 'lifted' : 'riding')));
  document.body.classList.add('dragging'); suppressClick = true; closeMenu();
  dragUpdate(); kick();
}
function dragUpdate(){
  const d = drag; const bx = (d.cx - $('#board').getBoundingClientRect().left) / Z(); d.px = bx;
  const p = cloneStruct(d.base); const pos = d.baseL.pos; let sig;
  const nearest = (list) => list.find(c => bx >= c.x && bx <= c.x + c.w) ||
    list.slice().sort((a, b) => Math.abs(a.x + a.w / 2 - bx) - Math.abs(b.x + b.w / 2 - bx))[0];
  if (d.kind === 'scene'){
    const tc = nearest(d.baseL.chapters); if (!tc) return;
    let ch; p.forEach(b => b.chapters.forEach(c => { if (c.id === tc.id) ch = c; }));
    const idx = ch.scenes.filter(s => pos['s:' + s].x + B.SW / 2 < bx).length;
    ch.scenes.splice(idx, 0, d.id); sig = tc.id + ':' + idx;
  } else if (d.kind === 'chapter'){
    const tb = nearest(d.baseL.books); if (!tb) return;
    const bk = p.find(b => b.id === tb.id);
    const idx = bk.chapters.filter(c => pos['c:' + c.id].x + pos['c:' + c.id].w / 2 < bx).length;
    bk.chapters.splice(idx, 0, d.item); sig = tb.id + ':' + idx;
  } else {
    const idx = p.filter(b => pos['b:' + b.id].x + pos['b:' + b.id].w / 2 < bx).length;
    p.splice(idx, 0, d.item); sig = 'b:' + idx;
  }
  if (sig !== d.sig){ d.sig = sig; d.preview = p; setTargets(computeLayout(p), p); }
}
function autoScroll(){
  const sc = $('#board-scroll'), r = sc.getBoundingClientRect(); let dx = 0;
  if (drag.cx > r.right - 70) dx = 14; else if (drag.cx < r.left + B.GUT + 40) dx = -14;
  if (dx){ const before = sc.scrollLeft; sc.scrollLeft += dx; if (sc.scrollLeft !== before) dragUpdate(); }
}
/* ao levar a linha de convergência até à margem, o quadro desloca-se para alcançar Scenes noutros Chapters ou Books */
function autoScrollLink(){
  const sc = $('#board-scroll'), r = sc.getBoundingClientRect(), ld = linkDrag; let dx = 0, dy = 0;
  if (ld.cx > r.right - 60) dx = 14; else if (ld.cx < r.left + B.GUT + 40) dx = -14;
  if (ld.cy > r.bottom - 50) dy = 12; else if (ld.cy < r.top + HEAD_H + 30) dy = -12;
  if (!dx && !dy) return;
  const x0 = sc.scrollLeft, y0 = sc.scrollTop; sc.scrollLeft += dx; sc.scrollTop += dy;
  if (sc.scrollLeft !== x0 || sc.scrollTop !== y0) linkMove({clientX:ld.cx, clientY:ld.cy});
}
function dragEnd(){
  const d = drag; drag = null;
  d.keys.forEach(k => els[k] && els[k].forEach(el => el.classList.remove('lifted', 'riding')));
  document.body.classList.remove('dragging'); setTimeout(() => suppressClick = false, 0); kick();
  if (d.touch) suppressUntil = performance.now() + 500;
  /* Levantar e largar sem mover não é um pedido para mudar de lugar (o sítio onde se pegou no elemento pode já corresponder
     a outra posição). Num ecrã tátil, é o gesto que abre o menu que, com rato, se abre com o botão direito. */
  if (!d.moved){
    renderBoard();
    if (d.touch){ const el = els[d.mainKey] && els[d.mainKey][0]; if (el) boardMenu(el, d.cx, d.cy); }
    return; }
  if (JSON.stringify(d.preview) === JSON.stringify(structFromState())){ renderBoard(); return; }
  /* Mover não pergunta antes: fica feito, e uma barra em baixo diz o que mudou e oferece «Anular». */
  const msg = describeMove(d); applyStruct(d.preview); commit(); snack(msg);
}
function describeMove(d){
  const p = d.preview;
  if (d.kind === 'book'){ const i = p.findIndex(b => b.id === d.id); return _('Tomo «{nome}» movido para a posição {n}, com os seus Capítulos e Cenas.', {nome:bookById(d.id).name, n:i + 1}); }
  if (d.kind === 'chapter'){
    for (const b of p){ const i = b.chapters.findIndex(c => c.id === d.id);
      if (i >= 0) return _('Capítulo «{nome}» movido para o Tomo «{tomo}», como Capítulo {n}.', {nome:findChapter(d.id).chapter.name, tomo:bookById(b.id).name, n:i + 1}); }
  }
  for (const b of p) for (let ci = 0; ci < b.chapters.length; ci++){ const i = b.chapters[ci].scenes.indexOf(d.id);
    if (i >= 0){ const s = state.scenes[d.id]; const c = findChapter(b.chapters[ci].id).chapter;
      return _('Cena «{nome}» movida para o Tomo «{tomo}» › Capítulo {c} «{cap}», posição {n}.', {nome:s.title || _('Sem título'), tomo:bookById(b.id).name, c:ci + 1, cap:c.name, n:i + 1}); } }
  return _('Alteração feita.');
}

/* ---------- convergência (clique longo com o botão direito) ---------- */
function isLeafScene(s){ const seq = arcOwnScenes(s.arcId); return !s.convergeTo && seq.length && seq[seq.length - 1].chron === s.chron; }
function beginLink(id, e){
  const s = state.scenes[id]; if (!s) return;
  if (!isLeafScene(s)){ toast(_('Só uma Cena sem descendência (a última do seu Arco Narrativo) pode convergir.')); holdCtx(4000); return; }
  linkDrag = { from:id, x:0, y:0, hover:null };
  document.body.classList.add('linking'); closeMenu(); linkMove(e); kick();
}
function linkMove(e){
  const r = $('#bodyLayer').getBoundingClientRect();
  linkDrag.x = (e.clientX - r.left) / Z(); linkDrag.y = (e.clientY - r.top) / Z(); linkDrag.cx = e.clientX; linkDrag.cy = e.clientY;
  if (linkDrag.handle && !linkDrag.moved && Math.hypot(e.clientX - linkDrag.x0, e.clientY - linkDrag.y0) > 6) linkDrag.moved = true;
  const el = document.elementFromPoint(e.clientX, e.clientY); const sc = el && el.closest('.scene');
  let hover = null;
  if (sc){ const t = state.scenes[sc.dataset.scene]; if (t && t.arcId !== state.scenes[linkDrag.from].arcId) hover = t.id; }
  if (hover !== linkDrag.hover){
    document.querySelectorAll('.scene.link-target').forEach(x => x.classList.remove('link-target'));
    if (hover) els['s:' + hover][0].classList.add('link-target');
    linkDrag.hover = hover;
  }
}
function linkEnd(){
  const ld = linkDrag; linkDrag = null; document.body.classList.remove('linking');
  document.querySelectorAll('.scene.link-target').forEach(x => x.classList.remove('link-target'));
  holdCtx(150); kick();
  if (ld.handle){ suppressClick = true; setTimeout(() => suppressClick = false, 0); if (!ld.moved) return beginPickLink(ld.from); } // um clique na pega, sem arrastar
  if (!ld.hover) return;
  confirmLink(state.scenes[ld.from], state.scenes[ld.hover]);
}
function confirmLink(a, b){
  confirmDialog(_('Criar convergência: o Arco Narrativo «{a}» passa a convergir, a partir da Cena «{c1}», na Cena «{c2}» do Arco Narrativo «{b}»?', {a:arcById(a.arcId).name, c1:a.title || _('Sem título'), c2:b.title || _('Sem título'), b:arcById(b.arcId).name}),
    {title:_('Confirmar convergência')}).then(ok => { if (ok){ a.convergeTo = b.id; commit(); } });
}

/* Convergência sem arrastar (ecrãs táteis, ou a partir do menu): escolhe-se a Scene de destino com um toque. */
function beginPickLink(id){
  const s = state.scenes[id]; if (!s) return;
  if (!isLeafScene(s)) return toast(_('Só uma Cena sem descendência (a última do seu Arco Narrativo) pode convergir.'));
  pickLink = id; document.body.classList.add('linking'); document.querySelectorAll(`[data-scene="${id}"]`).forEach(x => x.classList.add('link-from')); // no quadro e na lista
  toast(_('Escolha a Cena de outro Arco Narrativo onde este converge. ') + (coarse() ? _('Toque fora de uma Cena para cancelar.') : _('Esc cancela.')));
}
function endPickLink(){
  if (!pickLink) return; pickLink = null; document.body.classList.remove('linking');
  document.querySelectorAll('.link-from').forEach(x => x.classList.remove('link-from'));
}

/* ---------- criação ---------- */
function prevArcSceneBefore(chId, idx, arcId){
  let prev = null;
  for (const b of state.books) for (const c of b.chapters){
    const lim = c.id === chId ? idx : c.scenes.length;
    for (let i = 0; i < lim; i++){ const s = state.scenes[c.scenes[i]]; if (s && s.arcId === arcId) prev = s; }
    if (c.id === chId) return prev;
  }
  return prev;
}
function insertScene(chId, idx, arcId){
  const s = { id:uid('s'), title:'', summary:'', arcId, chron:0, pov:null, chars:[], sceneries:[], convergeTo:null };
  const own = arcOwnScenes(arcId); const after = prevArcSceneBefore(chId, idx, arcId);
  if (after){ own.forEach(o => { if (o.chron > after.chron) o.chron += 1; }); s.chron = after.chron + 1; }
  else { own.forEach(o => o.chron += 1); s.chron = 1; }
  state.scenes[s.id] = s; findChapter(chId).chapter.scenes.splice(idx, 0, s.id); normalizeChron(arcId);
  return s;
}
function createSceneInArc(chId, idx, arcId){ const s = insertScene(chId, idx, arcId); commit(); openSceneFicha(s.id); }
async function createSceneChooseArc(chId, idx){
  const arcId = await chooseArcDialog(); if (arcId) createSceneInArc(chId, idx, arcId);
}
async function createBranchScene(forkScene, chId, idx){
  const name = await promptDialog(_('Novo Ramo'), _('Nome do novo Ramo de «{nome}»', {nome:arcById(forkScene.arcId).name}), '');
  if (name) createSceneInArc(chId, idx, newArc(name, forkScene.arcId, forkScene.id).id);
}
function addBook(){
  const b = { id:uid('b'), name:_('Tomo {n}', {n:state.books.length + 1}), narrator:'', color:null, mainChars:[], chapters:[{ id:uid('c'), name:_('Novo Capítulo'), scenes:[] }] };
  state.books.push(b); commit(); const sc = $('#board-scroll'); sc.scrollTo({left:sc.scrollWidth, behavior:'smooth'});
  return b;
}
function addChapter(bookId){ bookById(bookId).chapters.push({ id:uid('c'), name:_('Novo Capítulo'), scenes:[] }); commit(); }
async function promptNewArc(){ const n = await promptDialog(_('Novo Arco Narrativo'), _('Nome do Arco Narrativo'), ''); if (!n) return null; const a = newArc(n); commit(); return a; }
function inlineRename(el, value, done){
  const inp = h('input', {class:'rename', value});
  const old = el.textContent; el.textContent = ''; el.append(inp); inp.focus(); inp.select();
  let fin = false;
  const end = ok => { if (fin) return; fin = true; const v = inp.value.trim(); if (ok && v && v !== value) done(v); else { el.textContent = old; } };
  inp.addEventListener('blur', () => end(true));
  inp.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); end(true); } if (e.key === 'Escape') end(false); });
}
async function askDeleteScene(id){
  const s = state.scenes[id]; if (!s) return false;
  /* uma só coisa, e pode anular-se: elimina-se logo e a barra em baixo oferece «Anular» (a pergunta fica para o que leva outras coisas consigo) */
  const nome = s.title || _('Sem título'); deleteScene(id); commit(); snack(_('Cena «{nome}» eliminada.', {nome}));
  return true;
}
async function askDeleteChapter(id){
  const f = findChapter(id); const n = f.chapter.scenes.length;
  if (!n){ const nome = f.chapter.name; deleteChapter(id); commit(); return snack(_('Capítulo «{nome}» eliminado.', {nome})); }
  if (await confirmDialog(n === 1 ? _('Eliminar o Capítulo «{nome}» e a sua Cena?', {nome:f.chapter.name}) : n ? _('Eliminar o Capítulo «{nome}» e as suas {n} Cenas?', {nome:f.chapter.name, n}) : _('Eliminar o Capítulo «{nome}»?', {nome:f.chapter.name}), {title:_('Eliminar Capítulo'), ok:_('Eliminar')})){ deleteChapter(id); commit(); }
}
async function askDeleteBook(id){
  const b = bookById(id); const n = bookScenes(b).length, nc = b.chapters.length;
  const chs = nc === 1 ? _('o seu Capítulo') : _('os seus {n} Capítulos', {n:nc}), scs = n === 1 ? _('a sua Cena') : _('as suas {n} Cenas', {n});
  if (await confirmDialog(n ? _('Eliminar o Tomo «{nome}», {c} e {s}?', {nome:b.name, c:chs, s:scs}) : nc ? _('Eliminar o Tomo «{nome}» e {c}?', {nome:b.name, c:chs}) : _('Eliminar o Tomo «{nome}»?', {nome:b.name}), {title:_('Eliminar Tomo'), ok:_('Eliminar')})){ deleteBook(id); commit(); return true; }
  return false;
}

/* ---------- eventos do quadro ---------- */
function initBoard(){
  const board = $('#board');
  board.addEventListener('pointerdown', boardPointerDown);
  board.addEventListener('click', e => {
    if (suppressClick || tourMode || performance.now() < suppressUntil) return;
    if (e.target.closest('.ghost-scene, .ins-plus')){ const t = Quick.at; hideHover(); if (t) quickCreate(t); return; }
    const stb = e.target.closest('.scene-st'); if (stb && !pickLink) return cycleStage(stb.closest('.scene').dataset.scene);
    if (pickLink){
      const a = state.scenes[pickLink], el = e.target.closest('.scene'), b = el && state.scenes[el.dataset.scene]; endPickLink();
      if (a && b && b.arcId !== a.arcId) confirmLink(a, b); else if (b) toast(_('A convergência tem de ser numa Cena de outro Arco Narrativo.'));
      return; }
    const act = e.target.closest('[data-act]');
    if (act){ const id = act.closest('.book-head').dataset.book; if (act.dataset.act === 'ficha') openBookFicha(id); else addChapter(id); return; }
    if (e.target.closest('input')) return;
    const sc = e.target.closest('.scene'); if (sc) return openSceneFicha(sc.dataset.scene);
    const bn = e.target.closest('.book-name');
    if (bn){ const b = bookById(bn.closest('.book-head').dataset.book); return inlineRename(bn, b.name, v => { b.name = v; commit(); }); }
    const cn = e.target.closest('.ch-name');
    if (cn){ const c = findChapter(cn.closest('.ch-head').dataset.chapter).chapter; return inlineRename(cn, c.name, v => { c.name = v; commit(); }); }
  });
  const body = $('#bodyLayer');
  body.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || e.buttons || tourMode || drag || linkDrag || pickLink || press || Quick.edit || modalsBlock() || menuEl) return hideHover();
    if (e.target.closest('.ghost-scene, .ins-plus')) return; // sobre o próprio botão: fica como está
    if (e.target.closest('.scene')) return hideHover();
    const r = body.getBoundingClientRect();
    if (e.clientX < $('#board-scroll').getBoundingClientRect().left + B.GUT * Z()) return hideHover(); // por baixo da coluna dos Story Arcs
    showHover(hoverAt((e.clientX - r.left) / Z(), (e.clientY - r.top) / Z()));
  });
  body.addEventListener('pointerleave', hideHover);
  $('#board-scroll').addEventListener('scroll', hideHover, {passive:true});
  board.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (lastPtr === 'touch') return; // toque longo: o menu é aberto por nós, ao largar
    if (suppressCtx || tourMode){ suppressCtx = false; return; }
    if (press && press.right){ press.ctx = {target:e.target, x:e.clientX, y:e.clientY}; return; } // botão ainda premido: decide-se ao largar
    boardMenu(e.target, e.clientX, e.clientY);
  });
}
function boardMenu(tgt, x, y){
    const cut = el => el && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) ? [{heading:el.textContent}] : [];
    const sc = tgt.closest('.scene');
    if (sc) return showMenu(x, y, [...cut(sc.querySelector('.scene-title')), ...sceneMenuItems(state.scenes[sc.dataset.scene])]);
    const chh = tgt.closest('.ch-head');
    if (chh){ const id = chh.dataset.chapter; const f = findChapter(id);
      return showMenu(x, y, [...cut(chh.querySelector('.ch-name')),
        { label:_('Renomear Capítulo'), action:() => { const el = $(`.ch-head[data-chapter="${id}"] .ch-name`); inlineRename(el, f.chapter.name, v => { f.chapter.name = v; commit(); }); } },
        { label:_('Criar nova Cena'), action:() => createSceneChooseArc(id, f.chapter.scenes.length) }, '-',
        { label:_('Eliminar Capítulo'), action:() => askDeleteChapter(id) } ]); }
    const bh = tgt.closest('.book-head');
    if (bh){ const id = bh.dataset.book;
      return showMenu(x, y, [...cut(bh.querySelector('.book-name')),
        { label:_('Abrir ficha do Tomo'), action:() => openBookFicha(id) },
        { label:_('Novo Capítulo'), action:() => addChapter(id) }, '-',
        { label:_('Eliminar Tomo'), action:() => askDeleteBook(id) } ]); }
    if (tgt.closest('#gutter,.corner')) return; // a coluna fixa dos Story Arcs tapa os Chapters que estão por baixo
    const r = $('#bodyLayer').getBoundingClientRect(); const bx = (x - r.left) / Z(), by = (y - r.top) / Z();
    if (by < 0) return;
    const ch = L.chapters.find(c => bx >= c.x && bx <= c.x + c.w); if (!ch) return;
    const c = findChapter(ch.id).chapter;
    const idx = c.scenes.filter(s => target['s:' + s].x + B.SW / 2 < bx).length;
    const li = laneAt(by), lane = li >= 0 && L.lanes[li] && !arcHidden(L.lanes[li].arc.id) ? L.lanes[li] : null;
    const items = [];
    if (lane){
      const prev = prevArcSceneBefore(ch.id, idx, lane.arc.id);
      items.push({ label:_('Criar nova Cena aqui («{nome}»)', {nome:lane.arc.name}), action:() => createSceneInArc(ch.id, idx, lane.arc.id) });
      items.push({ label:_('Criar nova Cena num novo Ramo'), disabled:!prev, action:() => createBranchScene(prev, ch.id, idx) });
      items.push('-');
      items.push({ label:_('Criar nova Cena noutro Arco Narrativo…'), action:() => createSceneChooseArc(ch.id, idx) });
    } else items.push({ label:_('Criar nova Cena'), action:() => createSceneChooseArc(ch.id, idx) });
    showMenu(x, y, items);
}
/* o menu de uma Scene — no quadro e na vista em Lista */
function sceneMenuItems(s){
  const pos = findScenePos(s.id);
  return [
    { label:_('Criar nova Cena aqui'), action:() => createSceneInArc(pos.chapter.id, pos.index + 1, s.arcId) },
    { label:_('Criar nova Cena num novo Ramo'), action:() => createBranchScene(s, pos.chapter.id, pos.index + 1) }, '-',
    { label:_('Abrir ficha da Cena'), action:() => openSceneFicha(s.id) },
    { label:_('Criar convergência…'), disabled:!isLeafScene(s), action:() => beginPickLink(s.id) },
    { label:_('Remover convergência'), disabled:!s.convergeTo, action:() => { s.convergeTo = null; commit(); } },
    { label:_('Eliminar Cena'), action:() => askDeleteScene(s.id) } ];
}

/* ---------- criar com o rato: «+ Scene» num espaço vazio de um Chapter, «+» entre duas Scenes do mesmo Story Arc ----------
   Como num calendário: um clique cria a Scene ali, na faixa do Story Arc, e fica logo a escrever o título no cartão.
   Enter confirma; Esc (ou sair sem escrever) desiste, como se nada tivesse sido criado. */
const Quick = { at:null, ghost:null, plus:null, edit:null, made:null };
function quickEls(){
  const body = $('#bodyLayer');
  if (!Quick.ghost || !Quick.ghost.isConnected){ Quick.ghost = h('div', {class:'ghost-scene', hidden:true}, svgIcon('plus'), h('span', null, _('Cena'))); body.append(Quick.ghost); }
  if (!Quick.plus || !Quick.plus.isConnected){ Quick.plus = h('button', {class:'ins-plus', hidden:true, tabIndex:-1, 'aria-label':_('Inserir uma Cena aqui')}, svgIcon('plus')); body.append(Quick.plus); }
}
/* o que um clique faria neste ponto do quadro (coordenadas na camada das Scenes) */
function hoverAt(bx, by){
  if (!L) return null;
  const ch = L.chapters.find(c => bx >= c.x && bx <= c.x + c.w); if (!ch) return null;
  const f = findChapter(ch.id); if (!f) return null;
  const c = f.chapter, n = c.scenes.length, nl = L.lanes.length;
  const li = laneAt(by); if (li < 0 || li >= Math.max(nl, 1)) return null;
  const arc = nl ? L.lanes[li].arc : null, arcAt = i => i >= 0 && i < n && state.scenes[c.scenes[i]] ? state.scenes[c.scenes[i]].arcId : null;
  if (arc && arcHidden(arc.id)) return null; // faixa recolhida: nada se cria ali
  const step = B.SW + B.SG, x0 = ch.x + B.CP, rel = bx - x0, top = L.laneTop[li] + (L.laneH[li] - B.SH) / 2, k = Math.floor(rel / step);
  if (rel >= 0 && rel - k * step <= B.SW){ // na coluna de uma Scene: o espaço vazio desta faixa
    if (k < n) return arc && arcAt(k) === arc.id ? null : {kind:'cell', chId:c.id, idx:k, arc, x:x0 + k * step, y:top, w:B.SW};
    const x = x0 + n * step, w = Math.min(B.SW, ch.x + ch.w - B.CP - x);
    if (k === n && w >= 90) return {kind:'cell', chId:c.id, idx:n, arc, x, y:top, w};
  }
  if (!arc || !n) return null;
  const b = rel < 0 ? 0 : Math.min(k + 1, n); // entre duas Scenes (ou antes da primeira, ou depois da última)
  if (arcAt(b - 1) !== arc.id && arcAt(b) !== arc.id) return null;
  const x = b === 0 ? x0 - B.CP / 2 : b === n ? x0 + (n - 1) * step + B.SW + Math.min(B.CP, B.SG) / 2 : x0 + b * step - B.SG / 2;
  return {kind:'gap', chId:c.id, idx:b, arc, x, y:top + B.SH / 2};
}
function showHover(t, keep){
  quickEls(); const g = Quick.ghost, p = Quick.plus; Quick.at = t;
  if (!keep){ g.hidden = !t || t.kind !== 'cell'; p.hidden = !t || t.kind !== 'gap'; }
  if (t && t.kind === 'cell'){ g.hidden = false; g.style.translate = t.x + 'px ' + t.y + 'px'; g.style.width = t.w + 'px'; g.style.setProperty('--arc', t.arc ? arcStroke(t.arc) : 'var(--accent)'); }
  if (t && t.kind === 'gap'){ p.hidden = false; p.style.translate = t.x + 'px ' + t.y + 'px'; p.style.setProperty('--arc', arcColor(t.arc)); }
  const hint = document.querySelector('.board-hint'); if (hint) hint.classList.toggle('off', !g.hidden); // a mensagem inicial dá lugar ao cartão
}
function hideHover(){ if (Quick.at || (Quick.ghost && !Quick.ghost.hidden) || (Quick.plus && !Quick.plus.hidden)) showHover(null); }
/* a visita mostra os dois: «+ Scene» num espaço vazio e «+» entre duas Scenes do mesmo Story Arc */
function quickDemo(){
  if (!L) return; let cell = null, gap = null;
  for (const ch of L.chapters){ const c = findChapter(ch.id).chapter, n = c.scenes.length, step = B.SW + B.SG, x0 = ch.x + B.CP;
    L.lanes.forEach((l, li) => { const y = L.laneTop[li] + L.laneH[li] / 2;
      for (let k = 0; k < n && !cell; k++) if (state.scenes[c.scenes[k]].arcId !== l.arc.id) cell = hoverAt(x0 + k * step + B.SW / 2, y);
      for (let b = 1; b < n && !gap; b++) if (state.scenes[c.scenes[b - 1]].arcId === l.arc.id && state.scenes[c.scenes[b]].arcId === l.arc.id) gap = hoverAt(x0 + b * step - B.SG / 2, y); }); }
  showHover(null); if (gap) showHover(gap, true); if (cell) showHover(cell, true);
}
function quickCreate(t){
  if (tourMode || !findChapter(t.chId)) return;
  if (!t.arc || !arcById(t.arc.id)) return createSceneChooseArc(t.chId, t.idx); // ainda sem Story Arcs: escolhe-se (ou cria-se) primeiro
  const s = insertScene(t.chId, t.idx, t.arc.id); commit();
  Quick.made = {id:s.id, snap:Hist.last};
  titleEdit(s.id);
}
function titleEdit(id){
  const el = els['s:' + id] && els['s:' + id][0], tt = el && el.querySelector('.scene-title'); if (!tt) return;
  const inp = h('input', {class:'scene-rename', placeholder:_('Título da Cena'), 'aria-label':_('Título da nova Cena'), maxLength:300});
  tt.textContent = ''; tt.append(inp); el.classList.add('editing'); inp.focus();
  let done = false;
  const fin = how => {
    if (done) return; done = true; Quick.edit = null;
    const s = state.scenes[id]; if (!s) return;
    const v = inp.value.trim();
    if (how === 'cancel' || (how === 'blur' && !v)) return quickUndo(id);
    Quick.made = null;
    if (v){ s.title = v; save(true, true); } // o título junta-se ao passo «criar»: um só Anular desfaz as duas coisas
    renderAll();
  };
  Quick.edit = {id, fin};
  inp.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); fin('enter'); } else if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); fin('cancel'); } });
  inp.addEventListener('blur', () => fin('blur'));
}
function quickUndo(id){
  const q = Quick.made; Quick.made = null;
  if (q && q.id === id && Hist.last === q.snap && Hist.undo.length) histStep(Hist.undo, []); // como se não tivesse sido criada (nem fica para Refazer)
  else if (state.scenes[id]){ deleteScene(id); commit(); }
}
