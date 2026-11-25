/* Suite de QA do Narrative.
   Corre dentro da própria página (num servidor local): carregar este script e ler window.__qa (Promise).
   ATENÇÃO: substitui o projeto guardado nesse browser/endereço — usar só numa origem de testes. */
window.__qa = (async () => {
  const R = [], errs = [], perf = {};
  window.addEventListener('error', e => errs.push(e.message));
  window.addEventListener('unhandledrejection', e => errs.push('rejection: ' + ((e.reason && e.reason.message) || e.reason)));
  const W = ms => new Promise(r => setTimeout(r, ms));
  const ok = (c, m) => { if (!c) throw new Error(m || 'assert'); };
  const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'eq') + ': ' + JSON.stringify(a) + ' ≠ ' + JSON.stringify(b)); };
  function settle(){ for (const k in target){ cur[k] = {...target[k]}; applyPos(k, cur[k]); } drawLines(); }
  function reset(){
    if (Tour.active) endTour();
    closeAllModals(); closeMenu(); drag = null; linkDrag = null; cancelPress(); suppressClick = false; suppressCtx = false;
    endPickLink(); suppressUntil = 0; Quick.edit = null; Quick.made = null; clearInterval(Upd.waitI); Upd.state = 'idle'; Upd.remote = null; Upd.notes = ''; Upd.ready = false; try { localStorage.removeItem(LS_UPD); } catch (e) {} updUI(); Sync.links.clear(); Sync.cfg.pairs = []; Sync.peer = null; clearTimeout(Sync.sendT); Sync.status = 'off'; try { localStorage.removeItem(LS_BACKUP); } catch (e) {} syncUI(); lastPtr = 'mouse'; touchHold = false; knownReset = lsGet(LS_RESET); $('#dualBtn').hidden = false; Dual.role = 'main'; Dual.seen = 0; Dual.sel = null; Dual.follow = true; Dual.post = () => {}; document.body.classList.remove('second', 'dragging');
    document.querySelectorAll('.toast').forEach(t => t.remove());
    /* um só projeto aberto, sempre o mesmo, como antes dos vários projetos */
    if (projNone()) projAdd(blankProject());
    { const I = Projects.idx; I.open = [I.active]; I.recent = []; projSaveIdx(); Projects.hist.clear(); Projects.handles.clear(); Projects.leaving = false; }
    lsSet(LS_THEME, 'dark'); // as verificações de cor partem do tema escuro (o browser de testes diz «claro»)
    state = blankProject(); activeTab = 'board';
    Object.assign(filters, { booksChar:null, booksArc:null, charsBook:'', charsRole:'all', arcsChar:null, scnChar:null, refsType:'all', supSec:'narrador', supQ:'' });
    renderAll(); settle(); $('#board-scroll').scrollLeft = 0; $('#board-scroll').scrollTop = 0;
    View.by = {}; filters.calMode = null; filters.scnRole = 'all'; Tour.paused = null; tourPausedUI(); document.querySelectorAll('.loc-nudge').forEach(x => x.remove()); SecOff.clear(); ListUI.q = {}; ListUI.sort = {}; ListUI.layout = 'cards'; ViewPref.zoom = 1; ViewPref.dens = 'normal'; Narr.view = null; Dock.on = false; Coach.last = Infinity; // filtros, vista, ampliação e dicas: como ao abrir pela primeira vez
    document.querySelectorAll('.coach').forEach(t => t.remove()); renderAll(); settle();
    histInit(); hideTip(); setTipsOn(true);
  }
  const T = async (name, fn) => { window.__qaLast = name; try { reset(); await fn(); R.push({name, ok:true}); } catch (e) { R.push({name, ok:false, err:String((e && e.message) || e)}); } };

  /* ---- fixture: 2 Tomos, 3 Capítulos, 2 Arcos Narrativos, 6 Cenas ---- */
  function fx(){
    const B1 = state.books[0], c1 = B1.chapters[0]; c1.name = 'C1';
    const c2 = { id:uid('c'), name:'C2', scenes:[] }; B1.chapters.push(c2);
    const c3 = { id:uid('c'), name:'C3', scenes:[] };
    const B2 = { id:uid('b'), name:'Tomo 2', narrator:'', color:null, mainChars:[], chapters:[c3] }; state.books.push(B2);
    const A = newArc('A'), Bq = newArc('B');
    const S = (ch, i, arc, t) => { const s = insertScene(ch.id, i, arc.id); s.title = t; return s; };
    const a1 = S(c1, 0, A, 'a1'), b1 = S(c1, 1, Bq, 'b1'), a2 = S(c1, 2, A, 'a2'), a3 = S(c2, 0, A, 'a3'), b2 = S(c3, 0, Bq, 'b2'), a4 = S(c3, 1, A, 'a4');
    renderAll(); settle(); histInit(); // o histórico começa aqui: «Anular» não desfaz o cenário de teste
    return { B1, B2, c1, c2, c3, A, Bq, a1, b1, a2, a3, b2, a4 };
  }
  const titles = () => state.books.map(b => b.chapters.map(c => c.scenes.map(i => state.scenes[i].title)));
  const sceneEl = id => document.querySelector(`.scene[data-scene="${id}"]`);
  const chHead = id => document.querySelector(`.ch-head[data-chapter="${id}"]`);
  const bkHead = id => document.querySelector(`.book-head[data-book="${id}"]`);
  const pe = (type, el, x, y, button = 0) => el.dispatchEvent(new PointerEvent(type, {bubbles:true, cancelable:true, clientX:x, clientY:y, button, pointerId:1}));
  async function longPress(el, button = 0){ const r = el.getBoundingClientRect(); pe('pointerdown', el, r.left + 20, r.top + 20, button); await W(430); return r; }
  async function dragTo(el, cx){ const r = await longPress(el); ok(drag, 'o clique longo não iniciou o arrasto'); pe('pointermove', window, cx, r.top + 20); pe('pointerup', window, cx, r.top + 20); await W(30); }
  function dropX(kind, id, containerId, idx){
    const base = structFromState();
    if (kind === 'scene') base.forEach(b => b.chapters.forEach(c => { const i = c.scenes.indexOf(id); if (i >= 0) c.scenes.splice(i, 1); }));
    else if (kind === 'chapter') base.forEach(b => { const i = b.chapters.findIndex(c => c.id === id); if (i >= 0) b.chapters.splice(i, 1); });
    else base.splice(base.findIndex(b => b.id === id), 1);
    const bl = computeLayout(base); let x;
    if (kind === 'scene'){ let ch; base.forEach(b => b.chapters.forEach(c => { if (c.id === containerId) ch = c; }));
      x = idx === 0 ? bl.chapters.find(c => c.id === containerId).x + 3 : bl.pos['s:' + ch.scenes[idx - 1]].x + B.SW / 2 + 6; }
    else if (kind === 'chapter'){ const bk = base.find(b => b.id === containerId);
      if (idx === 0) x = bl.books.find(b => b.id === containerId).x + 3; else { const p = bl.pos['c:' + bk.chapters[idx - 1].id]; x = p.x + p.w / 2 + 6; } }
    else { if (idx === 0) x = B.GUT + 3; else { const p = bl.pos['b:' + base[idx - 1].id]; x = p.x + p.w / 2 + 6; } }
    return x + $('#board').getBoundingClientRect().left;
  }
  const modals = () => [...document.querySelectorAll('.modal:not(.slide-ghost)')]; // a cópia da ficha que sai ao deslizar entre Cenas não conta
  const topModal = () => modals()[modals().length - 1];
  const btn = (text, root) => [...(root || topModal()).querySelectorAll('button,a.btn')].find(b => b.textContent.includes(text));
  const snackEl = () => document.querySelector('.toast.snack');
  /* confirmações: uma pergunta (janela) ou, para o que se faz logo e se pode anular, a barra com «Anular» */
  async function answer(yes){ const m = topModal(); if (!(m && btn('Cancelar', m)) && snackEl()){ if (!yes) snackEl().querySelector('.snack-undo').click(); else snackEl().remove(); await W(30); return; } ok(m, 'não apareceu popup de confirmação'); (yes ? m.querySelector('.modal-foot .btn.primary') : btn('Cancelar', m)).click(); await W(30); }
  const setInput = (inp, v) => { inp.value = v; inp.dispatchEvent(new Event('input', {bubbles:true})); };
  const setSelect = (sel, v) => { sel.value = v; sel.dispatchEvent(new Event('change', {bubbles:true})); };
  async function pickAC(inp, text, label){
    inp.focus(); inp.dispatchEvent(new Event('focus')); setInput(inp, text); await W(10);
    const it = [...document.querySelectorAll('.ac-item')].find(x => x.textContent.includes(label)); ok(it, 'sugestão «' + label + '» não apareceu');
    it.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, cancelable:true})); await W(20);
  }
  const ctx = (el, x, y) => el.dispatchEvent(new MouseEvent('contextmenu', {bubbles:true, cancelable:true, clientX:x, clientY:y, button:2}));
  const menuLabels = () => [...document.querySelectorAll('.ctx-item')].map(x => x.textContent);
  const menuClick = async label => { const it = [...document.querySelectorAll('.ctx-item')].find(x => x.textContent.includes(label)); ok(it, 'opção «' + label + '» em falta'); it.click(); await W(30); };
  function layoutInvariants(){
    const st = structFromState(), l = computeLayout(st); const xs = [];
    st.forEach(b => b.chapters.forEach(c => c.scenes.forEach(s => xs.push(l.pos['s:' + s].x))));
    for (let i = 1; i < xs.length; i++) ok(xs[i] >= xs[i - 1] + B.SW, 'duas Cenas partilham espaço vertical');
    const ys = {}; Object.values(state.scenes).forEach(s => { (ys[s.arcId] = ys[s.arcId] || new Set()).add(l.pos['s:' + s.id].y); });
    const seen = new Set(); for (const a in ys){ ok(ys[a].size === 1, 'Cenas do mesmo arc desalinhadas'); const y = [...ys[a]][0]; ok(!seen.has(y), 'dois arcs na mesma faixa'); seen.add(y); }
    l.books.forEach((b, i) => { if (i) ok(b.x >= l.books[i - 1].x + l.books[i - 1].w, 'Tomos sobrepostos'); });
    l.chapters.forEach(c => { const b = l.books.find(x => x.id === c.bookId); ok(c.x >= b.x && c.x + c.w <= b.x + b.w + 0.01, 'Capítulo fora do seu Tomo'); });
    return l;
  }

  /* ================= A. MODELO ================= */
  await T('A01 projeto em branco tem 1 Tomo com 1 Capítulo', () => { eq(state.books.length, 1); eq(state.books[0].chapters.length, 1); eq(Object.keys(state.scenes).length, 0); });
  await T('A02 Ordem Narrativa é a sequência Tomos›Capítulos›Cenas', () => { const f = fx(); eq(narrOrder().map(i => state.scenes[i].title), ['a1', 'b1', 'a2', 'a3', 'b2', 'a4']); });
  await T('A03 nova Cena entra na Ordem Cronológica entre as vizinhas', () => { const f = fx();
    const n = insertScene(f.c1.id, 1, f.A.id); eq([f.a1.chron, n.chron, f.a2.chron, f.a3.chron, f.a4.chron], [1, 2, 3, 4, 5]); });
  await T('A04 Cena criada antes de todas fica em 1.º na cronologia', () => { const f = fx(); const n = insertScene(f.c1.id, 0, f.Bq.id); eq([n.chron, f.b1.chron, f.b2.chron], [1, 2, 3]); });
  await T('A05 posições cronológicas podem coexistir e mantêm-se', () => { const f = fx(); f.a3.chron = 2; normalizeChron(f.A.id); eq([f.a1.chron, f.a2.chron, f.a3.chron, f.a4.chron], [1, 2, 2, 3]); });
  await T('A06 Ramos ficam imediatamente abaixo do seu Arco Narrativo', () => { const f = fx(); const br = newArc('A-branch', f.A.id, f.a2.id); const br2 = newArc('sub', br.id, null);
    eq(orderedArcs().map(l => l.arc.name), ['A', 'A-branch', 'sub', 'B']); eq(orderedArcs().map(l => l.depth), [0, 1, 2, 0]); });
  await T('A07 Ramo mostra as Cenas anteriores à divergência', () => { const f = fx(); const br = newArc('br', f.A.id, f.a2.id); const s = insertScene(f.c2.id, 1, br.id); s.title = 'x';
    const v = arcView(br.id, 'chron'); eq(v.map(x => x.s.title + ':' + x.inh), ['a1:pre', 'a2:pre', 'x:null']); });
  await T('A08 arc convergente mostra as Cenas após a convergência', () => { const f = fx(); f.b2.convergeTo = f.a3.id;
    eq(arcView(f.Bq.id, 'chron').map(x => x.s.title + ':' + x.inh), ['b1:null', 'b2:null', 'a3:post', 'a4:post']);
    eq(arcView(f.Bq.id, 'narr').map(x => x.s.title), ['b1', 'a3', 'b2', 'a4']); });
  await T('A09 convergência circular não bloqueia', () => { const f = fx(); f.b2.convergeTo = f.a1.id; f.a4.convergeTo = f.b1.id; ok(arcView(f.A.id, 'chron').length > 0); ok(arcView(f.Bq.id, 'chron').length > 0); });
  await T('A10 eliminar Cena limpa convergências, bifurcações e referências', () => { const f = fx();
    const br = newArc('br', f.A.id, f.a2.id); f.b2.convergeTo = f.a2.id; state.refs.push({id:'r', type:'note', title:'n', links:[{kind:'scene', id:f.a2.id}]});
    deleteScene(f.a2.id); eq(f.b2.convergeTo, null); eq(br.forkSceneId, f.a1.id); eq(state.refs[0].links, []); eq([f.a1.chron, f.a3.chron, f.a4.chron], [1, 2, 3]); renderAll(); });
  await T('A11 eliminar Capítulo e Tomo elimina as suas Cenas', () => { const f = fx(); deleteChapter(f.c1.id); eq(Object.keys(state.scenes).length, 3); deleteBook(f.B2.id); eq(Object.keys(state.scenes).length, 1); eq(state.books.length, 1); renderAll(); });
  await T('A12 eliminar Personagem limpa Cenas e Personagens Principais', () => { const f = fx(); const c = newCharacter('X'); f.a1.chars.push(c.id); f.a1.pov = c.id; f.B1.mainChars.push(c.id);
    deleteCharacter(c.id); eq(f.a1.chars, []); eq(f.a1.pov, null); eq(f.B1.mainChars, []); });
  await T('A13 lista de Personagens do Tomo: Main primeiro, POV, só neste Tomo', () => { const f = fx();
    const ana = newCharacter('Ana'), zed = newCharacter('Zed'), bia = newCharacter('Bia');
    f.a1.chars.push(ana.id, zed.id); f.b1.pov = bia.id; f.a4.chars.push(zed.id); f.B1.mainChars.push(zed.id);
    eq(bookCharacters(f.B1).map(x => x.ch.name + (x.main ? '*' : '') + (x.pov ? '^' : '')), ['Zed*', 'Ana', 'Bia^']);
    eq(bookCharacters(f.B2).map(x => x.ch.name + (x.main ? '*' : '')), ['Zed']); ok(isMain(zed.id) && !isMain(ana.id)); });
  await T('A14 cores automáticas distintas para 12 Arcos Narrativos, também com daltonismo', () => { for (let i = 0; i < 12; i++) newArc('arc' + i);
    const ks = state.arcs.map(a => a.hue + ':' + arcSat(a)); eq(new Set(ks).size, 12);
    // protanopia, deuteranopia e tritanopia (Machado et al., 2009) em RGB linear; distância CIE76 em Lab, nos cartões e nas linhas
    const lin = x => x <= .04045 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4), gam = x => x <= .0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - .055;
    const M = [null, [[.152286, 1.052583, -.204868], [.114503, .786281, .099216], [-.003882, -.048116, 1.051998]], [[.367322, .860646, -.227968], [.280085, .672501, .047413], [-.011820, .042940, .968881]], [[1.255528, -.076749, -.178779], [-.078411, .930809, .147602], [.004733, .691367, .303900]]];
    const sim = (c, m) => m ? m.map(r => gam(Math.max(0, Math.min(1, r[0] * lin(c[0]) + r[1] * lin(c[1]) + r[2] * lin(c[2]))))) : c;
    const lab = c => { const [r, g, b] = c.map(lin), f = t => t > .008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; const x = f((r * .4124 + g * .3576 + b * .1805) / .95047), y = f(r * .2126 + g * .7152 + b * .0722), z = f((r * .0193 + g * .1192 + b * .9505) / 1.08883); return [116 * y - 16, 500 * (x - y), 200 * (y - z)]; };
    const rgb = css => { const d = document.createElement('div'); d.style.color = css; document.body.append(d); const v = getComputedStyle(d).color.match(/[\d.]+/g).slice(0, 3).map(n => n / 255); d.remove(); return v; };
    const six = state.arcs.slice(0, 6); let min = Infinity;
    for (const m of M) for (const col of [arcColor, arcStroke]) six.forEach((a, i) => six.forEach((b, j) => { if (i < j){ const p = lab(sim(rgb(col(a)), m)), q = lab(sim(rgb(col(b)), m)); min = Math.min(min, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])); } }));
    ok(min >= 8, 'dois dos 6 primeiros Arcos Narrativos confundem-se com daltonismo: ΔE ' + min.toFixed(1)); });
  await T('A15 sanitize repara dados incompletos', () => { const d = sanitize({ books:[{id:'b', name:'x', chapters:[{id:'c', name:'c', scenes:['fantasma']}]}], scenes:{} });
    eq(d.books[0].chapters[0].scenes, []); ok(Array.isArray(d.books[0].mainChars) && d.project.palette && Array.isArray(d.refs)); });
  await T('A16 persistência: guardar e recarregar dá o mesmo estado', () => { fx(); flushSave(); eq(loadState(), JSON.parse(JSON.stringify(state))); });

  await T('A17 sanitize: ficheiro hostil ou incoerente é reparado', () => { const d = sanitize({ project:{ palette:{ h:'"><img>', mode:'x' } },
      books:[{ id:'b', name:'x', mainChars:['nao-existe'], chapters:[{ id:'c', name:'c', scenes:['s1', 's1', 's2'] }] }],
      scenes:{ s1:{ id:'s1', arcId:'nao-existe', pov:'fantasma', chars:['fantasma'], chron:'abc', convergeTo:'zzz' }, s2:{ id:'s2', arcId:'a', chron:2 }, solta:{ id:'solta', arcId:'a' } },
      arcs:[{ id:'a', name:'A', hue:'0"/><img src=x onerror=alert(1)>', parentId:'a', forkSceneId:'zzz' }], characters:[], refs:[{ id:'r', type:'exe', links:[null, {}] }] });
    eq(d.books[0].chapters[0].scenes, ['s1', 's2']); ok(!d.scenes.solta, 'Cena fora de qualquer Capítulo removida'); eq(d.books[0].mainChars, []);
    eq([d.scenes.s1.pov, d.scenes.s1.chars, d.scenes.s1.chron, d.scenes.s1.convergeTo], [null, [], 0, null]); ok(d.arcs.some(a => a.id === d.scenes.s1.arcId), 'arc de recurso criado');
    eq([d.arcs[0].hue, d.arcs[0].parentId, d.arcs[0].forkSceneId], [0, null, null]); eq(d.project.palette, {h:0, mode:'dark'}); eq([d.refs[0].type, d.refs[0].links], ['note', []]);
    state = d; renderAll(); openSceneFicha('s1'); ok(topModal(), 'ficha abre com dados reparados'); eq(document.querySelectorAll('#lines img, #board img').length, 0); });

  /* ================= B. LAYOUT ================= */
  await T('B01 invariantes: colunas únicas por Cena, faixa única por arc, Tomos sem sobreposição', () => { fx(); layoutInvariants(); });
  await T('B02 largura do Tomo adapta-se ao conteúdo', () => { const f = fx(); const w0 = computeLayout(structFromState()).pos['b:' + f.B1.id].w;
    insertScene(f.c2.id, 1, f.A.id); const w1 = computeLayout(structFromState()).pos['b:' + f.B1.id].w; eq(Math.round(w1 - w0), B.SW + B.SG); });
  await T('B03 Tomo e Capítulo vazios: largura mínima, mas cabe sempre o nome; sem Cenas, o primeiro Capítulo leva a mensagem inicial', () => { let l = computeLayout(structFromState());
    eq(l.chapters[0].w, hintChW()); eq(l.pos['b:' + state.books[0].id].w, Math.max(B.MIN_BOOK, hintChW() + 2 * B.BP));
    const f = fx(); f.c2.scenes.forEach(id => deleteScene(id)); f.c2.name = 'C'; renderAll(); l = computeLayout(structFromState()); eq(l.chapters.find(c => c.id === f.c2.id).w, B.MIN_CH);
    f.c2.name = 'Um nome de Capítulo bastante comprido'; f.B2.name = 'Um título de Tomo também comprido'; renderAll(); settle();
    const n = chHead(f.c2.id).querySelector('.ch-name'), bn = bkHead(f.B2.id).querySelector('.book-name'); ok(n.scrollWidth <= n.clientWidth + 1, 'nome do Capítulo cortado'); ok(bn.scrollWidth <= bn.clientWidth + 1, 'nome do Tomo cortado');
    f.c2.name = 'x'.repeat(200); renderAll(); settle(); const n2 = chHead(f.c2.id).querySelector('.ch-name'); ok(n2.scrollWidth > n2.clientWidth, 'um nome enorme termina em «…»'); ok(chHead(f.c2.id).getBoundingClientRect().width <= B.CH_NAME_MAX + 80); eq(tipFor(chHead(f.c2.id)).title, 'x'.repeat(200)); });
  await T('B04 Tomo sem Capítulos não quebra o layout', () => { state.books[0].chapters = []; renderAll(); layoutInvariants(); ok(bkHead(state.books[0].id)); });
  await T('B05 linha branca liga N Cenas com N-1 segmentos; linhas dos arcs presentes', () => { fx();
    const d = document.querySelector('#lines .narr').getAttribute('d'); eq((d.match(/M/g) || []).length, 5); eq(document.querySelectorAll('#lines .arcline').length, 4); });
  await T('B06 cronologia que recua desenha linha tracejada', () => { const f = fx(); f.a1.chron = 2.5; normalizeChron(f.A.id); renderAll(); ok(document.querySelectorAll('#lines .arcline.back').length >= 1); });
  await T('B07 Cena tem a cor do seu Arco Narrativo e o número narrativo', () => { const f = fx(); const el = sceneEl(f.a3.id);
    const probe = h('span', {style:{color:arcColor(f.A)}}); document.body.append(probe); const c = getComputedStyle(probe).color; probe.remove();
    eq(getComputedStyle(el).backgroundColor, c); ok(el.textContent.includes('#4')); });
  await T('B08 numeração automática dos Capítulos por Tomo', () => { const f = fx(); eq([...document.querySelectorAll('.ch-num')].map(x => x.textContent), ['1', '2', '1']); });

  /* ================= C. INTERAÇÃO NO QUADRO ================= */
  await T('C01 clique simples abre a ficha, sem arrasto', async () => { const f = fx(); const el = sceneEl(f.a1.id); const r = el.getBoundingClientRect();
    pe('pointerdown', el, r.left + 20, r.top + 20); await W(60); pe('pointerup', window, r.left + 20, r.top + 20); el.click(); await W(20);
    ok(!drag); ok(topModal() && topModal().textContent.includes('Ficha da Cena')); });
  await T('C02 mover o rato antes do clique longo cancela o arrasto', async () => { const f = fx(); const el = sceneEl(f.a1.id); const r = el.getBoundingClientRect();
    pe('pointerdown', el, r.left + 20, r.top + 20); await W(100); pe('pointermove', window, r.left + 60, r.top + 20); await W(430); ok(!drag); pe('pointerup', window, 0, 0); });
  await T('C03 arrastar Cena dentro do Capítulo: pré-visualização, confirmação e cancelamento', async () => { const f = fx();
    const r = await longPress(sceneEl(f.a1.id)); ok(drag && sceneEl(f.a1.id).classList.contains('lifted'), 'Cena não ficou elevada');
    const cx = dropX('scene', f.a1.id, f.c1.id, 2); pe('pointermove', window, cx, r.top + 20);
    eq(L.order.map(i => state.scenes[i].title), ['b1', 'a2', 'a1', 'a3', 'b2', 'a4'], 'pré-visualização');
    pe('pointerup', window, cx, r.top + 20); await W(30);
    ok(!topModal() && snackEl().textContent.includes('Cena «a1» movida'), 'mover não pergunta: avisa e oferece Anular'); await answer(false);
    eq(titles(), [[['a1', 'b1', 'a2'], ['a3']], [['b2', 'a4']]], 'cancelar não altera'); eq(L.order.map(i => state.scenes[i].title)[0], 'a1', 'pré-visualização revertida');
    settle(); await dragTo(sceneEl(f.a1.id), dropX('scene', f.a1.id, f.c1.id, 2)); await answer(true);
    eq(titles(), [[['b1', 'a2', 'a1'], ['a3']], [['b2', 'a4']]]); ok(sceneEl(f.a1.id).textContent.includes('#3'), 'número narrativo atualizado'); layoutInvariants(); });
  await T('C04 arrastar Cena para Capítulo de outro Tomo', async () => { const f = fx();
    await dragTo(sceneEl(f.a1.id), dropX('scene', f.a1.id, f.c3.id, 1)); ok(snackEl().textContent.includes('Tomo 2')); await answer(true);
    eq(titles(), [[['b1', 'a2'], ['a3']], [['b2', 'a1', 'a4']]]); eq(f.a1.chron, 1, 'a cronologia não muda'); layoutInvariants(); });
  await T('C05 arrastar Cena para Capítulo vazio', async () => { const f = fx(); const c4 = { id:uid('c'), name:'C4', scenes:[] }; f.B2.chapters.push(c4); renderAll(); settle();
    await dragTo(sceneEl(f.a2.id), dropX('scene', f.a2.id, c4.id, 0)); await answer(true); eq(c4.scenes, [f.a2.id]); });
  await T('C06 largar no mesmo sítio não pede confirmação', async () => { const f = fx(); await dragTo(sceneEl(f.a1.id), dropX('scene', f.a1.id, f.c1.id, 0)); ok(!topModal() && !snackEl()); eq(titles()[0][0], ['a1', 'b1', 'a2']); });
  await T('C07 arrastar Capítulo dentro do Tomo renumera', async () => { const f = fx();
    await dragTo(chHead(f.c2.id), dropX('chapter', f.c2.id, f.B1.id, 0)); ok(snackEl().textContent.includes('Capítulo «C2»')); await answer(true);
    eq(f.B1.chapters.map(c => c.name), ['C2', 'C1']); eq(chHead(f.c2.id).querySelector('.ch-num').textContent, '1'); eq(chHead(f.c1.id).querySelector('.ch-num').textContent, '2');
    eq(narrOrder().map(i => state.scenes[i].title), ['a3', 'a1', 'b1', 'a2', 'b2', 'a4']); });
  await T('C08 arrastar Capítulo para outro Tomo leva as Cenas', async () => { const f = fx();
    await dragTo(chHead(f.c1.id), dropX('chapter', f.c1.id, f.B2.id, 1)); await answer(true);
    eq(titles(), [[['a3']], [['b2', 'a4'], ['a1', 'b1', 'a2']]]); eq([...document.querySelectorAll('.ch-num')].map(x => x.textContent), ['1', '1', '2']); layoutInvariants(); });
  await T('C09 arrastar Tomo leva Capítulos e Cenas', async () => { const f = fx();
    const r = await longPress(bkHead(f.B2.id)); ok(drag && drag.keys.size === 4, 'o Tomo deve transportar Capítulos e Cenas');
    const cx = dropX('book', f.B2.id, null, 0); pe('pointermove', window, cx, r.top + 20); pe('pointerup', window, cx, r.top + 20); await W(30);
    ok(snackEl().textContent.includes('Tomo «Tomo 2» movido')); await answer(true);
    eq(state.books.map(b => b.name), ['Tomo 2', 'Tomo 1']); eq(narrOrder().map(i => state.scenes[i].title), ['b2', 'a4', 'a1', 'b1', 'a2', 'a3']);
    eq([...document.querySelectorAll('.book-kicker')].map(x => x.textContent), ['TOMO 1', 'TOMO 2']); });
  await T('C10 cancelar o arrasto de um Tomo repõe tudo', async () => { const f = fx(); await dragTo(bkHead(f.B2.id), dropX('book', f.B2.id, null, 0)); await answer(false); eq(state.books.map(b => b.name), ['Tomo 1', 'Tomo 2']); });
  await T('C11 menu de contexto numa Cena', async () => { const f = fx(); const r = sceneEl(f.a2.id).getBoundingClientRect(); ctx(sceneEl(f.a2.id), r.left + 5, r.top + 5);
    eq(menuLabels().slice(0, 2), ['Criar nova Cena aqui', 'Criar nova Cena num novo Ramo']); });
  await T('C12 «Criar nova Cena aqui» insere a seguir, no mesmo arc, e abre ficha em branco', async () => { const f = fx(); const r = sceneEl(f.a1.id).getBoundingClientRect();
    ctx(sceneEl(f.a1.id), r.left + 5, r.top + 5); await menuClick('Criar nova Cena aqui');
    const nid = f.c1.scenes[1]; const n = state.scenes[nid]; ok(n && n !== f.b1, 'não inseriu a seguir'); eq(n.arcId, f.A.id); eq([f.a1.chron, n.chron, f.a2.chron], [1, 2, 3]);
    const m = topModal(); ok(m && m.textContent.includes('Ficha da Cena')); eq(m.querySelector('input').value, ''); eq(m.querySelector('textarea').value, ''); });
  await T('C13 «Criar nova Cena num novo Ramo» pede nome e cria Ramo abaixo do arc', async () => { const f = fx(); const r = sceneEl(f.a2.id).getBoundingClientRect();
    ctx(sceneEl(f.a2.id), r.left + 5, r.top + 5); await menuClick('novo Ramo');
    const p = topModal(); ok(p && p.textContent.includes('Novo Ramo')); setInput(p.querySelector('input'), 'Desvio'); btn('OK', p).click(); await W(40);
    const br = state.arcs.find(a => a.name === 'Desvio'); ok(br, 'Ramo não criado'); eq(br.parentId, f.A.id); eq(br.forkSceneId, f.a2.id);
    eq(orderedArcs().map(l => l.arc.name), ['A', 'Desvio', 'B']); const n = state.scenes[f.c1.scenes[3]]; eq(n.arcId, br.id); ok(topModal().textContent.includes('Ficha da Cena'));
    ok(br.hue !== f.A.hue, 'Ramo deve ter cor própria'); layoutInvariants(); });
  await T('C14 cancelar o nome do Ramo não cria nada', async () => { const f = fx(); const r = sceneEl(f.a2.id).getBoundingClientRect(); ctx(sceneEl(f.a2.id), r.left + 5, r.top + 5); await menuClick('novo Ramo');
    btn('Cancelar').click(); await W(30); eq(state.arcs.length, 2); eq(Object.keys(state.scenes).length, 6); });
  await T('C15 espaço vazio: «Criar nova Cena» → criar novo Arco Narrativo', async () => { const ch = state.books[0].chapters[0]; const el = document.querySelector('.ch-body'); const r = el.getBoundingClientRect();
    ctx(el, r.left + 30, r.top + 40); eq(menuLabels(), ['Criar nova Cena']); await menuClick('Criar nova Cena');
    const m = topModal(); ok(m.textContent.includes('Escolher o Arco Narrativo') && m.textContent.includes('Criar um novo Arco Narrativo'));
    setInput(m.querySelector('input[placeholder^="Nome"]'), 'Primeiro'); btn('Criar', m).click(); await W(40);
    eq(state.arcs.map(a => a.name), ['Primeiro']); eq(ch.scenes.length, 1); ok(topModal().textContent.includes('Ficha da Cena')); });
  await T('C16 espaço vazio: escolher Arco Narrativo existente por pesquisa', async () => { const f = fx(); const el = document.querySelector(`.ch-body[data-chapter="${f.c2.id}"]`); const r = el.getBoundingClientRect();
    ctx(el, r.right - 10, r.top + B.TOP + 3 * B.LANE + 20); await menuClick('Criar nova Cena');
    await pickAC(topModal().querySelector('input'), 'B', 'B'); await W(30);
    eq(f.c2.scenes.length, 2); const n = state.scenes[f.c2.scenes[1]]; eq(n.arcId, f.Bq.id); eq([f.b1.chron, n.chron, f.b2.chron], [1, 2, 3]); });
  await T('C17 fechar a escolha do Arco Narrativo não cria Cena', async () => { const el = document.querySelector('.ch-body'); const r = el.getBoundingClientRect(); ctx(el, r.left + 30, r.top + 40); await menuClick('Criar nova Cena');
    topModal().querySelector('.icon-btn').click(); await W(30); eq(Object.keys(state.scenes).length, 0); eq(state.arcs.length, 0); });
  await T('C18 espaço entre Cenas (na faixa do arc) oferece as duas opções', async () => { const f = fx(); const el = document.querySelector(`.ch-body[data-chapter="${f.c2.id}"]`); const r = el.getBoundingClientRect();
    const by = $('#bodyLayer').getBoundingClientRect().top; ctx(el, r.right - 10, by + B.TOP + 0 * B.LANE + 40);
    ok(menuLabels()[0].startsWith('Criar nova Cena aqui') && menuLabels()[1] === 'Criar nova Cena num novo Ramo'); await menuClick('Criar nova Cena aqui');
    const n = state.scenes[f.c2.scenes[1]]; eq(n.arcId, f.A.id); eq([f.a3.chron, n.chron, f.a4.chron], [3, 4, 5]); });
  await T('C19 convergência: clique longo direito em Cena sem descendência', async () => { const f = fx();
    const r = await longPress(sceneEl(f.a4.id), 2); ok(linkDrag && linkDrag.from === f.a4.id, 'ligação não iniciada');
    const t = sceneEl(f.b1.id).getBoundingClientRect(); pe('pointermove', window, t.left + 30, t.top + 20, 2); eq(linkDrag.hover, f.b1.id); ok(sceneEl(f.b1.id).classList.contains('link-target'));
    ok(document.querySelector('#lines .arcline.temp') || true); pe('pointerup', window, t.left + 30, t.top + 20, 2); await W(30);
    ctx(sceneEl(f.b1.id), t.left + 30, t.top + 20); ok(!document.querySelector('.ctx-menu'), 'o menu de contexto não devia abrir após a ligação');
    ok(topModal().textContent.includes('convergência')); await answer(true); eq(f.a4.convergeTo, f.b1.id); ok(!isLeafScene(f.a4)); });
  await T('C20 convergência recusada: Cena com descendência, alvo no mesmo arc, cancelamento', async () => { const f = fx();
    await longPress(sceneEl(f.a1.id), 2); ok(!linkDrag, 'Cena com descendência não pode convergir'); ok(document.querySelector('.toast'), 'falta aviso'); pe('pointerup', window, 0, 0, 2); suppressCtx = false;
    await longPress(sceneEl(f.a4.id), 2); const t = sceneEl(f.a1.id).getBoundingClientRect(); pe('pointermove', window, t.left + 30, t.top + 20, 2); eq(linkDrag.hover, null);
    pe('pointerup', window, t.left + 30, t.top + 20, 2); await W(30); ok(!topModal()); await W(200);
    sceneEl(f.b2.id).scrollIntoView({inline:'center'}); await W(30); await longPress(sceneEl(f.a4.id), 2); const u = sceneEl(f.b2.id).getBoundingClientRect(); pe('pointermove', window, u.left + 30, u.top + 20, 2); pe('pointerup', window, u.left + 30, u.top + 20, 2); await W(30);
    await answer(false); eq(f.a4.convergeTo, null); });
  await T('C21 renomear Tomo e Capítulo no cabeçalho (Enter, Esc, vazio)', async () => { const b = state.books[0], c = b.chapters[0];
    bkHead(b.id).querySelector('.book-name').click(); let i = document.querySelector('.rename'); ok(i, 'campo de edição'); i.value = 'Livro Um'; i.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter'})); eq(b.name, 'Livro Um');
    chHead(c.id).querySelector('.ch-name').click(); i = document.querySelector('.rename'); i.value = 'Abertura'; i.dispatchEvent(new Event('blur')); eq(c.name, 'Abertura');
    chHead(c.id).querySelector('.ch-name').click(); i = document.querySelector('.rename'); i.value = 'zzz'; i.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'})); eq(c.name, 'Abertura');
    bkHead(b.id).querySelector('.book-name').click(); i = document.querySelector('.rename'); i.value = '   '; i.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter'})); eq(b.name, 'Livro Um');
    await W(10); eq(bkHead(b.id).querySelector('.book-name').textContent, 'Livro Um'); });
  await T('C22 botões «+»: novo Tomo e novo Capítulo', async () => { document.querySelector('.add-book').click(); eq(state.books.length, 2); eq(state.books[1].name, 'Tomo 2');
    bkHead(state.books[1].id).querySelector('[data-act="addch"]').click(); eq(state.books[1].chapters.length, 2); bkHead(state.books[0].id).querySelector('[data-act="ficha"]').click(); ok(topModal().textContent.includes('Ficha do Tomo')); });
  await T('C23 menus de contexto de Capítulo e Tomo; eliminar com confirmação', async () => { const f = fx();
    let r = chHead(f.c2.id).getBoundingClientRect(); ctx(chHead(f.c2.id), r.left + 5, r.top + 5); ok(menuLabels().includes('Eliminar Capítulo')); await menuClick('Eliminar Capítulo'); await answer(false); eq(f.B1.chapters.length, 2);
    ctx(chHead(f.c2.id), r.left + 5, r.top + 5); await menuClick('Eliminar Capítulo'); await answer(true); eq(f.B1.chapters.length, 1); ok(!state.scenes[f.a3.id]);
    r = bkHead(f.B2.id).getBoundingClientRect(); ctx(bkHead(f.B2.id), r.left + 5, r.top + 5); await menuClick('Eliminar Tomo'); await answer(true); eq(state.books.length, 1); eq(Object.keys(state.scenes).length, 3); layoutInvariants(); });
  await T('C24 faixa de Arco Narrativo abre a ficha; «+ Arco Narrativo» cria arc', async () => { const f = fx(); document.querySelector('.lane-label').click(); ok(topModal().textContent.includes('Ficha do Arco Narrativo')); closeAllModals();
    document.querySelector('.add-arc').click(); await W(20); setInput(topModal().querySelector('input'), 'Novo'); btn('OK').click(); await W(30); eq(state.arcs.length, 3); eq(document.querySelectorAll('.lane-label').length, 3); });

  await T('C25 Esc cancela um arrasto em curso sem popup nem alterações', async () => { const f = fx(); const el = sceneEl(f.a1.id); const r = await longPress(el); ok(drag);
    pe('pointermove', window, dropX('scene', f.a1.id, f.c3.id, 1), r.top + 20); document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'})); ok(!drag);
    pe('pointerup', window, 0, 0); sceneEl(f.a1.id).click(); await W(30); ok(!topModal(), 'não devia abrir popup'); eq(titles()[0][0], ['a1', 'b1', 'a2']); eq(L.order[0], f.a1.id);
    await W(10); sceneEl(f.a1.id).click(); ok(topModal(), 'cliques voltam a funcionar depois'); });
  await T('C26 Esc cancela uma ligação de convergência em curso', async () => { const f = fx(); await longPress(sceneEl(f.a4.id), 2); ok(linkDrag);
    document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'})); ok(!linkDrag); pe('pointerup', window, 0, 0, 2); await W(30); ok(!topModal()); eq(f.a4.convergeTo, null); });

  /* ================= D. FICHAS ================= */
  await T('D00 mudar o Arco Narrativo de uma Cena de bifurcação passa o Ramo para a Cena anterior', async () => { const f = fx(); const br = newArc('br', f.A.id, f.a2.id); insertScene(f.c2.id, 1, br.id);
    openSceneFicha(f.a2.id); setSelect(topModal().querySelectorAll('select')[0], f.Bq.id); eq(br.forkSceneId, f.a1.id); eq(arcView(br.id, 'chron').filter(x => x.inh).map(x => x.s.title), ['a1']); });
  await T('D01 ficha da Cena: título, resumo, POV, Personagens', async () => { const f = fx(); openSceneFicha(f.a1.id); let m = topModal();
    setInput(m.querySelector('input'), 'Novo título'); eq(f.a1.title, 'Novo título'); ok(sceneEl(f.a1.id).textContent.includes('Novo título'), 'quadro não atualizou');
    setInput(m.querySelector('textarea'), 'resumo'); eq(f.a1.summary, 'resumo');
    await pickAC(m.querySelector('input[placeholder^="Adicionar"]'), 'Marta', 'Criar «Marta»'); eq(state.characters.map(c => c.name), ['Marta']); eq(f.a1.chars.length, 1);
    m = topModal(); setSelect(m.querySelectorAll('select')[1], state.characters[0].id); eq(f.a1.pov, state.characters[0].id); ok(sceneEl(f.a1.id).textContent.includes('POV Marta'));
    m = topModal(); ok(m.textContent.includes('Ordem Narrativa: #1 de 6') && m.textContent.includes('Tomo «Tomo 1» › Capítulo 1'), 'posição narrativa');
    m.querySelector('.chip .chip-x').click(); eq(f.a1.chars, []); });
  await T('D02 ficha da Cena: mudar Arco Narrativo e posição cronológica partilhada', async () => { const f = fx(); openSceneFicha(f.a2.id);
    const num = topModal().querySelector('input[type="number"]'); num.value = '1'; num.dispatchEvent(new Event('change')); eq([f.a1.chron, f.a2.chron, f.a3.chron], [1, 1, 2]);
    setSelect(topModal().querySelectorAll('select')[0], f.Bq.id); eq(f.a2.arcId, f.Bq.id); eq(f.a2.chron, 3); eq([f.a1.chron, f.a3.chron, f.a4.chron], [1, 2, 3]); layoutInvariants();
    const opts = [...topModal().querySelectorAll('select')[0].options].map(o => o.value); ok(!opts.includes(''), 'o Arco Narrativo não pode ficar em branco'); });
  await T('D03 ficha da Cena: convergência visível e removível; eliminar Cena', async () => { const f = fx(); f.a4.convergeTo = f.b1.id; openSceneFicha(f.a4.id);
    ok(topModal().textContent.includes('Converge em')); btn('Remover convergência').click(); eq(f.a4.convergeTo, null);
    btn('Eliminar Cena').click(); await W(20); await answer(true); await W(20); ok(!state.scenes[f.a4.id]); ok(!topModal(), 'ficha devia fechar'); });
  await T('D04 ficha da Cena mostra posições herdadas noutros arcs', async () => { const f = fx(); const br = newArc('br', f.A.id, f.a2.id); insertScene(f.c2.id, 1, br.id); openSceneFicha(f.a1.id);
    ok(topModal().textContent.includes('no Arco Narrativo «br»: posição 1')); });
  await T('D05 ficha do Tomo: nome, narrador com ligação aos Materiais de Apoio', async () => { const f = fx(); openBookFicha(f.B1.id); let m = topModal();
    setInput(m.querySelector('input'), 'Renomeado'); eq(f.B1.name, 'Renomeado'); eq(bkHead(f.B1.id).querySelector('.book-name').textContent, 'Renomeado');
    ok(btn('Ver ficha').disabled, 'ligação devia estar inativa sem narrador'); eq(m.querySelector('select').options.length, NARRATORS.length + 1);
    setSelect(m.querySelector('select'), 'epistolar'); eq(f.B1.narrator, 'epistolar'); btn('Ver ficha').click(); ok(topModal().textContent.includes('Epistolar')); });
  await T('D06 ficha do Tomo: lista de Personagens, Mark as Main só neste Tomo, abre ficha', async () => { const f = fx(); const ana = newCharacter('Ana'); ana.gender = 'F'; ana.age = '30';
    f.a1.chars.push(ana.id); f.a4.chars.push(ana.id); f.b1.pov = ana.id; openBookFicha(f.B1.id); let rows = [...topModal().querySelectorAll('.list-row')];
    ok(rows[0].textContent.includes('Personagem Secundária') && rows[0].textContent.includes('Personagem POV') && rows[0].textContent.includes('F') && rows[0].textContent.includes('30 anos'));
    ok(tipFor(topModal().querySelector('.main-tog'))); topModal().querySelector('.main-tog').click(); eq(f.B1.mainChars, [ana.id]); eq(topModal().querySelector('.main-tog').getAttribute('aria-pressed'), 'true'); eq(f.B2.mainChars, []); ok(topModal().querySelector('.list-row').textContent.includes('Personagem Principal'));
    topModal().querySelector('.list-row .grow').click(); ok(topModal().textContent.includes('Ficha da Personagem')); eq(modals().length, 2); });
  await T('D07 ficha da Personagem: editar atributos reflete-se no Tomo', async () => { const f = fx(); const c = newCharacter('Rui'); f.a1.chars.push(c.id); openBookFicha(f.B1.id); openCharFicha(c.id); const m = topModal();
    setInput(m.querySelectorAll('input')[0], 'Rui Sá'); setSelect(m.querySelector('select'), 'M'); setInput(m.querySelectorAll('input')[1], '52'); eq([c.name, c.gender, c.age], ['Rui Sá', 'M', '52']);
    btn('Fechar', m).click(); await W(20); const row = topModal().querySelector('.list-row').textContent; ok(row.includes('Rui Sá') && row.includes('52 anos'), 'ficha do Tomo não atualizou'); });
  await T('D08 eliminar Personagem pela ficha', async () => { const f = fx(); const c = newCharacter('Rui'); f.a1.chars.push(c.id); openCharFicha(c.id); btn('Eliminar Personagem').click(); await W(20); await answer(true); eq(state.characters, []); eq(f.a1.chars, []); });
  await T('D09 ficha do Arco Narrativo: nome, alternância de ordem, Cenas herdadas noutro tom', async () => { const f = fx(); f.a1.chron = 9; normalizeChron(f.A.id); const br = newArc('br', f.A.id, f.a3.id); const s = insertScene(f.c3.id, 2, br.id); s.title = 'x';
    openArcFicha(f.A.id); let m = topModal(); setInput(m.querySelector('input'), 'Arco Principal'); eq(f.A.name, 'Arco Principal'); ok(document.querySelector('.lane-name').textContent.includes('Arco Principal'));
    const cards = () => [...topModal().querySelectorAll('.arc-card .t')].map(x => x.textContent); eq(cards(), ['a1', 'a2', 'a3', 'a4'], 'ordem narrativa');
    const chk = m.querySelector('.switch-wrap input'); chk.checked = true; chk.dispatchEvent(new Event('change')); eq(cards(), ['a2', 'a3', 'a4', 'a1'], 'ordem cronológica');
    closeAllModals(); openArcFicha(br.id); const inh = [...topModal().querySelectorAll('.arc-card.inh .t')].map(x => x.textContent); eq(inh, ['a2', 'a3']);
    const own = topModal().querySelector('.arc-card:not(.inh)'); ok(getComputedStyle(own).backgroundColor !== getComputedStyle(topModal().querySelector('.arc-card.inh')).backgroundColor, 'tom diferente');
    ok(topModal().textContent.includes('Ramo de')); });
  await T('D10 ficha do Arco Narrativo: reordenar cronologia por arrasto com confirmação', async () => { const f = fx(); openArcFicha(f.A.id); const m = topModal();
    const chk = m.querySelector('.switch-wrap input'); chk.checked = true; chk.dispatchEvent(new Event('change'));
    const drg = async (title, steps, yes) => { const card = [...topModal().querySelectorAll('.arc-card')].find(c => c.querySelector('.t').textContent === title); const r = card.getBoundingClientRect();
      pe('pointerdown', card, r.left + 20, r.top + 20); await W(430); ok(card.classList.contains('drag'), 'cartão não ficou em arrasto');
      pe('pointermove', window, r.left + 20 + steps * 162, r.top + 20); const others = [...topModal().querySelectorAll('.arc-card')].filter(c => c !== card && c.style.transform);
      ok(others.length === Math.abs(steps), 'vizinhos deviam afastar-se'); pe('pointerup', window, r.left + 20 + steps * 162, r.top + 20); await W(30); await answer(yes); await W(20); };
    const chron = t => Object.values(state.scenes).find(s => s.title === t).chron; // depois de «Anular», o estado é outro objeto
    await drg('a4', -3, false); eq(['a1', 'a2', 'a3', 'a4'].map(chron), [1, 2, 3, 4], 'Anular, na barra, repõe');
    closeAllModals(); openArcFicha(f.A.id); { const c2 = topModal().querySelector('.switch-wrap input'); c2.checked = true; c2.dispatchEvent(new Event('change')); }
    await drg('a4', -3, true); eq(['a4', 'a1', 'a2', 'a3'].map(chron), [1, 2, 3, 4], 'mover fica feito sem perguntar');
    eq(narrOrder().map(i => state.scenes[i].title), ['a1', 'b1', 'a2', 'a3', 'b2', 'a4'], 'a Ordem Narrativa não muda'); });
  await T('D11 no modo Ordem Narrativa o arrasto na ficha não está ativo', async () => { const f = fx(); openArcFicha(f.A.id); const card = topModal().querySelector('.arc-card'); const r = card.getBoundingClientRect();
    pe('pointerdown', card, r.left + 20, r.top + 20); await W(430); ok(!card.classList.contains('drag')); pe('pointerup', window, 0, 0); });
  await T('D12 eliminar Arco Narrativo só quando vazio', async () => { const f = fx(); openArcFicha(f.A.id); ok(btn('Eliminar Arco Narrativo').disabled); closeAllModals(); const e = newArc('vazio'); openArcFicha(e.id); ok(!btn('Eliminar Arco Narrativo').disabled); btn('Eliminar Arco Narrativo').click(); await W(20); ok(topModal().textContent.includes('Eliminar o Arco Narrativo «vazio»?'), 'pede confirmação'); await answer(false); eq(state.arcs.length, 3, 'cancelar não elimina'); btn('Eliminar Arco Narrativo').click(); await W(20); await answer(true); eq(state.arcs.length, 2); });
  for (const [kind, title, open] of [['scene', 'Cena', f => openSceneFicha(f.a1.id)], ['book', 'Tomo', f => openBookFicha(f.B1.id)], ['arc', 'Arco Narrativo', f => openArcFicha(f.A.id)], ['character', 'Personagem', f => openCharFicha(f.ch.id)]])
    await T('D13 Notas e Referências na ficha de ' + title, async () => { const f = fx(); f.ch = newCharacter('Zé'); const id = { scene:f.a1.id, book:f.B1.id, arc:f.A.id, character:f.ch.id }[kind];
      state.refs.push({ id:'rx', type:'link', title:'Fonte externa', url:'https://example.org', links:[], created:1 }); open(f); const base = modals().length;
      btn('Criar Nota').click(); await W(20); eq(state.refs.length, 2); const note = state.refs[1]; eq(note.links, [{kind, id}]); ok(topModal().textContent.includes('Nota'));
      setInput(topModal().querySelector('textarea'), 'apontamento'); eq(note.text, 'apontamento'); btn('Fechar').click(); await W(20); eq(modals().length, base); ok(topModal().textContent.includes('apontamento'), 'Nota devia aparecer na ficha');
      btn('Associar Referência').click(); await W(20); await pickAC(topModal().querySelector('input'), 'Fonte', 'Fonte externa'); await W(20);
      eq(refById('rx').links, [{kind, id}]); ok(topModal().textContent.includes('Fonte externa'), 'Referência devia aparecer na ficha');
      [...topModal().querySelectorAll('.list-row')].find(r => r.textContent.includes('Fonte externa')).querySelector('.chip-x').click(); eq(refById('rx').links, []); });

  /* ================= E. SEPARADORES ================= */
  await T('E01 Tomos: lista, filtros por Personagem e por Arco Narrativo, abrir ficha', async () => { const f = fx(); const c = newCharacter('Lia'); f.a4.chars.push(c.id); const solo = newArc('só no 2'); insertScene(f.c3.id, 0, solo.id);
    setTab('books'); eq(document.querySelectorAll('#view-page .card:not(.ch-card)').length, 2);
    await pickAC(document.querySelectorAll('#view-page .page-head input')[0], 'Li', 'Lia'); eq(filters.booksChar, c.id); eq([...document.querySelectorAll('#view-page .card:not(.ch-card) h3')].map(x => x.textContent), ['Tomo 2']);
    document.querySelector('#view-page .chip-x').click(); eq(document.querySelectorAll('#view-page .card:not(.ch-card)').length, 2);
    await pickAC(document.querySelectorAll('#view-page .page-head input')[1], 'só', 'só no 2'); eq([...document.querySelectorAll('#view-page .card:not(.ch-card) h3')].map(x => x.textContent), ['Tomo 2']);
    document.querySelector('#view-page .card:not(.ch-card)').click(); ok(topModal().textContent.includes('Ficha do Tomo')); });
  await T('E02 Personagens: filtros por Tomo e Main/Side', async () => { const f = fx(); const a = newCharacter('Ana'), b = newCharacter('Beto'), c = newCharacter('Caio'); f.a1.chars.push(a.id); f.a4.chars.push(b.id); f.B2.mainChars.push(b.id);
    setTab('characters'); const names = () => [...document.querySelectorAll('#view-page .card h3')].map(x => x.textContent); eq(names(), ['Ana', 'Beto', 'Caio']);
    setSelect(document.querySelector('#view-page select'), f.B1.id); eq(names(), ['Ana']); setSelect(document.querySelector('#view-page select'), '');
    btn('Personagens Principais', $('#view-page')).click(); eq(names(), ['Beto']); btn('Personagens Secundárias', $('#view-page')).click(); eq(names(), ['Ana', 'Caio']);
    btn('Todos', $('#view-page')).click(); btn('Nova Personagem', $('#view-page')).click(); eq(state.characters.length, 4); ok(topModal().textContent.includes('Ficha da Personagem')); });
  await T('E03 Arcos Narrativos: lista, filtro por Personagem, abrir ficha', async () => { const f = fx(); const c = newCharacter('Lia'); f.b1.pov = c.id; setTab('arcs'); eq(document.querySelectorAll('#view-page .card').length, 2);
    await pickAC(document.querySelector('#view-page .page-head input'), 'Lia', 'Lia'); eq([...document.querySelectorAll('#view-page .card h3')].map(x => x.textContent), ['B']);
    document.querySelector('#view-page .card').click(); ok(topModal().textContent.includes('Ficha do Arco Narrativo')); });
  await T('E04 Referências: Nota, Link, ficheiros (guardados localmente), filtro por tipo, eliminar', async () => { setTab('refs');
    ok(tipFor($('#view-page .ref-new')), 'um só «+ Novo»'); $('#view-page .ref-new').click(); await W(20); eq(menuLabels(), ['Nota', 'Ficheiro ou Link…']); ok([...document.querySelectorAll('.ctx-item')].every(x => tipFor(x))); await menuClick('Nota'); eq(state.refs[0].type, 'note'); closeAllModals();
    $('#view-page .ref-new').click(); await W(20); await menuClick('Ficheiro ou Link'); let m = topModal(); ok(m.querySelector('.dropzone') && m.querySelector('input[type="file"]'));
    setInput(m.querySelector('input[placeholder^="https"]'), 'https://example.org/a'); btn('Adicionar Link', m).click(); await W(20); eq(state.refs[1].type, 'link');
    await addFilesAsRefs([new File(['olá'], 'texto.txt', {type:'text/plain'}), new File([new Uint8Array(2000)], 'som.mp3', {type:'audio/mpeg'}), new File([new Uint8Array(10)], 'filme.mp4', {type:'video/mp4'})], null);
    eq(state.refs.map(r => r.type), ['note', 'link', 'document', 'audio', 'video']); const blob = await idb.get(state.refs[2].id); eq(await blob.text(), 'olá');
    for (const [k, n] of [['Documents', 1], ['Links', 1], ['Audio', 1], ['Video', 1], ['Notas', 1], ['Todas', 5]]){ btn(k, $('#view-page .seg')).click(); eq(document.querySelectorAll('#view-page .card').length, n, 'filtro ' + k); }
    const doc = state.refs[2]; openRefFicha(doc.id); await W(150); ok(btn('Descarregar'), 'ligação de descarregar'); btn('Eliminar').click(); await W(20); await answer(true); await W(50); eq(state.refs.length, 4); ok(await idb.get(doc.id), 'o ficheiro fica guardado para se poder anular'); await purgeOrphanFiles(); eq(await idb.get(doc.id), undefined, 'ficheiro removido do disco local no arranque seguinte'); ok(await idb.get(state.refs.find(r => r.fileName).id), 'ficheiros em uso não são removidos');
    openRefFicha(state.refs.find(r => r.type === 'audio').id); await W(150); ok(topModal().querySelector('audio'), 'leitor de áudio'); });
  await T('E05 Referências: arrastar ficheiro do ambiente de trabalho para a caixa', async () => { newRefDialog(null); const back = topModal().parentElement; const dt = new DataTransfer(); dt.items.add(new File(['x'], 'solto.pdf', {type:'application/pdf'}));
    back.dispatchEvent(new DragEvent('dragover', {bubbles:true, cancelable:true, dataTransfer:dt})); ok(document.querySelector('.dropzone.over'), 'realce da zona');
    back.dispatchEvent(new DragEvent('drop', {bubbles:true, cancelable:true, dataTransfer:dt})); await W(150); eq(state.refs.map(r => r.fileName), ['solto.pdf']); ok(!topModal(), 'caixa devia fechar'); });
  await T('E06 Referência: associar a entidades a partir da ficha', async () => { const f = fx(); const r = { id:'r1', type:'note', title:'N', text:'', links:[], created:1 }; state.refs.push(r); openRefFicha('r1');
    await pickAC(topModal().querySelector('input[placeholder^="Associar"]'), 'a3', 'Cena: a3'); eq(r.links, [{kind:'scene', id:f.a3.id}]); topModal().querySelector('.chip .chip-x').click(); eq(r.links, []); });
  await T('E07 Materiais de Apoio: onze secções, fichas de narrador', async () => { filters.supSec = 'narrador'; filters.supQ = ''; setTab('support');
    eq(SUPPORT.map(x => x.key), ['narrador', 'figuras', 'estilo', 'estilos-narrativos', 'recursos', 'tecnicas', 'metodos', 'ortografia', 'pontuacao', 'sintaxe', 'escrita-antiga']); eq(document.querySelectorAll('.sup-nav button').length, SUPPORT.length);
    eq(document.querySelectorAll('#view-page .card').length, SUPPORT[0].groups.reduce((n, g) => n + g.items.length, 0)); ok(SUPPORT[0].groups[0].items.length === NARRATORS.length);
    document.querySelector('#view-page .card').click(); ok(topModal().textContent.includes('Pontos fortes')); });
  await T('E07b Materiais de Apoio: conteúdo completo e ligações válidas', async () => { const seen = new Set(); let total = 0;
    for (const sec of SUPPORT){ ok(sec.intro && sec.groups.length >= 2, 'secção incompleta: ' + sec.key);
      for (const g of sec.groups) for (const it of g.items){ total++; ok(!seen.has(it.n), 'nome repetido: ' + it.n); seen.add(it.n);
        ok(it.d && it.x && it.x.length, 'ficha sem descrição ou exemplos: ' + it.n); ok(it.u || it.f, 'ficha sem «como usar»: ' + it.n); } }
    ok(total >= 180, 'esperava pelo menos 180 fichas, há ' + total); eq(supportIndex.size, total);
    for (const {it} of supportIndex.values()) for (const r of it.s || []){ ok(supportIndex.has(r), 'ligação partida: ' + it.n + ' → ' + r); ok(r !== it.n, 'ligação a si própria: ' + it.n); }
    for (const sec of SUPPORT){ ok(sec.groups.reduce((n, g) => n + g.items.length, 0) >= 20, 'secção curta: ' + sec.key); } });
  await T('E07c Materiais de Apoio: navegação, pesquisa e «ver também»', async () => { filters.supSec = 'narrador'; filters.supQ = ''; setTab('support');
    const navBtn = k => document.querySelector('.sup-nav button[data-sec="' + k + '"]'); navBtn('figuras').click();
    ok(navBtn('figuras').classList.contains('on')); eq(document.querySelectorAll('#view-page .card').length, SUPPORT[1].groups.reduce((n, g) => n + g.items.length, 0));
    ok(document.querySelector('#view-page').textContent.includes('Figuras de som'));
    const inp = document.querySelector('.sup-search'); setInput(inp, 'metafora'); 
    const first = document.querySelector('#view-page .card h3'); eq(first.textContent, 'Metáfora'); ok(!document.querySelector('.sup-nav button.on'), 'com pesquisa, nenhuma secção fica ativa');
    setInput(inp, 'flashback'); eq(document.querySelector('#view-page .card h3').textContent, 'Analepse (Flashback)');
    setInput(inp, 'zzzqqq'); eq(document.querySelectorAll('#view-page .card').length, 0); ok(document.querySelector('#view-page').textContent.includes('Nada encontrado'));
    setInput(inp, 'camoes'); ok(document.querySelectorAll('#view-page .card').length >= 8, 'a pesquisa devia procurar também nos exemplos');
    navBtn('recursos').click(); eq(inp.value, ''); eq(filters.supQ, '');
    openSupportFicha('Analepse'); let m = topModal(); ok(m.textContent.includes('Na ferramenta') && m.textContent.includes('Ver também') && m.textContent.includes('Flashback'));
    const chip = [...m.querySelectorAll('.chip.click')].find(c => c.textContent === 'Prolepse'); chip.click(); await W(30);
    eq(document.querySelectorAll('.modal').length, 1, 'a ficha anterior devia fechar'); ok(topModal().querySelector('h2').textContent === 'Prolepse (Flash-forward)'); topModal().querySelector('.modal-head .modal-x').click(); await W(20);
    openNarratorFicha('intruso'); eq(topModal().querySelector('h2').textContent, 'Narrador intruso (comentador)'); topModal().querySelector('.modal-head .modal-x').click(); await W(20); });
  await T('E08 Definições: nome do projeto e paletas', async () => { setTab('settings'); setInput(document.querySelector('#view-page input'), 'O Meu Romance'); eq(state.project.name, 'O Meu Romance'); eq($('#projName').textContent, 'O Meu Romance');
    const n0 = document.querySelectorAll('.pal').length; ok(n0 >= 8); document.querySelectorAll('.pal')[1].click(); eq(state.project.palette.mode, 'light'); eq(document.documentElement.style.getPropertyValue('--surface'), '#ffffff');
    ok(document.querySelectorAll('.pal')[1].classList.contains('on')); btn('Gerar novas paletas', $('#view-page')).click(); eq(document.querySelectorAll('.pal').length, n0 + 6);
    document.querySelectorAll('.pal')[0].click(); eq(state.project.palette.mode, 'dark'); });
  await T('E09 Exportar e Importar: ida e volta com ficheiros', async () => { const f = fx(); await addFilesAsRefs([new File(['conteúdo'], 'anexo.txt', {type:'text/plain'})], {kind:'book', id:f.B1.id}); state.project.name = 'Exportável';
    const snap = JSON.stringify(state); let blob = null; const oc = URL.createObjectURL, ac = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = b => { blob = b; return 'blob:qa'; }; HTMLAnchorElement.prototype.click = function(){};
    try { await exportProject(); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ac; }
    ok(blob, 'nada exportado'); const text = await blob.text(); const fileId = state.refs[0].id;
    state = blankProject(); await idb.clear(); renderAll();
    const p = importProject(new File([text], 'p.narrativa.json')); await W(60); await answer(true); await p;
    eq(JSON.stringify(state), snap, 'estado importado'); eq(await (await idb.get(fileId)).text(), 'conteúdo', 'ficheiro importado'); eq($('#projName').textContent, 'Exportável'); });
  await T('E10 Importar ficheiro inválido é recusado sem alterar o projeto', async () => { const f = fx(); const snap = JSON.stringify(state); await importProject(new File(['{"x":1}'], 'mau.json')); await importProject(new File(['não é json'], 'mau2.json'));
    eq(JSON.stringify(state), snap); ok(document.querySelector('.toast')); });
  await T('E11 Novo Projeto cria outro projeto sem fechar o atual', async () => { const f = fx(); commit(); flushSave(); const first = projActive(); setTab('settings');
    btn('Novo Projeto', $('#view-page')).click(); await W(30); eq(modals().length, 0); ok(projActive() !== first); eq(Object.keys(state.scenes).length, 0); eq(Projects.idx.open.length, 2);
    projSwitch(first); eq(state.scenes[f.a1.id].title, 'a1', 'o primeiro continua como estava'); });
  await T('E12 Esc e clique fora fecham o popup do topo', async () => { const f = fx(); openBookFicha(f.B1.id); openSceneFicha(f.a1.id); document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'})); eq(modals().length, 1);
    const back = topModal().parentElement; const clickBack = () => { back.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true})); back.dispatchEvent(new MouseEvent('click', {bubbles:true})); };
    clickBack(); eq(modals().length, 1, 'o 2.º clique de um duplo clique não deve fechar a ficha acabada de abrir'); await W(380); clickBack(); eq(modals().length, 0); });

  await T('E13 filtros que apontam para algo eliminado são limpos', async () => { const f = fx(); const c = newCharacter('Lia'); f.a1.chars.push(c.id); filters.booksChar = c.id; filters.arcsChar = c.id; filters.charsBook = f.B2.id;
    deleteCharacter(c.id); deleteBook(f.B2.id); newCharacter('Outro'); setTab('books'); eq(document.querySelectorAll('#view-page .card:not(.ch-card)').length, 1); setTab('arcs'); eq(document.querySelectorAll('#view-page .card').length, 2);
    setTab('characters'); eq(document.querySelectorAll('#view-page .card').length, 1); });

  /* ================= F. VISITA GUIADA ================= */
  await T('F01 visita: todos os passos têm alvo, nada é guardado, estado reposto', async () => { const f = fx(); flushSave(); const before = localStorage.getItem(LS_KEY); const real = state;
    startTour(); ok(tourMode && !$('#tourBlock').hidden); ok(state !== real && state.books[0].name === 'A Maré Baixa', 'devia usar dados de demonstração');
    const missing = [];
    for (let i = 0; i < Tour.steps.length; i++){ Tour.i = i; showTourStep(); await W(40); const s = Tour.steps[i]; if (s.sel && !document.querySelector(s.sel)) missing.push(i + ':' + s.sel);
      ok($('#tourPop').textContent.includes(s.title)); ok(!$('#tourPop').textContent.includes('null') && !$('#tourPop').textContent.includes('undefined')); }
    eq(missing, [], 'passos sem alvo'); state.books[0].name = 'MEXIDO'; commit(); flushSave(); eq(localStorage.getItem(LS_KEY), before, 'a visita não pode gravar');
    btn('Concluir', $('#tourPop')).click(); await W(30); ok(!tourMode && $('#tourBlock').hidden); ok(state === real, 'estado real reposto'); eq(localStorage.getItem(LS_KEY), before); eq(modals().length, 0); eq(titles()[0][0], ['a1', 'b1', 'a2']); });
  await T('F02 visita: interromper a meio com Esc e com «Terminar visita»; navegação', async () => { const real = state; startTour(); btn('Seguinte', $('#tourPop')).click(); btn('Seguinte', $('#tourPop')).click(); eq(Tour.i, 2); btn('Anterior', $('#tourPop')).click(); eq(Tour.i, 1);
    document.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowRight'})); eq(Tour.i, 2); document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'})); ok(!Tour.active && state === real);
    startTour(); Tour.i = Tour.steps.findIndex(s => s.title === 'Ficha da Cena'); showTourStep(); await W(30); eq(modals().length, 1); btn('Terminar visita', $('#tourPop')).click(); ok(!Tour.active && state === real); eq(modals().length, 0); });
  await T('F03 visita: a simulação de arrasto mexe só na pré-visualização e reverte', async () => { startTour(); Tour.i = Tour.steps.findIndex(s => s.title === 'Mover Cenas'); showTourStep(); const demo = JSON.stringify(state);
    await W(1100); ok(L.order.indexOf('s3') === 4,'pré-visualização da Cena movida: ' + L.order.join()); eq(JSON.stringify(state), demo, 'dados intactos durante a simulação');
    await W(2700); ok(L.order.indexOf('s3') === 3, 'revertida'); endTour(); });
  await T('F04 visita: simulação de convergência não cria ligação', async () => { startTour(); Tour.i = Tour.steps.findIndex(s => s.title === 'Convergências'); showTourStep(); await W(1500); ok(linkDrag && linkDrag.fake); await W(2400); ok(!linkDrag); eq(state.scenes.s7.convergeTo, null); endTour(); });
  await T('F05 visita: cliques no quadro são ignorados durante a visita', async () => { startTour(); const el = sceneEl('s1'); el.click(); eq(modals().length, 0); await longPress(el); ok(!drag); pe('pointerup', window, 0, 0); endTour(); });

  /* ================= G. ROBUSTEZ ================= */
  await T('G01 texto do utilizador nunca é interpretado como HTML', async () => { const f = fx(); const evil = '<img src=x onerror="window.__xss=1"><b>x</b>'; f.a1.title = evil; f.A.name = evil; f.B1.name = evil; f.c1.name = evil; const c = newCharacter(evil); f.a1.chars.push(c.id); f.a1.pov = c.id;
    state.refs.push({id:'re', type:'note', title:evil, text:evil, links:[{kind:'scene', id:f.a1.id}], created:1}); state.project.name = evil;
    renderAll(); openSceneFicha(f.a1.id); openBookFicha(f.B1.id); openArcFicha(f.A.id); openCharFicha(c.id); openRefFicha('re');
    for (const t of ['books', 'characters', 'arcs', 'refs', 'settings', 'board']) setTab(t); await W(80);
    eq(document.querySelectorAll('#board img, #view-page img, .modal img, #topbar img').length, 0);
    eq([...document.querySelectorAll('b')].filter(b => b.textContent === 'x').length, 0); ok(!window.__xss, 'script injetado executou'); });
  await T('G02 nomes muito longos não rebentam o layout', async () => { const f = fx(); const top0 = $('#topbar').getBoundingClientRect().height; const long = 'Palavra '.repeat(60); state.project.name = long; f.a1.title = long; f.c1.name = long; f.B1.name = long; f.A.name = long; renderAll(); settle();
    const el = sceneEl(f.a1.id).getBoundingClientRect(); eq([Math.round(el.width), Math.round(el.height)], [B.SW, B.SH]); const hd = chHead(f.c1.id).getBoundingClientRect(); eq(Math.round(hd.height), B.HEAD_CH);
    const lab = document.querySelector('.lane-label').getBoundingClientRect(); eq(Math.round(lab.height), B.LANE); eq($('#topbar').getBoundingClientRect().height, top0, 'altura do topo'); });
  await T('G03 carga: 8 Tomos × 5 Capítulos × 6 Cenas, 8 Arcos Narrativos', async () => { state.books = []; const arcs = []; for (let i = 0; i < 8; i++) arcs.push(newArc('Arc ' + i, i > 5 ? arcs[0].id : null));
    for (let b = 0; b < 8; b++){ const bk = { id:uid('b'), name:'Tomo ' + (b + 1), narrator:'', mainChars:[], chapters:[] }; state.books.push(bk);
      for (let c = 0; c < 5; c++){ const ch = { id:uid('c'), name:'Ch', scenes:[] }; bk.chapters.push(ch); for (let s = 0; s < 6; s++){ const id = uid('s'); state.scenes[id] = { id, title:'S' + s, summary:'', arcId:arcs[(b + c + s) % 8].id, chron:b * 100 + c * 10 + s, pov:null, chars:[], convergeTo:null }; ch.scenes.push(id); } } }
    arcs.forEach(a => normalizeChron(a.id)); let t0 = performance.now(); renderAll(); perf.render240 = Math.round(performance.now() - t0); settle(); layoutInvariants(); eq(document.querySelectorAll('.scene').length, 240);
    const sid = state.books[0].chapters[0].scenes[0]; $('#board-scroll').scrollLeft = 0; await longPress(sceneEl(sid)); ok(drag); t0 = performance.now();
    for (let i = 0; i < 20; i++) pe('pointermove', window, 300 + i * 40, 200); perf.dragMove20 = Math.round(performance.now() - t0); t0 = performance.now(); tick(); perf.frame = Math.round(performance.now() - t0);
    pe('pointerup', window, 300, 200); await W(30); if (topModal()) await answer(false); t0 = performance.now(); flushSave(); perf.save = Math.round(performance.now() - t0);
    ok(perf.render240 < 800, 'render lento: ' + perf.render240 + 'ms'); ok(perf.dragMove20 < 400, 'arrasto lento: ' + perf.dragMove20 + 'ms'); ok(perf.frame < 50, 'frame lento: ' + perf.frame + 'ms'); });
  await T('G04 quadro com scroll horizontal e vertical quando o conteúdo excede', async () => { for (let i = 0; i < 12; i++) newArc('A' + i); for (let i = 0; i < 10; i++) state.books.push({ id:uid('b'), name:'B' + i, narrator:'', mainChars:[], chapters:[] }); renderAll();
    const sc = $('#board-scroll'); ok(sc.scrollWidth > sc.clientWidth, 'sem scroll horizontal'); ok(sc.scrollHeight > sc.clientHeight, 'sem scroll vertical');
    sc.scrollLeft = 500; sc.scrollTop = 200; const g = $('#gutter').getBoundingClientRect(), hl = $('#headLayer').getBoundingClientRect(), s = sc.getBoundingClientRect();
    ok(Math.abs(g.left - s.left) < 2, 'faixa dos arcs devia ficar fixa à esquerda'); ok(Math.abs(hl.top - s.top) < 2, 'cabeçalhos deviam ficar fixos no topo'); });
  await T('G05 estado guardado corrompido não impede o arranque', () => { localStorage.setItem(LS_KEY, '{corrompido'); const s = loadState(); ok(s.books.length === 1); localStorage.removeItem(LS_KEY); });

  /* ================= H. ANULAR / REFAZER ================= */
  const key = (k, o, el) => (el || document.body).dispatchEvent(new KeyboardEvent('keydown', Object.assign({key:k, bubbles:true, cancelable:true}, o)));
  await T('H01 anular e refazer uma alteração do quadro', () => { const f = fx(); histInit(); addChapter(f.B1.id); eq(state.books[0].chapters.length, 3); undo(); eq(state.books[0].chapters.length, 2); redo(); eq(state.books[0].chapters.length, 3); });
  await T('H02 anular repõe Cena eliminada com convergências, bifurcações e referências', () => { const f = fx(); f.b2.convergeTo = f.a3.id; newArc('br', f.A.id, f.a3.id); state.refs.push({id:'rx', type:'note', title:'n', text:'', links:[{kind:'scene', id:f.a3.id}], created:1});
    commit(); histInit(); const before = JSON.stringify(state); deleteScene(f.a3.id); commit(); ok(!state.scenes[f.a3.id]); undo(); eq(JSON.stringify(state), before); eq(document.querySelectorAll('.scene').length, 6); });
  await T('H03 escrita contínua conta como um único passo', () => { histInit(); const n0 = state.project.name; for (const n of ['a', 'ab', 'abc']){ state.project.name = n; save(); } eq(Hist.undo.length, 1); undo(); eq(state.project.name, n0); redo(); eq(state.project.name, 'abc'); });
  await T('H04 alterações discretas seguidas são passos separados', () => { const f = fx(); histInit(); addChapter(f.B1.id); addChapter(f.B1.id); eq(Hist.undo.length, 2); undo(); eq(state.books[0].chapters.length, 3); undo(); eq(state.books[0].chapters.length, 2); });
  await T('H05 nova alteração depois de anular limpa o refazer', () => { const f = fx(); histInit(); addChapter(f.B1.id); undo(); ok(Hist.redo.length === 1); addBook(); eq(Hist.redo.length, 0); redo(); eq(state.books.length, 3); });
  await T('H06 o estado anulado fica guardado', () => { const f = fx(); commit(); histInit(); addBook(); undo(); eq(JSON.parse(localStorage.getItem(LS_KEY)).books.length, 2); });
  await T('H07 arrastar uma Cena e anular repõe a Ordem Narrativa', async () => { const f = fx(); histInit(); const t0 = titles(); const r = sceneEl(f.a4.id).getBoundingClientRect(); await dragTo(sceneEl(f.a1.id), r.right + 30); await answer(true); ok(JSON.stringify(titles()) !== JSON.stringify(t0), 'o arrasto não mudou nada'); undo(); eq(titles(), t0); });
  await T('H08 atalhos: Ctrl+Z, Ctrl+Shift+Z e Ctrl+Y; ignorados dentro de campos de texto', () => { const f = fx(); histInit(); addChapter(f.B1.id); key('z', {ctrlKey:true}); eq(state.books[0].chapters.length, 2); key('z', {ctrlKey:true, shiftKey:true}); eq(state.books[0].chapters.length, 3);
    key('z', {ctrlKey:true}); key('y', {ctrlKey:true}); eq(state.books[0].chapters.length, 3); openBookFicha(f.B1.id); key('z', {ctrlKey:true}, document.querySelector('.modal input')); eq(state.books[0].chapters.length, 3); });
  await T('H09 botões refletem o histórico e anular fecha as fichas', () => { const f = fx(); histInit(); ok($('#undoBtn').disabled && $('#redoBtn').disabled); addChapter(f.B1.id); ok(!$('#undoBtn').disabled && $('#redoBtn').disabled);
    openSceneFicha(f.a1.id); $('#undoBtn').click(); eq(modals().length, 0); ok($('#undoBtn').disabled && !$('#redoBtn').disabled); });
  await T('H10 a visita não regista nem permite anular', () => { const f = fx(); histInit(); addChapter(f.B1.id); startTour(); ok($('#undoBtn').disabled); undo(); eq(Hist.undo.length, 1); endTour(); eq(state.books[0].chapters.length, 3); undo(); eq(state.books[0].chapters.length, 2); });
  await T('H11 anular a eliminação de uma Referência com ficheiro mantém o ficheiro', async () => { await addFilesAsRefs([new File(['abc'], 'doc.txt', {type:'text/plain'})], null); const r = state.refs[0]; histInit();
    openRefFicha(r.id); [...document.querySelectorAll('.modal .btn.danger')].pop().click(); await W(20); await answer(true); eq(state.refs.length, 0); undo(); eq(state.refs.length, 1); const b = await idb.get(r.id); ok(b && b.size === 3, 'ficheiro perdido'); });
  await T('H12 paleta: anular repõe as cores', () => { histInit(); const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg'); state.project.palette = {h:40, mode:'light'}; applyPalette(); commit(); undo(); eq(getComputedStyle(document.documentElement).getPropertyValue('--bg'), bg); });

  /* ================= I. EXPLICADORES E LOGOTIPO ================= */
  const hover = el => el.dispatchEvent(new MouseEvent('mouseover', {bubbles:true, clientX:200, clientY:200}));
  const tipOn = () => { const t = $('#tip'); return t && t.classList.contains('on') ? t.textContent : null; };
  await T('I01 explicador aparece ao parar sobre uma Cena e desaparece ao clicar', async () => { const f = fx(); await W(80); hover(sceneEl(f.a1.id)); ok(!tipOn(), 'apareceu sem atraso'); await W(Tips.DELAY + 80); ok(/a1/.test(tipOn()) && /abrir a ficha/.test(tipOn()) && /Por escrever/.test(tipOn()), 'o explicador mostra o título, o estado e como abrir: ' + tipOn()); pe('pointerdown', document.body, 5, 5); pe('pointerup', window, 5, 5); ok(!tipOn()); });
  await T('I02 explicadores desligados nas Definições não aparecem', async () => { const f = fx(); setTab('settings'); const chk = [...document.querySelectorAll('#view-page .switch-wrap')].find(x => x.textContent.includes('Mostrar explicadores')).querySelector('input'); ok(chk.checked); chk.click(); ok(!Tips.on); setTab('board'); hover(sceneEl(f.a1.id)); await W(Tips.DELAY + 80); ok(!tipOn()); setTipsOn(true); });
  await T('I03 sem explicadores durante a visita nem durante um arrasto', async () => { const f = fx(); startTour(); hover(sceneEl('s1')); await W(Tips.DELAY + 80); ok(!tipOn()); endTour(); await longPress(sceneEl(f.a1.id)); ok(drag); hover(sceneEl(f.a2.id)); await W(Tips.DELAY + 80); ok(!tipOn()); key('Escape'); pe('pointerup', window, 0, 0); });
  await T('I04 todos os controlos têm explicador (quadro, separadores, fichas, menus)', async () => { const f = fx(); const c = newCharacter('X'); f.a1.chars.push(c.id); f.a1.pov = c.id; f.B1.mainChars.push(c.id); f.b2.convergeTo = f.a3.id; newArc('br', f.A.id, f.a2.id);
    state.refs.push({id:'rn', type:'note', title:'n', text:'', links:[{kind:'scene', id:f.a1.id}], created:1}, {id:'rl', type:'link', title:'l', url:'https://x', links:[{kind:'scene', id:f.a1.id}], created:2}); filters.booksChar = c.id; const scn = newScenery('Lugar'); scn.chars.push(c.id); f.a1.sceneries.push(scn.id); renderAll();
    const skip = /^(Fechar|Cancelar|Confirmar|OK|Criar|Eliminar)$/; const miss = [];
    const scan = where => document.querySelectorAll('#topbar button, #rail button, #board button, #board .scene, #board .ch-head, #board .book-head, #board .lane-label, #view-page button, #view-page .card:not(.static), #view-page .page-head input, #view-page .page-head select, .modal button, .modal a.btn, .modal .chip, .modal .arc-card, .modal .switch-wrap, .modal .dropzone, .modal .sec-title, .modal .field > label, .ctx-item')
      .forEach(el => { if (!tipFor(el) && !skip.test(el.textContent.trim())) miss.push(where + ': ' + (el.textContent.trim().slice(0, 30) || el.className)); });
    scan('quadro'); for (const t of ['books', 'arcs', 'characters', 'sceneries', 'refs', 'plan', 'support', 'settings']){ setTab(t); scan(t); } setTab('board'); settle();
    for (const open of [() => openSceneFicha(f.b2.id), () => openSceneFicha(f.a1.id), () => openBookFicha(f.B1.id), () => openCharFicha(c.id), () => openArcFicha(f.A.id), () => openRefFicha('rl'), () => newRefDialog(null), () => openSceneryFicha(scn.id), () => { openSceneryFicha(scn.id); btn('Associar Personagem').click(); }, () => { openCharFicha(c.id); btn('Associar Localização').click(); }]){ open(); scan('ficha ' + topModal().querySelector('.modal-title').textContent); closeAllModals(); }
    for (const el of [sceneEl(f.a1.id), chHead(f.c1.id), bkHead(f.B1.id)]){ const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('contextmenu', {bubbles:true, cancelable:true, clientX:r.left + 5, clientY:r.top + 5})); scan('menu'); closeMenu(); }
    $('#createBtn').click(); scan('Criar'); closeMenu(); $('#tourBtn').click(); scan('ajuda'); closeMenu();
    eq(miss, []); });
  await T('I05 dicas nativas (title) passam para o balão próprio', () => { fx(); const el = h('span', {title:'Olá'}); document.body.append(el); const t = tipFor(el); eq(t.text, 'Olá'); ok(!el.hasAttribute('title')); el.remove(); });
  await T('I06 logotipo no topo e como ícone da página', async () => { ok(document.querySelector('#topbar svg.logo')); const l = document.querySelector('link[rel="icon"]'); ok(l && /logo\.svg$/.test(l.href)); const r = await fetch(l.href); ok(r.ok && /<svg/.test(await r.text())); });

  /* ================= K. CRUZAMENTO DE DADOS E REGRESSÕES DA REVISÃO ================= */
  const ctxAt = (el, dx = 5, dy = 5) => { const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('contextmenu', {bubbles:true, cancelable:true, clientX:r.left + dx, clientY:r.top + dy})); };
  await T('K01 a convergência acompanha o fim do Arco Narrativo quando se cria uma Cena depois', () => { const f = fx(); f.b2.convergeTo = f.a3.id; commit(); eq(f.b2.convergeTo, f.a3.id);
    const n = insertScene(f.c3.id, 2, f.Bq.id); commit(); eq([f.b2.convergeTo, n.convergeTo], [null, f.a3.id]); eq(arcView(f.Bq.id, 'chron').filter(v => v.inh === 'post').length > 0, true); });
  await T('K02 convergência para o próprio Arco Narrativo é removida quando a Cena de destino muda de arc', async () => { const f = fx(); f.b2.convergeTo = f.a3.id; commit(); openSceneFicha(f.a3.id);
    const sel = topModal().querySelector('select'); sel.value = f.Bq.id; sel.dispatchEvent(new Event('change', {bubbles:true})); eq(f.a3.arcId, f.Bq.id); eq(Object.values(state.scenes).filter(x => x.convergeTo).length, 0); });
  await T('K03 quadro e ficha do Arco Narrativo mostram a mesma convergência', () => { const f = fx(); f.b1.convergeTo = f.a2.id; commit(); eq(f.b1.convergeTo, null, 'só a última Cena do arc converge'); eq(f.b2.convergeTo, f.a2.id);
    eq(arcView(f.Bq.id, 'chron').filter(v => v.inh === 'post').map(v => v.s.title), ['a2', 'a3', 'a4']); eq(document.querySelectorAll('#lines circle[stroke="#fff"]').length, 1); });
  await T('K04 Main/Side no separador Personagens: só conta onde a Personagem figura, e respeita o filtro de Tomo', () => { const f = fx(); const x = newCharacter('X'), y = newCharacter('Y'); f.a1.chars.push(x.id); f.b2.chars.push(x.id, y.id); f.B1.mainChars.push(x.id, y.id); commit();
    ok(isMain(x.id) && !isMain(y.id), 'Y está marcado num Tomo onde não figura'); ok(isMain(x.id, f.B1.id) && !isMain(x.id, f.B2.id));
    filters.charsRole = 'main'; setTab('characters'); eq([...document.querySelectorAll('#view-page .card h3')].map(e => e.textContent), ['X']);
    filters.charsBook = f.B2.id; renderAll(); eq(document.querySelectorAll('#view-page .card').length, 0); filters.charsRole = 'side'; renderAll(); eq([...document.querySelectorAll('#view-page .card h3')].map(e => e.textContent), ['X', 'Y']); });
  await T('K05 Personagem percorre Cena → Tomo → separadores → eliminar', async () => { const f = fx(); openSceneFicha(f.a1.id); const inp = topModal().querySelector('input[placeholder^="Adicionar Personagem"]'); setInput(inp, 'Inês'); inp.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true})); await W(30);
    const c = state.characters[0]; eq(c.name, 'Inês'); ok(f.a1.chars.includes(c.id)); f.a1.pov = c.id; commit(); closeAllModals();
    eq(bookCharacters(f.B1).map(v => v.ch.name + (v.pov ? ' POV' : '')), ['Inês POV']); eq(bookCharacters(f.B2).length, 0); eq(arcCharIds(f.A.id), [c.id]); ok(sceneEl(f.a1.id).textContent.includes('POV Inês'));
    filters.booksChar = c.id; setTab('books'); eq(document.querySelectorAll('#view-page .card:not(.ch-card)').length, 1); filters.arcsChar = c.id; setTab('arcs'); eq(document.querySelectorAll('#view-page .card').length, 1);
    deleteCharacter(c.id); commit(); eq([f.a1.chars.length, f.a1.pov, filters.arcsChar], [0, null, null]); setTab('board'); ok(!sceneEl(f.a1.id).textContent.includes('POV')); });
  await T('K06 Referência percorre ficha → separador → entidade eliminada', async () => { const f = fx(); openSceneFicha(f.a1.id); btn('+ Criar Nota').click(); await W(20); const r = state.refs[0]; eq(r.links, [{kind:'scene', id:f.a1.id}]); closeAllModals();
    r.links.push({kind:'book', id:f.B2.id}, {kind:'arc', id:f.A.id}); commit(); setTab('refs'); ok(document.querySelector('#view-page .card').textContent.includes('3 associações'));
    deleteScene(f.a1.id); deleteBook(f.B2.id); commit(); eq(r.links, [{kind:'arc', id:f.A.id}]); ok(document.querySelector('#view-page .card').textContent.includes('1 associação')); openArcFicha(f.A.id); ok(topModal().textContent.includes('Nova Nota')); });
  await T('K07 botão direito na coluna fixa dos Arcos Narrativos não cria Cenas', () => { const f = fx(); ctxAt(document.querySelector('.lane-label')); eq(menuLabels(), []); ctxAt(document.querySelector('.corner')); eq(menuLabels(), []); });
  await T('K08 botão direito na faixa de um Arco Narrativo ainda sem Cenas cria a Cena nesse arc', async () => { const f = fx(); const z = newArc('Zeta'); commit(); settle(); const body = document.querySelector('.ch-body[data-chapter="' + f.c2.id + '"]'); const lane = L.lanes.findIndex(l => l.arc.id === z.id);
    const r = body.getBoundingClientRect(); body.dispatchEvent(new MouseEvent('contextmenu', {bubbles:true, cancelable:true, clientX:r.right - 8, clientY:$('#bodyLayer').getBoundingClientRect().top + B.TOP + lane * B.LANE + 30}));
    ok(menuLabels()[0].includes('«Zeta»'), menuLabels().join('|')); document.querySelector('.ctx-item').click(); await W(20); eq(arcOwnScenes(z.id).length, 1); });
  await T('K09 Esc fecha o menu de contexto sem fechar a ficha por baixo', () => { const f = fx(); ctxAt(sceneEl(f.a1.id)); ok(menuLabels().length); key('Escape'); eq(menuLabels(), []); });
  await T('K10 nomes vazios são repostos ao sair do campo', () => { const f = fx(); openBookFicha(f.B1.id); const i = topModal().querySelector('input'); setInput(i, ''); eq(bkHead(f.B1.id).querySelector('.book-name').textContent, 'Sem nome'); i.dispatchEvent(new Event('change', {bubbles:true})); eq(f.B1.name, 'Tomo'); });
  await T('K11 Arco Narrativo: a descrição edita-se e guarda-se', () => { const f = fx(); openArcFicha(f.A.id); const t = topModal().querySelector('textarea'); t.value = 'A história principal'; t.dispatchEvent(new Event('input', {bubbles:true})); flushSave(); eq(loadState().arcs[0].description, 'A história principal'); });
  await T('K12 autocomplete: setas escolhem a sugestão, Enter confirma', async () => { const f = fx(); newCharacter('Ana'); newCharacter('Ana Maria'); commit(); openSceneFicha(f.a1.id); const inp = topModal().querySelector('input[placeholder^="Adicionar Personagem"]'); inp.focus(); setInput(inp, 'ana');
    inp.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowDown', bubbles:true})); eq(document.querySelector('.ac-item.active').textContent, 'Ana Maria'); inp.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true})); await W(20); eq(f.a1.chars.map(c => charById(c).name), ['Ana Maria']); });
  await T('K13 durante a visita, importar e novo projeto não fazem nada e o teclado não chega à página', async () => { const f = fx(); commit(); const before = JSON.stringify(state); startTour(); ok($('main').inert && $('#topbar').inert && $('#modals').inert, 'página devia estar inerte');
    await newProject(); eq(modals().length, 0); await importProject(new File(['{"books":[],"scenes":{}}'], 'x.json')); eq(modals().length, 0); endTour(); ok(!$('main').inert); eq(JSON.stringify(state), before); eq(localStorage.getItem(LS_KEY), before); });
  await T('K14 com uma janela aberta, o que está por trás fica inerte; ao fechar, volta', () => { const f = fx(); openBookFicha(f.B1.id); ok($('main').inert && $('#topbar').inert); openSceneFicha(f.a1.id); ok(modals()[0].parentElement.inert && !modals()[1].parentElement.inert); closeAllModals(); ok(!$('main').inert && !$('#topbar').inert); });
  await T('K15 alteração guardada noutra janela aparece nesta', () => { const f = fx(); commit(); flushSave(); const other = JSON.parse(localStorage.getItem(LS_KEY)); other.project.name = 'Mudado noutra janela'; other.books[0].name = 'Outro nome';
    window.dispatchEvent(new StorageEvent('storage', {key:LS_KEY, newValue:JSON.stringify(other)})); eq(state.project.name, 'Mudado noutra janela'); eq(document.querySelector('.book-name').textContent, 'Outro nome'); ok(!document.querySelector('.toast'), 'sincronizar não deve encher o ecrã de avisos'); eq($('#saveState').dataset.state, 'sync'); });
  await T('K16 sanitize: ids e nomes de tipos errados, e ligações de Referências a entidades inexistentes', () => { const d = sanitize({ books:[{id:7, name:null, chapters:[{id:8, name:'', scenes:[9]}]}], scenes:{9:{arcId:3, chars:[5], pov:5}}, arcs:[{id:3, name:42}], characters:[{id:5, name:null}],
      refs:[{id:1, type:'note', links:[{kind:'scene', id:9}, {kind:'scene', id:'fantasma'}, {kind:'coisa', id:1}]}] });
    eq([d.books[0].id, d.books[0].name, d.books[0].chapters[0].name, d.arcs[0].name, d.characters[0].name], ['7', 'Tomo', 'Capítulo', '42', 'Personagem']); eq(d.refs[0].links, [{kind:'scene', id:'9'}]); state = d; renderAll(); setTab('characters'); setTab('books'); openBookFicha('7'); ok(topModal()); });
  await T('K17 projeto guardado ilegível fica com cópia de segurança antes de ser substituído', () => { localStorage.setItem(LS_KEY, '{partido'); loadState(); eq(localStorage.getItem(LS_KEY + '.danificado'), '{partido'); localStorage.removeItem(LS_KEY + '.danificado'); localStorage.removeItem(LS_KEY); });
  await T('K18 fechar a janela logo depois de escrever não perde a alteração', () => { const f = fx(); f.B1.name = 'Escrito à pressa'; save(); window.dispatchEvent(new Event('pagehide')); eq(JSON.parse(localStorage.getItem(LS_KEY)).books[0].name, 'Escrito à pressa'); });
  await T('K19 Esc durante o arrasto cronológico cancela sem fechar a ficha nem pedir confirmação', async () => { const f = fx(); openArcFicha(f.A.id); const m = topModal(); m.querySelector('.switch-wrap input').click(); const card = m.querySelector('.arc-card[data-own="1"]'); const r = card.getBoundingClientRect();
    pe('pointerdown', card, r.left + 20, r.top + 20); await W(430); pe('pointermove', window, r.left + 200, r.top + 20); window.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true, cancelable:true})); pe('pointerup', window, r.left + 200, r.top + 20); await W(30);
    eq(modals().length, 1); eq([f.a1.chron, f.a2.chron, f.a3.chron, f.a4.chron], [1, 2, 3, 4]); });
  await T('K20 ficheiros que podem executar código só se descarregam; os restantes também se abrem', async () => { await addFilesAsRefs([new File(['<script>1</script>'], 'p.html', {type:'text/html'}), new File(['x'], 'n.txt', {type:'text/plain'})], null);
    openRefFicha(state.refs[0].id); await W(120); ok(!btn('Abrir') || btn('Abrir').textContent !== 'Abrir', 'HTML não devia abrir na aplicação'); ok(btn('Descarregar')); closeAllModals(); openRefFicha(state.refs[1].id); await W(120); ok([...topModal().querySelectorAll('a.btn')].some(a => a.textContent === 'Abrir')); });
  await T('K21 plurais e textos: «1 Cena», «2 Cenas», sem «(s)»', () => { const f = fx(); for (const t of ['books', 'arcs', 'refs', 'characters']){ setTab(t); ok(!/\(s\)|\(ões\)/.test($('#view-page').textContent), t + ': ' + ($('#view-page').textContent.match(/.{20}\(s\)/) || [''])[0]); } setTab('books'); ok($('#view-page').textContent.includes('1 Capítulo ·') && $('#view-page').textContent.includes('2 Capítulos ·')); });
  await T('K22 paleta gerada continua visível como «Atual» depois de recarregar', () => { state.project.palette = {h:123, mode:'dark'}; extraPalettes = []; setTab('settings'); const on = document.querySelector('.pal.on'); ok(on && on.textContent.includes('Atual')); });
  await T('K23 a cor da barra da janela instalada acompanha a paleta', () => { state.project.palette = {h:40, mode:'light'}; lsSet(LS_THEME, 'light'); applyPalette(); eq($('meta[name="theme-color"]').content, paletteVars({h:40, mode:'light'})['--chrome']); });

  await T('K24 ligar uma convergência a uma Cena fora do ecrã: o quadro desloca-se ao chegar à margem', async () => { const f = fx(); for (let i = 0; i < 6; i++){ const c = { id:uid('c'), name:'C', scenes:[] }; f.B1.chapters.push(c); } renderAll(); settle(); const sc = $('#board-scroll'); sc.scrollLeft = 0; await W(30);
    ok(sceneEl(f.b2.id).getBoundingClientRect().left > innerWidth, 'a Cena de destino devia estar fora do ecrã'); const r = sceneEl(f.b1.id).getBoundingClientRect(); f.b2.chron = 0; normalizeChron(f.Bq.id); renderAll(); settle();
    await longPress(sceneEl(f.b1.id), 2); ok(linkDrag, 'ligação não iniciada'); const edge = sc.getBoundingClientRect().right - 10; pe('pointermove', window, edge, r.top + 20, 2); for (let i = 0; i < 400 && sceneEl(f.a4.id).getBoundingClientRect().right > edge - 60; i++) tick();
    ok(sc.scrollLeft > 0, 'o quadro não se deslocou'); const t = sceneEl(f.a4.id).getBoundingClientRect(); ok(t.left < innerWidth, 'destino continua fora do ecrã'); pe('pointermove', window, t.left + 30, t.top + 20, 2); eq(linkDrag.hover, f.a4.id); pe('pointerup', window, t.left + 30, t.top + 20, 2); await W(30); await answer(true); eq(f.b1.convergeTo, f.a4.id); });

  /* ================= J. PROGRAMA INSTALÁVEL ================= */
  await T('J01 manifesto válido, com ícones 192 e 512 que carregam', async () => { const l = document.querySelector('link[rel="manifest"]'); ok(l); const m = await (await fetch(l.href)).json(); eq([m.display, m.start_url], ['standalone', './']); ok(m.name && m.short_name);
    for (const size of ['192x192', '512x512']) ok(m.icons.some(i => i.sizes === size && i.type === 'image/png'), 'falta ícone ' + size); ok(m.icons.some(i => i.purpose === 'maskable'));
    for (const i of m.icons){ const img = new Image(); img.src = new URL(i.src, l.href); await img.decode(); if (i.type === 'image/png') eq(img.naturalWidth + 'x' + img.naturalHeight, i.sizes); } });
  await T('J02 service worker ativo e com a aplicação inteira em cache (uso sem internet)', async () => { const reg = await Promise.race([navigator.serviceWorker.ready, W(10000)]); ok(reg, 'o service worker não ficou pronto em 10 s'); ok(reg.active, 'sem service worker'); const keys = (await caches.keys()).filter(k => k.startsWith('narrativa-app')); eq(keys.length, 1);
    const c = await caches.open(keys[0]); const base = new URL('./', location.href).href; const have = (await c.keys()).map(r => r.url.replace(base, '').split('?')[0]);
    const need = ['index.html', 'styles.css', 'logo.svg', 'manifest.webmanifest', ...[...document.querySelectorAll('script[src^="js/"]')].map(s => s.getAttribute('src'))]; eq(need.filter(n => !have.includes(n)), []); });
  await T('J03 Definições: instruções de instalação, botão quando o browser o permite, estado depois de instalar', async () => { Install.prompt = null; Install.done = false; setTab('settings'); const card = () => [...document.querySelectorAll('#view-page .card')].find(c => /Instalar como app/.test(c.textContent));
    ok(card().querySelector('[data-install="manual"]'), 'sem instruções'); let asked = 0; const ev = new Event('beforeinstallprompt', {cancelable:true}); ev.prompt = () => asked++; ev.userChoice = Promise.resolve({outcome:'accepted'}); window.dispatchEvent(ev);
    ok(ev.defaultPrevented); const b = btn('Instalar', card()); ok(b, 'sem botão Instalar'); ok(tipFor(b)); b.click(); await W(20); eq(asked, 1); window.dispatchEvent(new Event('appinstalled')); ok(card().querySelector('[data-install="installed"]')); Install.done = false; Install.prompt = null; });

  /* ---- L: Localizações ---- */
  const cardNames = () => [...document.querySelectorAll('#view-page .card h3')].map(x => x.textContent);
  const chipNames = (root, i) => [...root.querySelectorAll('.chip.click')].map(x => x.firstChild.textContent);
  await T('L01 ordem das áreas', () => { eq(TABS.map(t => t[1]), ['Narrativa', 'Calendarização e Objetivos', 'Tomos e Capítulos', 'Arcos Narrativos', 'Personagens', 'Localizações', 'Referências', 'Materiais de Apoio', 'Definições do Projeto']);
    eq([...document.querySelectorAll('#rail .nav-item')].map(t => t.dataset.tab), ['board', 'plan', 'books', 'arcs', 'characters', 'sceneries', 'refs', 'support']); });
  await T('L02 separador Localizações: vazio, criar com «+», ficha com nome editável', async () => { setTab('sceneries'); ok($('#view-page').textContent.includes('Ainda não existem Localizações'));
    btn('+ Nova Localização', $('#view-page')).click(); await W(20); eq(state.sceneries.length, 1); const x = state.sceneries[0]; let m = topModal(); ok(m.textContent.includes('Ficha da Localização'));
    const inp = m.querySelector('input'); setInput(inp, 'Praia'); eq(x.name, 'Praia'); eq(cardNames(), ['Praia']);
    setInput(inp, ''); inp.dispatchEvent(new Event('change')); eq(x.name, 'Localização', 'o nome não pode ficar vazio'); });
  await T('L03 Cena ↔ Localização: associar existente, criar novo, desassociar, vários para vários', async () => { const f = fx(); const p = newScenery('Praia');
    openSceneFicha(f.a1.id); btn('+ Associar Localização').click(); await W(20); await pickAC(topModal().querySelector('input'), 'Pra', 'Praia'); eq(f.a1.sceneries, [p.id]);
    eq(document.querySelectorAll('.modal').length, 1, 'a janela de associação devia fechar'); ok(topModal().textContent.includes('Praia'));
    btn('+ Associar Localização').click(); await W(20); const inp = topModal().querySelector('input'); inp.focus(); setInput(inp, 'Cais'); await W(10);
    ok(![...document.querySelectorAll('.ac-item')].some(i => i.textContent === 'Praia'), 'uma Localização já associado não devia ser sugerido');
    document.querySelector('.ac-item.create').dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, cancelable:true})); await W(20);
    eq(state.sceneries.map(x => x.name), ['Praia', 'Cais']); const c = state.sceneries[1]; eq(f.a1.sceneries, [p.id, c.id]);
    f.a2.sceneries.push(p.id); f.b2.sceneries.push(p.id); eq(sceneryScenes(p.id).map(s => s.title), ['a1', 'a2', 'b2'], 'Cenas pela Ordem Narrativa');
    [...topModal().querySelectorAll('.chip.click')].find(ch => ch.textContent.includes('Praia')).querySelector('.chip-x').click(); eq(f.a1.sceneries, [c.id]); ok(sceneryById(p.id), 'desassociar não elimina'); });
  await T('L04 ficha da Localização: Cenas, Personagens, Notas e Referências', async () => { const f = fx(); const p = newScenery('Praia'); const ana = newCharacter('Ana'); f.a2.sceneries.push(p.id); f.b2.sceneries.push(p.id);
    state.refs.push({id:'rl', type:'link', title:'Mapa', url:'https://x', links:[], created:1}); openSceneryFicha(p.id); let m = topModal();
    eq([...m.querySelectorAll('.list-row .grow')].map(x => x.firstChild.textContent), ['a2', 'b2']);
    btn('+ Associar Personagem').click(); await W(20); await pickAC(topModal().querySelector('input'), 'An', 'Ana'); eq(p.chars, [ana.id]);
    btn('+ Associar Personagem').click(); await W(20); const inp = topModal().querySelector('input'); inp.focus(); setInput(inp, 'Beto'); await W(10);
    document.querySelector('.ac-item.create').dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, cancelable:true})); await W(20); eq(state.characters.map(c => c.name), ['Ana', 'Beto']); eq(p.chars.length, 2);
    btn('+ Associar Cena').click(); await W(20); await pickAC(topModal().querySelector('input'), 'a4', 'a4'); eq(f.a4.sceneries, [p.id]);
    btn('+ Criar Nota').click(); await W(20); const n = state.refs.find(r => r.type === 'note'); eq(n.links, [{kind:'scenery', id:p.id}]); topModal().querySelector('.modal-head .modal-x').click(); await W(20);
    btn('+ Associar Referência').click(); await W(20); await pickAC(topModal().querySelector('input'), 'Map', 'Mapa'); eq(refById('rl').links, [{kind:'scenery', id:p.id}]);
    m = topModal(); ok(m.textContent.includes('Mapa') && m.textContent.includes('Nova Nota'));
    m.querySelector('.list-row .grow').click(); await W(20); ok(topModal().textContent.includes('Ficha da Cena'), 'clicar numa Cena abre a sua ficha'); ok(topModal().textContent.includes('Praia')); });
  await T('L05 Personagem ↔ Localização nos dois sentidos e filtro do separador', async () => { fx(); const ana = newCharacter('Ana'), beto = newCharacter('Beto'); const p = newScenery('Praia'), c = newScenery('Cais'); c.chars.push(beto.id);
    openCharFicha(ana.id); btn('+ Associar Localização').click(); await W(20); await pickAC(topModal().querySelector('input'), 'Pra', 'Praia'); eq(p.chars, [ana.id]); ok(topModal().textContent.includes('Praia'));
    btn('+ Associar Localização').click(); await W(20); const inp = topModal().querySelector('input'); inp.focus(); setInput(inp, 'Gruta'); await W(10);
    document.querySelector('.ac-item.create').dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, cancelable:true})); await W(20); const g = state.sceneries[2]; eq([g.name, g.chars], ['Gruta', [ana.id]]);
    eq(charSceneries(ana.id).map(x => x.name), ['Praia', 'Gruta']); closeAllModals();
    openSceneryFicha(p.id); ok(topModal().textContent.includes('Ana')); closeAllModals();
    setTab('sceneries'); eq(cardNames(), ['Cais', 'Gruta', 'Praia']); await pickAC(document.querySelector('#view-page .page-head input'), 'An', 'Ana'); eq(filters.scnChar, ana.id); eq(cardNames(), ['Gruta', 'Praia']);
    document.querySelector('#view-page .page-head .chip-x').click(); eq(cardNames(), ['Cais', 'Gruta', 'Praia']);
    filters.scnChar = beto.id; renderAll(); eq(cardNames(), ['Cais']); deleteCharacter(beto.id); commit(); eq(filters.scnChar, null, 'o filtro cai com a Personagem'); eq(c.chars, []); });
  await T('L06 eliminar: Localização, Cena e Personagem não deixam ligações penduradas', async () => { const f = fx(); const ana = newCharacter('Ana'); const p = newScenery('Praia'); p.chars.push(ana.id); f.a1.sceneries.push(p.id); f.a2.sceneries.push(p.id);
    state.refs.push({id:'rn', type:'note', title:'n', text:'', links:[{kind:'scenery', id:p.id}, {kind:'scene', id:f.a1.id}], created:1}); commit();
    deleteScene(f.a1.id); commit(); eq(sceneryScenes(p.id).map(s => s.title), ['a2']);
    openSceneryFicha(p.id); btn('Eliminar Localização').click(); await W(20); ok(topModal().textContent.includes('Praia')); await answer(false); ok(sceneryById(p.id)); btn('Eliminar Localização').click(); await W(20); await answer(true);
    eq(state.sceneries, []); eq(f.a2.sceneries, []); eq(refById('rn').links, []); eq(document.querySelectorAll('.modal').length, 0);
    undo(); eq(state.sceneries.map(x => x.name), ['Praia']); eq(state.scenes[f.a2.id].sceneries, [state.sceneries[0].id]); eq(refById('rn').links.length, 1); redo(); eq(state.sceneries, []); });
  await T('L07 Referência ↔ Localização a partir da ficha da Referência', async () => { fx(); const p = newScenery('Praia'); const r = newNote(); commit(); openRefFicha(r.id);
    await pickAC(topModal().querySelector('input[placeholder^="Associar"]'), 'Pra', 'Localização: Praia'); eq(r.links, [{kind:'scenery', id:p.id}]);
    [...topModal().querySelectorAll('.chip.click span')].find(x => x.textContent === 'Localização: Praia').click(); await W(20); ok(topModal().textContent.includes('Ficha da Localização')); });
  await T('L08 persistência e projetos antigos: sem Localizações, com lixo, e ida e volta', async () => { const f = fx(); const ana = newCharacter('Ana'); const p = newScenery('Praia'); p.chars.push(ana.id); f.a1.sceneries.push(p.id); commit(); flushSave();
    const back = sanitize(JSON.parse(localStorage.getItem(LS_KEY))); eq(back.sceneries, [{id:p.id, name:'Praia', chars:[ana.id]}]); eq(back.scenes[f.a1.id].sceneries, [p.id]);
    const old = JSON.parse(JSON.stringify(state)); delete old.sceneries; Object.values(old.scenes).forEach(s => delete s.sceneries); old.refs.push({id:'r9', type:'note', title:'x', links:[{kind:'scenery', id:p.id}]});
    const d = sanitize(old); eq(d.sceneries, []); ok(Object.values(d.scenes).every(s => Array.isArray(s.sceneries) && !s.sceneries.length)); eq(d.refs.find(r => r.id === 'r9').links, [], 'ligação a Localização inexistente removida');
    const bad = JSON.parse(JSON.stringify(state)); bad.sceneries = [null, 5, {id:7, chars:[ana.id, ana.id, 'fantasma']}, {id:'q', name:'', chars:'x'}]; bad.scenes[f.a1.id].sceneries = ['7', '7', 'nada', 7];
    const e = sanitize(bad); eq(e.sceneries, [{id:'7', chars:[ana.id], name:'Localização'}, {id:'q', name:'Localização', chars:[]}]); eq(e.scenes[f.a1.id].sceneries, ['7']);
    state = d; renderAll(); setTab('sceneries'); ok($('#view-page').textContent.includes('Ainda não existem Localizações')); openSceneFicha(f.a1.id); ok(topModal().textContent.includes('Sem Localizações')); });
  await T('L09 visita guiada: demonstração com Localizações e passo próprio', async () => { startTour(); eq(state.sceneries.length, 15); ok(Object.values(state.scenes).every(s => Array.isArray(s.sceneries)));
    eq(sceneryScenes('sc1').map(s => s.id).slice(0, 3), ['s2', 's11', 's4']); ok(TOUR_STEPS.some(st => st.tab === 'sceneries')); const tabs = TOUR_STEPS.filter(st => st.tab).map(st => st.tab);
    eq(tabs.filter((t, i) => t !== tabs[i - 1]), ['plan', 'books', 'arcs', 'characters', 'sceneries', 'refs', 'support', 'settings'], 'a visita segue a ordem dos separadores'); endTour(); eq(state.sceneries, []); });

  await T('L10 associar: não oferece criar um duplicado do que já está associado; mensagens da lista', async () => { const f = fx(); const p = newScenery('Praia'); f.a1.sceneries.push(p.id); const ana = newCharacter('Ana'); f.a1.chars.push(ana.id); renderAll();
    openSceneFicha(f.a1.id); btn('+ Associar Localização').click(); await W(20); let inp = topModal().querySelector('input'); inp.focus(); setInput(inp, 'praia'); await W(10);
    ok(!document.querySelector('.ac-item.create'), 'não devia oferecer criar «praia»'); eq(document.querySelector('.ac-empty').textContent, 'Já está associado');
    inp.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true})); await W(20); eq(state.sceneries.length, 1);
    setInput(inp, 'Gruta'); await W(10); ok(document.querySelector('.ac-item.create'), 'um nome novo pode ser criado'); closeAllModals(); await W(160);
    openSceneFicha(f.a1.id); inp = topModal().querySelector('input[placeholder^="Adicionar Personagem"]'); inp.focus(); setInput(inp, 'ANA'); await W(10); ok(!document.querySelector('.ac-item.create')); eq(state.characters.length, 1); closeAllModals();
    newScenery('Cais'); openSceneryFicha(p.id); btn('+ Associar Cena').click(); await W(20); inp = topModal().querySelector('input'); inp.focus(); setInput(inp, 'zzz'); await W(10); eq(document.querySelector('.ac-empty').textContent, 'Sem resultados');
    setInput(inp, ''); await W(10); ok(document.querySelectorAll('.ac-item').length === 5, 'as 5 Cenas por associar'); });
  await T('L11 Enter repetido (tecla premida) não escolhe o primeiro item', async () => { const f = fx(); const p = newScenery('Praia'); openSceneFicha(f.a1.id); btn('+ Associar Localização').click(); await W(20);
    const inp = topModal().querySelector('input'); inp.focus(); inp.dispatchEvent(new Event('focus')); await W(10); inp.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true, repeat:true})); await W(20); eq(f.a1.sceneries, []);
    inp.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true})); await W(20); eq(f.a1.sceneries, [p.id]); });
  await T('L12 Localizações derivados das Cenas: fichas do Tomo, do Arco Narrativo, da Personagem e da Localização', async () => { const f = fx(); const p = newScenery('Praia'), g = newScenery('Gruta'); const ana = newCharacter('Ana'), beto = newCharacter('Beto');
    f.a1.sceneries.push(p.id); f.b2.sceneries.push(g.id); f.a1.chars.push(ana.id); f.a1.pov = beto.id; p.chars.push(ana.id); renderAll();
    const secChips = t => { const sec = [...topModal().querySelectorAll('.sec')].find(x => x.querySelector('.sec-title').textContent === t); return [...sec.querySelectorAll('.chip.click')].map(c => c.textContent.replace('✕', '')); };
    openBookFicha(f.B1.id); eq(secChips('Localizações'), ['Praia']); closeAllModals(); openBookFicha(f.B2.id); eq(secChips('Localizações'), ['Gruta']); closeAllModals();
    openArcFicha(f.A.id); eq(secChips('Localizações'), ['Praia']); closeAllModals(); openArcFicha(f.Bq.id); eq(secChips('Localizações'), ['Gruta']); closeAllModals();
    openSceneryFicha(p.id); eq(secChips('Personagens associadas'), ['Ana', 'Beto'], 'Ana associada + Beto das Cenas'); ok(topModal().textContent.includes('Figuram nas Cenas desta Localização')); closeAllModals();
    openCharFicha(beto.id); eq(secChips('Localizações'), ['Praia']); ok(topModal().textContent.includes('Das Cenas em que figura')); closeAllModals();
    openCharFicha(ana.id); eq(secChips('Localizações'), ['Praia']); ok(!topModal().textContent.includes('Das Cenas em que figura'), 'já associado diretamente: não se repete'); });
  await T('L13 ficha nova: o nome fica focado e selecionado', async () => { setTab('sceneries'); btn('+ Nova Localização', $('#view-page')).click(); await W(80); let i = topModal().querySelector('input'); ok(document.activeElement === i); eq([i.selectionStart, i.selectionEnd], [0, i.value.length]); closeAllModals();
    setTab('characters'); btn('+ Nova Personagem', $('#view-page')).click(); await W(80); i = topModal().querySelector('input'); ok(document.activeElement === i); eq(i.selectionEnd, i.value.length); });
  await T('L14 importar ficheiro com lixo: normaliza sem rebentar; ficheiro inválido não apaga as Referências guardadas', async () => { const f = fx(); await idb.put('guardado', new Blob(['x']));
    const d = sanitize({books:[null, {id:1, chapters:[null, {id:2, scenes:['s']}]}], scenes:{s:{arcId:'a'}, t:null}, arcs:[null, 7, {id:'a'}], characters:[null, 'x'], refs:[null, {id:'r', links:[null, 5]}], sceneries:'x', project:'p'});
    eq([d.books.length, d.books[0].chapters.length, Object.keys(d.scenes), d.arcs.length, d.characters, d.sceneries, d.refs.length, d.project.name], [1, 1, ['s'], 1, [], [], 1, 'Projeto']);
    const bad = new File(['{"books":[{"chapters":"x"}],"scenes":5}'], 'mau.json'); await importProject(bad); await W(30); eq(document.querySelectorAll('.modal').length, 0, 'ficheiro inválido não chega à confirmação'); ok(await idb.get('guardado'), 'as Referências guardadas mantêm-se');
    eq(state.books.length, 2); await idb.del('guardado'); });
  await T('L15 anular depois de outra janela guardar um projeto antigo durante a visita', async () => { fx(); commit(); const old = JSON.parse(JSON.stringify(state)); delete old.sceneries; Object.values(old.scenes).forEach(x => delete x.sceneries); old.project.name = 'Antigo';
    startTour(); window.dispatchEvent(new StorageEvent('storage', {key:LS_KEY, newValue:JSON.stringify(old)})); endTour(); eq(state.project.name, 'Antigo'); eq(state.sceneries, []);
    state.project.name = 'Novo'; commit(); undo(); eq(state.project.name, 'Antigo'); ok(Array.isArray(state.sceneries) && Object.values(state.scenes).every(x => Array.isArray(x.sceneries))); setTab('sceneries'); openSceneFicha(Object.keys(state.scenes)[0]); ok(topModal()); });
  await T('L16 confirmações de eliminar com singular e plural corretos', async () => { const f = fx(); askDeleteChapter(f.c2.id); await W(20); ok(topModal().textContent.includes('e a sua Cena?')); await answer(false);
    askDeleteChapter(f.c1.id); await W(20); ok(topModal().textContent.includes('e as suas 3 Cenas?')); await answer(false);
    askDeleteBook(f.B2.id); await W(20); ok(topModal().textContent.includes(', o seu Capítulo e as suas 2 Cenas?')); await answer(false);
    askDeleteBook(f.B1.id); await W(20); ok(topModal().textContent.includes(', os seus 2 Capítulos e as suas 4 Cenas?')); await answer(false); });
  await T('L17 explicadores: ✕ do filtro de página, ficha dos Materiais de Apoio', async () => { fx(); const ana = newCharacter('Ana'); filters.scnChar = ana.id; setTab('sceneries'); const x = document.querySelector('#view-page .page-head .chip-x'); eq(tipFor(x).title, 'Filtro ativo');
    openSupportFicha('Analepse'); const miss = [...topModal().querySelectorAll('.field > label, .chip, button')].filter(el => !tipFor(el)).map(el => el.textContent); eq(miss, []); });

  /* ---- M: ecrãs táteis, contraste, gravação automática, duplo ecrã, textos dentro das caixas ---- */
  const te = (type, el, x, y, extra) => el.dispatchEvent(new PointerEvent(type, Object.assign({bubbles:true, cancelable:true, clientX:x, clientY:y, button:0, pointerId:7, pointerType:'touch', isPrimary:true}, extra)));
  async function holdTouch(el, dx = 20, dy = 20){ const r = el.getBoundingClientRect(); te('pointerdown', el, r.left + dx, r.top + dy); await W(430); return r; }
  const rgbOf = css => { const p = h('span', {style:{color:css}}); document.body.append(p); const m = getComputedStyle(p).color.match(/[\d.]+/g).map(Number); p.remove(); return [m[0] / 255, m[1] / 255, m[2] / 255]; };
  await T('M01 toque longo numa Cena, sem arrastar, abre o menu (o equivalente ao botão direito)', async () => { const f = fx(); const el = sceneEl(f.a4.id); const r = await holdTouch(el);
    ok(drag && drag.touch, 'o toque longo levanta a Cena'); te('pointerup', window, r.left + 20, r.top + 20); await W(30);
    ok(menuLabels().includes('Criar nova Cena aqui') && menuLabels().includes('Criar convergência…'), 'menu: ' + menuLabels());
    sceneEl(f.a4.id).click(); eq(modals().length, 0, 'o clique simulado a seguir ao toque não abre a ficha'); });
  await T('M02 toque longo e arrastar move a Cena, com confirmação', async () => { const f = fx(); const el = sceneEl(f.a2.id); const r = await holdTouch(el); ok(drag);
    const x = dropX('scene', f.a2.id, f.c2.id, 1); te('pointermove', window, x, r.top + 20); te('pointerup', window, x, r.top + 20); await W(30); eq(menuLabels(), [], 'arrastar não abre o menu');
    await answer(true); eq(titles(), [[['a1', 'b1'], ['a3', 'a2']], [['b2', 'a4']]]); });
  await T('M03 toque longo num espaço vazio do Capítulo abre o menu de criação; mover o dedo antes cancela', async () => { const f = fx(); const z = newArc('Zeta'); commit(); settle();
    const body = document.querySelector('.ch-body[data-chapter="' + f.c2.id + '"]'), r = body.getBoundingClientRect(); const li = L.lanes.findIndex(l => l.arc.id === z.id), y = $('#bodyLayer').getBoundingClientRect().top + B.TOP + li * B.LANE + 40;
    te('pointerdown', body, r.right - 12, y); await W(150); te('pointermove', window, r.right - 40, y); await W(330); eq(menuLabels(), [], 'deslocar o quadro não abre menus'); te('pointerup', window, r.right - 40, y);
    te('pointerdown', body, r.right - 12, y); await W(430); ok(menuLabels()[0].includes('Zeta'), 'menu: ' + menuLabels());
    body.dispatchEvent(new MouseEvent('contextmenu', {bubbles:true, cancelable:true, clientX:r.right - 12, clientY:y})); ok(menuLabels()[0].includes('Zeta'), 'o menu de contexto do browser não substitui o nosso'); te('pointerup', window, r.right - 12, y); });
  await T('M04 «Criar convergência…»: escolhe-se a Cena de destino com um toque', async () => { const f = fx(); ctxAt(sceneEl(f.a4.id)); const it = [...document.querySelectorAll('.ctx-item')].find(x => x.textContent === 'Criar convergência…'); ok(!it.disabled && tipFor(it)); it.click();
    eq(pickLink, f.a4.id); ok(sceneEl(f.a4.id).classList.contains('link-from')); sceneEl(f.a3.id).click(); eq(modals().length, 0, 'mesmo Arco Narrativo: recusa'); eq(pickLink, null);
    beginPickLink(f.a4.id); sceneEl(f.b2.id).click(); await W(20); await answer(true); eq(f.a4.convergeTo, f.b2.id);
    ctxAt(sceneEl(f.a1.id)); ok([...document.querySelectorAll('.ctx-item')].find(x => x.textContent === 'Criar convergência…').disabled, 'só a última Cena do Arco Narrativo'); closeMenu();
    beginPickLink(f.b2.id); document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true})); eq(pickLink, null); ok(!document.body.classList.contains('linking')); });
  await T('M05 contraste garantido em todas as paletas e em todas as cores de Arco Narrativo', () => { const bad = [];
    for (const mode of ['dark', 'light']) for (let hue = 0; hue < 360; hue += 3){ const v = paletteVars({h:hue, mode}), c = k => rgbOf(v[k]);
      const chk = (a, b, min, what) => { const x = contrast(a, b); if (x < min) bad.push(mode + ' ' + hue + '° ' + what + ' ' + x.toFixed(2)); };
      for (const bg of ['--bg', '--surface', '--surface2']){ chk(c('--text'), c(bg), 7, 'texto/' + bg); chk(c('--muted'), c(bg), 4.5, 'secundário/' + bg); chk(c('--accent'), c(bg), 4.5, 'destaque/' + bg); chk(c('--danger'), c(bg), 4.5, 'perigo/' + bg); chk(c('--border-strong'), c(bg), 3, 'contorno/' + bg); chk(c('--pov'), c(bg), 4.5, 'pov/' + bg); }
      chk(c('--accent-text'), c('--accent'), 4.5, 'texto sobre destaque'); chk(c('--bg'), c('--text'), 7, 'aviso');
      state.project.palette = {h:hue, mode}; const arc = {hue};
      chk(rgbOf(arcColor(arc)), SCENE_INK, 7, 'cartão de Cena'); chk(rgbOf(arcColor(arc, true)), SCENE_INK, 7, 'cartão herdado'); chk(rgbOf(arcStroke(arc)), c('--bg'), 3, 'linha do Arco Narrativo'); chk(rgbOf(arcStroke(arc)), c('--surface'), 3, 'ponto do Arco Narrativo'); }
    eq(bad.slice(0, 8), []); });
  await T('M06 gravação automática: indicador, e o projeto volta igual depois de recarregar', async () => { const f = fx(); f.a1.title = 'Persistente'; commit(); eq($('#saveState').dataset.state, 'busy'); await W(260); eq($('#saveState').dataset.state, 'ok'); ok(tipFor($('#saveState')));
    const back = loadState(); eq(back.scenes[f.a1.id].title, 'Persistente'); eq(back.books.length, 2);
    startTour(); eq($('#saveState').dataset.state, 'demo'); endTour(); eq($('#saveState').dataset.state, 'ok'); });
  await T('M07 outra janela altera o projeto: a ficha aberta mantém-se com os dados novos, e a alteração pode ser anulada aqui', async () => { const f = fx(); commit(); flushSave(); histInit(); openSceneFicha(f.a1.id);
    const other = JSON.parse(localStorage.getItem(LS_KEY)); other.scenes[f.a1.id].title = 'Mudado lá';
    window.dispatchEvent(new StorageEvent('storage', {key:LS_KEY, newValue:JSON.stringify(other)})); eq(modals().length, 1, 'a ficha continua aberta'); eq(topModal().querySelector('input').value, 'Mudado lá'); ok(topModal().classList.contains('still'));
    closeAllModals(); eq(Hist.undo.length, 1); undo(); eq(state.scenes[f.a1.id].title, 'a1'); redo(); eq(state.scenes[f.a1.id].title, 'Mudado lá');
    openSceneFicha(f.b1.id); delete other.scenes[f.b1.id]; other.books[0].chapters[0].scenes = other.books[0].chapters[0].scenes.filter(x => x !== f.b1.id);
    window.dispatchEvent(new StorageEvent('storage', {key:LS_KEY, newValue:JSON.stringify(other)})); eq(modals().length, 0, 'a ficha de algo eliminado na outra janela fecha-se'); });
  await T('M08 duplo ecrã: com a segunda janela a seguir, a ficha abre lá e a Cena fica assinalada aqui', async () => { const f = fx(); const sent = []; Dual.post = m => sent.push(m); ok(tipFor($('#dualBtn')));
    openSceneFicha(f.a2.id); eq(modals().length, 1, 'sem segunda janela, abre aqui'); eq(openModals[0].entity, {kind:'scene', id:f.a2.id}); closeAllModals(); eq(sent, []);
    Dual.seen = Date.now(); syncDualUI(); ok($('#dualBtn').classList.contains('on')); openSceneFicha(f.a2.id); eq(modals().length, 0); eq(sent, [{t:'open', kind:'scene', id:f.a2.id}]); ok(sceneEl(f.a2.id).classList.contains('sel2'));
    renderAll(); ok(sceneEl(f.a2.id).classList.contains('sel2'), 'o sinal sobrevive ao redesenho'); eq(tipFor(sceneEl(f.a2.id)).title, 'Cena aberta no segundo ecrã');
    dualOn({data:{t:'showing', en:{kind:'arc', id:f.Bq.id}}}); ok(document.querySelector('.lane-label.sel2') && !document.querySelector('.scene.sel2'));
    confirmDialog('?'); eq(modals().length, 1, 'as confirmações continuam nesta janela'); closeAllModals();
    startTour(); openSceneFicha('s2'); eq(modals().length, 1, 'a visita não usa o segundo ecrã'); endTour();
    dualOn({data:{t:'bye'}}); ok(!Dual.alive() && !document.querySelector('.sel2')); openSceneFicha(f.a2.id); eq(modals().length, 1); closeAllModals();
    Dual.seen = Date.now(); sent.length = 0; $('#dualBtn').click(); eq(sent, [{t:'release'}]); ok(!Dual.alive()); });
  await T('M09 duplo ecrã: a segunda janela abre o que a principal pede, diz o que mostra e pode deixar de seguir', async () => { const f = fx(); const ana = newCharacter('Ana'); const sent = []; Dual.post = m => sent.push(m); Dual.role = 'second'; syncDualUI();
    ok(!$('#dualBar').hidden && $('#dualBtn').hidden); dualOn({data:{t:'open', kind:'scene', id:f.a1.id}}); eq(modals().length, 1); await W(80); eq(sent.pop(), {t:'showing', en:{kind:'scene', id:f.a1.id}});
    dualOn({data:{t:'open', kind:'character', id:ana.id}}); eq(modals().length, 1, 'a ficha anterior é substituída'); ok(topModal().textContent.includes('Personagem')); await W(80); eq(sent.pop().en, {kind:'character', id:ana.id});
    dualOn({data:{t:'open', kind:'support', id:'Analepse'}}); ok(topModal().textContent.includes('Analepse')); closeAllModals(); await W(80); eq(sent.pop(), {t:'showing', en:null});
    const b = btn('Parar de seguir', $('#dualBar')); ok(tipFor(b)); b.click(); ok(!Dual.follow); eq(sent.pop(), {t:'bye'}); dualOn({data:{t:'open', kind:'scene', id:f.a1.id}}); eq(modals().length, 0, 'sem seguir, ignora');
    btn('Seguir a outra janela', $('#dualBar')).click(); ok(Dual.follow); Dual.role = 'main'; syncDualUI(); ok($('#dualBar').hidden); ssSet(SS_FOLLOW, '1'); });
  await T('M10 orientação e barra de topo: estado do dispositivo, botões com explicador, guardar como app', async () => { syncDevice(); ok(['portrait', 'landscape'].includes(document.documentElement.dataset.orient)); eq(B.GUT, innerWidth < 700 || innerHeight < 520 ? 104 : 170);
    eq(getComputedStyle($('#gutter')).width, B.GUT + 'px'); orientHint(); ok($('#orientHint').hidden || coarse());
    const miss = [...document.querySelectorAll('#topbar button, #saveState')].filter(el => !tipFor(el)).map(el => el.id || el.textContent); eq(miss, []);
    Install.prompt = null; Install.done = false; syncInstallBtn(); eq($('#installBtn').hidden, !isIOS()); let asked = 0; const ev = new Event('beforeinstallprompt', {cancelable:true}); ev.prompt = () => asked++; ev.userChoice = Promise.resolve({outcome:'dismissed'});
    window.dispatchEvent(ev); ok(!$('#installBtn').hidden, 'o botão aparece quando o browser permite instalar'); $('#installBtn').click(); await W(20); eq(asked, 1);
    installHelp(); ok(topModal().textContent.includes('Adicionar ao ecrã principal')); closeAllModals(); Install.prompt = null; syncInstallBtn(); });
  await T('M11 a visita guiada cobre as novidades e todos os passos têm alvo', async () => { const titles = TOUR_STEPS.map(x => x.title);
    for (const t of ['Anular, refazer e gravação automática', 'Explicadores', 'Dois ecrãs', 'Telemóvel e tablet', 'Separador Localizações']) ok(titles.includes(t), 'falta o passo ' + t);
    startTour(); Tour.i = Tour.steps.findIndex(x => x.title === 'Explicadores'); showTourStep(); await W(60); ok($('#tip').classList.contains('on'), 'o passo mostra um explicador'); ok(parseFloat($('#tourSpot').style.width) > 20);
    Tour.i++; showTourStep(); await W(40); ok(!$('#tip').classList.contains('on')); endTour(); });
  /* Os textos nunca saem da sua caixa: corre a ferramenta em janelas de vários tamanhos, com nomes muito longos, e mede tudo. */
  const SCAN = `(async () => {
    const W = ms => new Promise(r => setTimeout(r, ms));
    closeAllModals(); lsSet(LS_TOUR, '1'); tourMode = true; // nada é guardado
    const long = 'Pneumoultramicroscopicossilicovulcanoconiótico', LONG = long + long + ' ' + long;
    state = demoProjectMini(); state.project.name = LONG;
    state.books.forEach(b => { b.name = LONG; b.chapters.forEach(c => c.name = LONG); }); Object.values(state.scenes).forEach(x => { x.title = LONG; x.summary = LONG; });
    state.arcs.forEach(a => a.name = LONG); state.characters.forEach(c => { c.name = LONG; c.age = long; }); state.books.forEach(b => b.mainChars = state.characters.map(c => c.id)); state.sceneries.forEach(x => x.name = LONG);
    state.refs.push({id:'rx', type:'link', title:LONG, url:'https://exemplo.pt/' + long + long, links:[{kind:'scene', id:'s2'}], created:1}, {id:'ry', type:'note', title:LONG, text:LONG, links:[{kind:'character', id:'ch1'}], created:2});
    const bad = [];
    const clips = el => { const c = getComputedStyle(el); return c.overflowX !== 'visible' || c.overflowY !== 'visible'; };
    const scan = where => {
      if (document.documentElement.scrollWidth > innerWidth + 1) bad.push(where + ': a página desliza para o lado (' + document.documentElement.scrollWidth + ' > ' + innerWidth + ')');
      document.querySelectorAll('.list-row .grow').forEach(g => { if (g.getClientRects().length && g.getBoundingClientRect().width < 60) bad.push(where + ': o nome numa lista ficou com ' + Math.round(g.getBoundingClientRect().width) + ' px'); });
      const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
      while ((n = tw.nextNode())){
        if (!n.nodeValue.trim()) continue; const p = n.parentElement; if (!p || p.closest('script,style,option,#lines') || !p.getClientRects().length) continue;
        const rg = document.createRange(); rg.selectNodeContents(n); const rs = [...rg.getClientRects()]; if (!rs.length) continue;
        const left = Math.min(...rs.map(x => x.left)), right = Math.max(...rs.map(x => x.right)), top = Math.min(...rs.map(x => x.top)), bottom = Math.max(...rs.map(x => x.bottom));
        let box = p; while (box && getComputedStyle(box).display.startsWith('inline') && box.parentElement) box = box.parentElement; // a caixa a que o texto pertence
        const b = box.getBoundingClientRect();
        if ((right > b.right + 1.5 || left < b.left - 1.5 || bottom > b.bottom + 3 || top < b.top - 3) && !clips(box))
          bad.push(where + ': «' + n.nodeValue.trim().slice(0, 24) + '…» sai de ' + box.tagName + '.' + box.className + ' (' + Math.round(right - b.right) + ' px)');
      }
    };
    state.sceneries[0].main = true; // estrela e etiqueta de Localização Principal; «O cais» (3 Cenas) fica com a sugestão
    for (const t of TABS.map(x => x[0])){ activeTab = t; renderAll(); await W(30); scan('separador ' + t); }
    /* o que só se vê fora da visita (filtros, vistas, ampliação, painel): sem gravar nada, porque nada aqui chama save() */
    tourMode = false;
    viewFor().f = {char:'ch1', pov:'ch1', scenery:'sc1', st:'todo'}; viewFor().hidden.add('a3'); activeTab = 'board'; renderAll(); await W(30); scan('quadro com quatro filtros e um Arco recolhido');
    viewFor().f = {}; viewFor().hidden.clear();
    if (navMode() === 'rail'){ setNarrView('compact'); await W(30); scan('vista Compacta'); setZoom(.4); await W(30); scan('quadro a 40 %'); setZoom(1);
      setNarrView('list'); await W(30); scan('vista Lista no PC'); setNarrView('board'); await W(30); }
    for (const pv of ['overview', 'research', 'progress', 'calendar']){ filters.planView = pv; activeTab = 'plan'; renderAll(); await W(30); scan('Plano: ' + pv); }
    filters.calMode = 'agenda'; filters.calMonth = '2027-02'; renderAll(); await W(30); scan('calendário em Agenda'); filters.calMode = 'month'; renderAll(); await W(30); scan('calendário em Mês'); filters.calMode = null; filters.calMonth = null;
    ListUI.layout = 'rows'; for (const t of ['books', 'characters', 'arcs', 'sceneries', 'refs']){ activeTab = t; renderAll(); await W(30); scan('lista em linhas: ' + t); } ListUI.layout = 'cards';
    activeTab = 'board'; renderAll();
    locNudge(state.sceneries.find(x => sceneryScenes(x.id).length === 3) || state.sceneries[2]); scan('sugestão de Localização Principal'); document.querySelectorAll('.toast').forEach(x => x.remove());
    snack(LONG); scan('barra com Anular'); document.querySelectorAll('.toast').forEach(x => x.remove());
    Coach.seen = {}; Coach.last = 0; coach('qa', LONG); scan('dica'); document.querySelectorAll('.coach').forEach(x => x.remove()); Coach.last = Infinity;
    Tour.paused = {kind:'basic', i:9, n:32}; tourPausedUI(); scan('visita em pausa'); Tour.paused = null; tourPausedUI();
    if (navMode() === 'rail' && innerWidth >= 1100){ Dock.on = true; openSceneFicha('s2'); await W(40); scan('ficha ao lado'); openCharFicha('ch1'); await W(40); scan('ficha ao lado, por cima'); closeAllModals(); Dock.on = false; }
    { const fid = 'pqa' + Date.now().toString(36); localStorage.setItem(projKey(fid), JSON.stringify(state)); Projects.idx.open.push(fid); projMeta(fid).name = LONG;
      importDialog('characters'); await W(40); scan('importar de outro projeto'); closeAllModals(); Projects.idx.open.pop(); localStorage.removeItem(projKey(fid)); }
    { const L = document.querySelector('#landing'), rec = Projects.idx.recent; Projects.idx.recent = [projActive()]; L.hidden = false; renderLanding(L); await W(30); scan('página inicial com silhueta'); L.hidden = true; L.innerHTML = ''; Projects.idx.recent = rec; }
    tourMode = true;
    activeTab = 'board'; renderAll();
    const fichas = [['Cena', () => openSceneFicha('s2')], ['Tomo', () => openBookFicha('b1')], ['Arco Narrativo', () => openArcFicha('a3')], ['Personagem', () => openCharFicha('ch1')], ['Localização', () => openSceneryFicha('sc1')],
      ['Link', () => openRefFicha('rx')], ['Nota', () => openRefFicha('ry')], ['apoio', () => openSupportFicha('Analepse')], ['nova Referência', () => newRefDialog(null)], ['confirmação', () => { askDeleteBook('b1'); }], ['guardar como app', installHelp],
      ['pesquisa', () => openSearch('farol')], ['pesquisa sem resultados', () => openSearch(long)], ['pesquisa nos Materiais de Apoio', () => openSearch('', 'support')], ['atalhos', shortcutsSheet], ['modelos', templateDialog],
      ['apoio com nome original', () => openSupportFicha('Jornada do Herói') || openSupportFicha(SUPPORT[6].groups[0].items[2].n)], ['filtrar por Personagem', () => pickOne(_('Filtrar por Personagem'), _('Pesquisar Personagens…'), [], () => {})]];
    for (const [nm, open] of fichas){ open(); await W(40); scan('ficha ' + nm); closeAllModals(); }
    const sc = document.querySelector('.scene'); const r = sc.getBoundingClientRect(); boardMenu(sc, r.left + 10, r.top + 10); scan('menu'); closeMenu();
    toast(LONG); scan('aviso'); document.querySelectorAll('.toast').forEach(x => x.remove());
    Dual.role = 'second'; Dual.ch = Dual.ch || {postMessage(){}}; syncDualUI(); scan('barra do segundo ecrã'); Dual.role = 'main'; syncDualUI();
    tourMode = false; startTour(); for (let i = 0; i < Tour.steps.length; i++){ Tour.i = i; showTourStep(); await W(20); scan('visita ' + i); const pr = document.querySelector('#tourPop').getBoundingClientRect(); if (pr.left < -1 || pr.right > innerWidth + 1 || pr.top < -1 || pr.bottom > innerHeight + 1) bad.push('visita ' + i + ': o balão sai do ecrã'); } endTour(); tourMode = true;
    return [...new Set(bad)];
  })()`;
  for (const [w, hh] of [[360, 740], [740, 360], [820, 1180], [1366, 768]])
    await T('M12 textos dentro das caixas, sem deslizar para o lado, em ' + w + '×' + hh, async () => { flushSave(); const saved = localStorage.getItem(LS_KEY);
      const fr = h('iframe', {src:location.pathname, style:{position:'fixed', left:'0', top:'0', width:w + 'px', height:hh + 'px', border:'0', opacity:'0', pointerEvents:'none', zIndex:'-1'}}); document.body.append(fr);
      try { await new Promise((res, rej) => { fr.onload = res; setTimeout(() => rej(new Error('a janela de teste não carregou')), 8000); }); await W(150);
        const bad = await Promise.race([fr.contentWindow.eval(SCAN), W(60000).then(() => ['a medição não terminou em 60 s'])]); eq(bad.slice(0, 12), []); }
      finally { fr.remove(); localStorage.setItem(LS_KEY, saved); } });

  /* as outras línguas têm textos mais compridos: a mesma medição, no telemóvel ao alto e deitado e no PC, com a barra de baixo e a lateral inteiras */
  for (const l of ['en', 'es', 'fr']) for (const [w, hh] of [[390, 800], [740, 360], [1280, 800]])
    await T('M13 em ' + l.toUpperCase() + ' ' + w + '×' + hh + ': textos dentro das caixas e rótulos da navegação inteiros', async () => { flushSave(); const saved = localStorage.getItem(LS_KEY);
      localStorage.setItem(LS_LANG, l); const fr = h('iframe', {src:location.pathname, style:{position:'fixed', left:'0', top:'0', width:w + 'px', height:hh + 'px', border:'0', opacity:'0', pointerEvents:'none', zIndex:'-1'}}); document.body.append(fr);
      try { await new Promise((res, rej) => { fr.onload = res; setTimeout(() => rej(new Error('a janela de teste não carregou')), 8000); }); localStorage.setItem(LS_LANG, 'pt'); await W(150);
        const cw = fr.contentWindow; eq(cw.eval('LANG'), l); eq(cw.document.documentElement.lang.slice(0, 2), l);
        const cut = [...cw.document.querySelectorAll('#rail .nav-label, #bnav .nav-label, .rail-cap')].filter(e => e.getClientRects().length && e.scrollWidth > e.clientWidth + 1).map(e => e.textContent);
        eq(cut, [], 'rótulos cortados');
        const bad = await Promise.race([cw.eval(SCAN), W(60000).then(() => ['a medição não terminou em 60 s'])]); eq(bad.slice(0, 12), []); }
      finally { localStorage.setItem(LS_LANG, 'pt'); fr.remove(); localStorage.setItem(LS_KEY, saved); } });

  /* ---- N: defeitos encontrados na revisão do toque, do duplo ecrã e da sincronização ---- */
  await T('N01 toque longo e largar abre sempre o menu, em qualquer ponto de qualquer Cena, Capítulo ou Tomo', async () => { const f = fx(); const miss = [];
    const tryAt = async (get, frac, want) => { const el = get(), rc = el.getBoundingClientRect(), x = rc.left + rc.width * frac, y = rc.top + rc.height / 2;
      te('pointerdown', el, x, y); await W(430); te('pointerup', window, x, y); await W(20);
      if (modals().length || !menuLabels().includes(want)) miss.push(want + ' a ' + frac + ': ' + (modals().length ? 'pediu confirmação' : 'sem menu')); closeAllModals(); closeMenu(); renderAll(); settle(); suppressUntil = 0; };
    for (const fr of [.15, .6, .9]){ await tryAt(() => sceneEl(f.a1.id), fr, 'Eliminar Cena'); await tryAt(() => sceneEl(f.a2.id), fr, 'Eliminar Cena'); await tryAt(() => chHead(f.c1.id), fr, 'Eliminar Capítulo'); await tryAt(() => bkHead(f.B1.id), fr, 'Eliminar Tomo'); }
    eq(miss, []); eq(titles(), [[['a1', 'b1', 'a2'], ['a3']], [['b2', 'a4']]]); });
  await T('N02 clique longo com o rato, sem mover, não pede para mudar nada', async () => { const f = fx(); const el = sceneEl(f.b1.id), rc = el.getBoundingClientRect();
    pe('pointerdown', el, rc.right - 10, rc.top + 20); await W(430); ok(drag); pe('pointerup', window, rc.right - 10, rc.top + 20); await W(30); eq(modals().length, 0); eq(menuLabels(), []); eq(titles()[0][0], ['a1', 'b1', 'a2']); });
  await T('N03 escolher a convergência: deslocar o quadro ou mudar de janela não desiste; anular, a visita e Esc desistem', async () => { const f = fx(); commit(); addChapter(f.B1.id);
    beginPickLink(f.a4.id); window.dispatchEvent(new PointerEvent('pointercancel', {pointerType:'touch'})); eq(pickLink, f.a4.id); window.dispatchEvent(new Event('blur')); eq(pickLink, f.a4.id);
    undo(); eq(pickLink, null); ok(!document.body.classList.contains('linking')); beginPickLink(f.a4.id); startTour(); eq(pickLink, null); endTour();
    beginPickLink(f.a4.id); setTab('books'); eq(pickLink, null); });
  await T('N04 um item de menu não é acionado pelo clique simulado ao levantar o dedo', async () => { const f = fx(); const el = sceneEl(f.a4.id), rc = el.getBoundingClientRect();
    te('pointerdown', el, rc.left + 20, rc.top + 20); await W(430); te('pointerup', window, rc.left + 20, rc.top + 20); await W(20);
    const del = [...document.querySelectorAll('.ctx-item')].find(x => x.textContent === 'Eliminar Cena'); del.click(); eq(modals().length, 0, 'ainda dentro do intervalo de proteção'); ok(document.querySelector('.ctx-menu'));
    suppressUntil = 0; del.click(); await W(20); ok(topModal() && topModal().textContent.includes('Eliminar a Cena «a4»?'), 'pede confirmação'); await answer(true); ok(!state.scenes[f.a4.id] && snackEl().textContent.includes('eliminada'), 'depois, avisa e oferece Anular'); });
  await T('N05 caneta: o botão lateral é um botão direito; a ponta comporta-se como o dedo', async () => { const f = fx(); const el = sceneEl(f.a1.id), rc = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, cancelable:true, clientX:rc.left + 5, clientY:rc.top + 5, button:2, pointerId:9, pointerType:'pen'})); eq(lastPtr, 'mouse'); pe('pointerup', window, rc.left + 5, rc.top + 5, 2); ctxAt(el); ok(menuLabels().includes('Eliminar Cena')); closeMenu();
    el.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, cancelable:true, clientX:rc.left + 5, clientY:rc.top + 5, button:0, pointerId:9, pointerType:'pen', isPrimary:true})); eq(lastPtr, 'touch'); cancelPress(); });
  await T('N06 outra janela importa ou começa um projeto novo: aqui já não se pode anular para trás desse ponto', async () => { const f = fx(); commit(); addChapter(f.B1.id); ok(Hist.undo.length > 0);
    const other = blankProject(); other.project.name = 'Importado lá'; localStorage.setItem(LS_RESET, 'x' + Date.now());
    window.dispatchEvent(new StorageEvent('storage', {key:LS_KEY, newValue:JSON.stringify(other)})); eq(state.project.name, 'Importado lá'); eq(Hist.undo.length, 0); ok($('#undoBtn').disabled);
    other.project.name = 'Editado lá'; window.dispatchEvent(new StorageEvent('storage', {key:LS_KEY, newValue:JSON.stringify(other)})); eq(Hist.undo.length, 1, 'as alterações seguintes voltam a poder ser anuladas');
    const before = knownReset; markReset(); ok(knownReset !== before && lsGet(LS_RESET) === knownReset); });
  await T('N07 duplo ecrã: ficha nova abre lá com o nome selecionado; um pedido não fecha o que está aberto antes de poder abrir', async () => { const f = fx(); const sent = []; Dual.post = m => sent.push(m);
    Dual.seen = Date.now(); const c = newCharacter(); commit(); openCharFicha(c.id, true); eq(sent.pop(), {t:'open', kind:'character', id:c.id, isNew:true}); openCharFicha(c.id); eq(sent.pop(), {t:'open', kind:'character', id:c.id});
    Dual.seen = 0; Dual.role = 'second'; dualOn({data:{t:'open', kind:'character', id:c.id, isNew:true}}); await W(80); const i = topModal().querySelector('input'); ok(document.activeElement === i && i.selectionEnd === i.value.length, 'nome selecionado'); closeAllModals();
    confirmDialog('pergunta em curso'); dualOn({data:{t:'open', kind:'scene', id:'não-existe'}}); await W(300); eq(modals().length, 1, 'a confirmação não foi fechada'); ok(topModal().textContent.includes('pergunta em curso'));
    dualOn({data:{t:'open', kind:'scene', id:f.a1.id}}); eq(modals().length, 1); ok(topModal().textContent.includes('Ficha da Cena')); closeAllModals();
    setFollow(false); dualOn({data:{t:'follow'}}); ok(Dual.follow, 'a janela principal pode voltar a ligar o segundo ecrã'); ssSet(SS_FOLLOW, '1'); });
  await T('N08 a visita só mostra os passos que existem neste dispositivo', async () => { startTour(); ok(Tour.steps.some(x => x.title === 'Dois ecrãs')); const n = Tour.steps.length; endTour();
    $('#dualBtn').hidden = true; startTour(); ok(!Tour.steps.some(x => x.title === 'Dois ecrãs')); eq(Tour.steps.length, n - 1); ok($('#tourPop .count').textContent.endsWith('/ ' + (n - 1)));
    Tour.i = Tour.steps.length - 1; showTourStep(); ok(btn('Concluir', $('#tourPop'))); endTour(); });
  await T('N09 o explicador de exemplo da visita não desaparece ao mexer o rato; o estado da gravação é lido por leitores de ecrã', async () => { startTour(); Tour.i = Tour.steps.findIndex(x => x.title === 'Explicadores'); showTourStep(); await W(40);
    document.body.dispatchEvent(new MouseEvent('mouseover', {bubbles:true})); ok($('#tip').classList.contains('on')); endTour(); ok(!$('#tip').classList.contains('on'));
    setSaveUI('fail'); const l = $('#saveState .lbl'); eq(l.textContent, 'Não guardado'); ok(getComputedStyle(l).display !== 'none', 'o texto não pode estar removido'); setSaveUI('ok'); });

  await T('N10 projeto em branco: a mensagem inicial fica dentro do Capítulo e nenhum nome do quadro aparece cortado', async () => { await W(20);
    const hint = document.querySelector('.board-hint'), ch = document.querySelector('.ch-body').getBoundingClientRect(), hr = hint.getBoundingClientRect();
    ok(hr.left >= ch.left && hr.right <= ch.right && hr.bottom <= ch.bottom, 'mensagem fora do Capítulo: ' + JSON.stringify([hr.left, hr.right, ch.left, ch.right])); ok(hr.right <= innerWidth, 'mensagem para lá do ecrã'); ok(hr.height < 100, 'mensagem com demasiadas linhas: ' + hr.height);
    const cut = [...document.querySelectorAll('.ch-name, .book-name')].filter(x => x.scrollWidth > x.clientWidth + 1).map(x => x.textContent); eq(cut, [], 'cortados no início');
    addChapter(state.books[0].id); addBook(); await W(20); eq([...document.querySelectorAll('.ch-name, .book-name')].filter(x => x.scrollWidth > x.clientWidth + 1).map(x => x.textContent), []);
    state.books.forEach(b => b.chapters = []); renderAll(); const h2 = document.querySelector('.board-hint'); ok(h2.textContent.startsWith('Crie um Capítulo'), 'texto sem Capítulos'); ok(h2.getBoundingClientRect().right <= innerWidth, 'sem Capítulos, para lá do ecrã'); });
  /* ---- O: cor dos Tomos ---- */
  await T('O01 cor do Tomo: escolher na ficha, ver no quadro, no separador Tomos e nas listas; anular', async () => { const f = fx(); histInit(); const ana = newCharacter('Ana'); f.a1.chars.push(ana.id); commit();
    openBookFicha(f.B1.id); const sws = [...topModal().querySelectorAll('.swatches .sw')]; eq(sws.length, BOOK_COLORS.length + 2); ok(sws[0].classList.contains('on'), 'sem cor, de início');
    ok(sws.every(s => tipFor(s)), 'cada amostra tem explicador'); ok(tipFor(topModal().querySelector('.field')), 'o campo tem explicador');
    const azul = sws.find(s => s.getAttribute('aria-label') === 'Azul'); azul.click(); eq(f.B1.color, '#539bf5'); eq(document.activeElement.getAttribute('aria-label'), 'Azul', 'o foco fica na amostra escolhida'); ok(topModal().querySelector('.sw[aria-label="Azul"]').classList.contains('on')); eq(topModal().querySelector('.sw[aria-label="Azul"]').getAttribute('aria-checked'), 'true');
    ok(topModal().querySelector('.modal-title .book-dot'), 'ponto no título da ficha'); closeAllModals();
    const hd = bkHead(f.B1.id); ok(hd.classList.contains('colored')); eq(hd.style.getPropertyValue('--book'), '#539bf5'); ok(document.querySelector('.book-col.colored')); ok(!bkHead(f.B2.id).classList.contains('colored'), 'o outro Tomo continua sem cor');
    eq(rgbOf(getComputedStyle(hd.querySelector('.book-name')).color).map(x => Math.round(x * 255)), rgbOf(getComputedStyle(document.body).color).map(x => Math.round(x * 255)), 'o texto não muda de cor');
    setTab('books'); const card = [...document.querySelectorAll('#view-page .card')].find(c => c.textContent.includes(f.B1.name)); eq(getComputedStyle(card.querySelector('.bar')).backgroundColor, 'rgb(83, 155, 245)');
    setTab('characters'); ok(document.querySelector('#view-page .book-list .book-dot'), 'ponto na lista de Tomos da Personagem');
    openCharFicha(ana.id); ok(topModal().querySelector('.list-row .book-dot')); closeAllModals();
    undo(); eq(state.books[0].color, null); redo(); eq(state.books[0].color, '#539bf5'); });
  await T('O02 cor personalizada e «sem cor»; valores inválidos são recusados ao importar', async () => { const f = fx();
    openBookFicha(f.B2.id); const nat = topModal().querySelector('input[type="color"]'); ok(nat && tipFor(nat.closest('.sw')));
    histInit(); const u0 = Hist.undo.length; for (const c of ['#111111', '#222222', '#123abc']){ nat.value = c; nat.dispatchEvent(new Event('input', {bubbles:true})); }
    eq(f.B2.color, null, 'arrastar no seletor só pré-visualiza'); eq(bkHead(f.B2.id).style.getPropertyValue('--book'), '#123abc'); eq(Hist.undo.length, u0);
    nat.dispatchEvent(new Event('change', {bubbles:true})); eq(f.B2.color, '#123abc'); eq(Hist.undo.length, u0 + 1, 'um só passo de anular');
    ok(document.activeElement === topModal().querySelector('.sw-native'), 'o foco fica no seletor'); eq(topModal().querySelector('.sw-native').getAttribute('aria-checked'), 'true');
    const other = topModal().querySelector('.sw.other'); ok(other.classList.contains('on')); eq(getComputedStyle(other).backgroundColor, 'rgb(18, 58, 188)'); eq(tipFor(other).title, 'Cor personalizada — clique para mudar');
    topModal().querySelector('.sw.none').click(); eq(f.B2.color, null); closeAllModals();
    const d = sanitize({books:[{id:'1', color:'red', chapters:[]}, {id:'2', color:'#ABCDEF', chapters:[]}, {id:'3', color:'#abc', chapters:[]}, {id:'4', chapters:[]}], scenes:{}});
    eq(d.books.map(b => b.color), [null, '#abcdef', null, null]); });
  await T('O03 a cor do Tomo fica guardada, aparece na visita e as amostras cabem na ficha', async () => { const f = fx(); f.B1.color = '#e5534b'; commit(); flushSave();
    const back = loadState(); eq(back.books[0].color, '#e5534b'); startTour(); ok(document.querySelector('.book-head.colored'), 'a demonstração tem Tomos com cor'); endTour();
    openBookFicha(f.B1.id); const sw = topModal().querySelector('.swatches'), r = sw.getBoundingClientRect(), m = topModal().getBoundingClientRect(); ok(r.right <= m.right && r.left >= m.left, 'as amostras cabem na ficha'); });
  await T('O04 as faixas das paletas nas Definições não são afetadas pelas amostras de cor', () => { setTab('settings'); const p = document.querySelector('.pal'), sw = p.querySelector('.sw');
    ok(sw.getBoundingClientRect().width > p.getBoundingClientRect().width - 30, 'faixa encolhida: ' + sw.getBoundingClientRect().width); eq(getComputedStyle(sw).boxShadow, 'none'); });
  await T('O05 cor do Tomo com o teclado: uma só paragem do Tab, setas para mudar', async () => { const f = fx(); openBookFicha(f.B1.id); const g = () => topModal().querySelector('.swatches');
    eq([...g().querySelectorAll('[role="radio"]')].filter(x => x.tabIndex === 0).length, 1); g().querySelector('[tabindex="0"]').focus();
    const key = k => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key:k, bubbles:true}));
    key('ArrowRight'); eq(f.B1.color, BOOK_COLORS[0][0]); eq(document.activeElement.getAttribute('aria-label'), BOOK_COLORS[0][1]);
    key('ArrowRight'); eq(f.B1.color, BOOK_COLORS[1][0]); key('ArrowLeft'); key('ArrowLeft'); eq(f.B1.color, null);
    key('ArrowLeft'); ok(document.activeElement.classList.contains('sw-native'), 'da primeira volta à última'); eq(f.B1.color, null, 'chegar a «Outra cor» não muda a cor'); });
  await T('O06 contraste do texto secundário sobre a cor do Tomo, em todas as paletas e cores', () => { const bad = [];
    const mix = (a, b, t) => a.map((x, i) => x * t + b[i] * (1 - t));
    for (const mode of ['dark', 'light']) for (let hue = 0; hue < 360; hue += 6){ const v = paletteVars({h:hue, mode}), t = parseFloat(v['--book-tint']) / 100, bg = rgbOf(v['--bg']), mu = rgbOf(v['--muted']);
      for (const c of [...BOOK_COLORS.map(x => x[0]), '#000000', '#ffffff']){ const x = contrast(mu, mix(rgbOf(c), bg, t)); if (x < 4.5) bad.push(mode + ' ' + hue + '° ' + c + ' ' + x.toFixed(2)); } }
    eq(bad.slice(0, 6), []); });
  await T('O07 nomes cortados no quadro aparecem inteiros no topo do menu; o quadro vazio não se redesenha por cima de um nome a ser editado', async () => { const f = fx();
    f.c2.name = 'y'.repeat(150); renderAll(); settle(); ctxAt(chHead(f.c2.id)); eq(document.querySelector('.ctx-head').textContent, 'y'.repeat(150)); ok(menuLabels().includes('Renomear Capítulo')); closeMenu();
    ctxAt(chHead(f.c1.id)); ok(!document.querySelector('.ctx-head'), 'nome inteiro: sem cabeçalho'); closeMenu();
    reset(); const bn = document.querySelector('.book-name'); bn.click(); ok(document.querySelector('#board .rename')); hintW = 1; window.dispatchEvent(new Event('resize')); await W(50);
    ok(document.querySelector('#board .rename'), 'o nome em edição continua'); });
  /* ---- P: sincronização entre dispositivos — o outro dispositivo é simulado, mensagem a mensagem ---- */
  const SECRET = b64(new Uint8Array(32).fill(7)), RID = 'b'.repeat(20);
  function fakeConn(from){ const ls = {}; return { peer:SYNC_PREFIX + (from || RID), metadata:{from:from || RID, boot:'r1'}, open:true, sent:[], closed:false,
    send(d){ this.sent.push(d); }, on(ev, f){ (ls[ev] = ls[ev] || []).push(f); }, emit(ev, x){ if (ev === 'data' && x && (x.t === 'head' || x.t === 'full') && !('pid' in x)) x = Object.assign({pid:projActive()}, x); (ls[ev] || []).forEach(f => f(x)); }, close(){ if (this.closed) return; this.closed = true; this.emit('close'); } }; }
  const fakePeer = () => ({ disconnected:false, destroyed:false, connect(){ return fakeConn(); }, reconnect(){}, destroy(){ this.destroyed = true; } });
  const take = (c, t) => { const i = c.sent.findIndex(m => m.t === t); return i < 0 ? null : c.sent.splice(i, 1)[0]; };
  async function linkUp(last){
    Sync.peer = fakePeer(); Sync.cfg.pairs = [{id:RID, name:'Telemóvel', secret:SECRET, lasts:last == null ? {} : {[projActive()]:last}, at:0}];
    const c = fakeConn(); syncAccept(c); c.emit('open'); const hi = take(c, 'hi'); ok(hi && hi.nonce, 'sem desafio');
    c.emit('data', {t:'proof', mac:await hmac(SECRET, hi.nonce + '|' + RID)}); await W(40);
    return { c, L:Sync.links.get(RID), head:take(c, 'head') };
  }
  const remoteProject = () => { const s = sanitize(JSON.parse(JSON.stringify(demoProjectMini()))); s.project.palette = state.project.palette; return s; };
  await T('P01 só se liga quem conhece a chave: prova errada, dispositivo desconhecido e mensagens antes da prova são recusados', async () => { fx(); commit();
    Sync.cfg.pairs = [{id:RID, name:'Telemóvel', secret:SECRET, lasts:{}, at:0}];
    const c1 = fakeConn('c'.repeat(20)); syncAccept(c1); c1.emit('open'); ok(c1.closed, 'desconhecido devia ser recusado'); ok(!Sync.links.has('c'.repeat(20)));
    const c2 = fakeConn(); syncAccept(c2); c2.emit('open'); const hi = take(c2, 'hi');
    c2.emit('data', {t:'full', data:remoteProject(), hash:'x', base:null, forced:true}); await W(30); eq(state.books[0].name, 'Tomo 1', 'nada passa antes da prova');
    c2.emit('data', {t:'hi', nonce:'abc'}); await W(30); eq(take(c2, 'proof').mac, await hmac(SECRET, 'abc|' + Sync.cfg.id), 'a minha prova');
    c2.emit('data', {t:'proof', mac:await hmac(b64(new Uint8Array(32).fill(9)), hi.nonce + '|' + RID)}); await W(30); ok(c2.closed && !Sync.links.get(RID), 'chave errada devia fechar');
    const {L, head} = await linkUp(); ok(L.authed); eq(head.hash, await projHash(state)); eq(head.blank, false); ok(head.sum.includes('Cena')); ok(!$('#syncBtn').hidden); eq($('#syncBtn').dataset.state, 'linked'); });
  await T('P02 decisões ao ligar: iguais; só eu mudei; só o outro mudou; projeto em branco recebe sem perguntar', async () => { fx(); commit(); const h0 = await projHash(state);
    let x = await linkUp(); x.c.emit('data', {t:'head', hash:h0, last:null, blank:false, name:'Telemóvel'}); await W(40); eq(lastOf(x.L.pr), h0); ok(x.L.synced); eq(x.c.sent.filter(m => m.t === 'full').length, 0); reset();
    fx(); commit(); x = await linkUp('base0'); x.c.emit('data', {t:'head', hash:'base0', last:'base0', blank:false}); await W(60); const full = take(x.c, 'full'); ok(full, 'só eu mudei: envio'); eq(full.hash, await projHash(state)); eq(full.base, 'base0');
    x.c.emit('data', {t:'ack', hash:full.hash}); await W(20); eq(lastOf(x.L.pr), full.hash); reset();
    fx(); commit(); const mine = await projHash(state); x = await linkUp(mine); const rp = remoteProject(), rh = await projHash(rp);
    x.c.emit('data', {t:'head', hash:rh, last:mine, blank:false}); await W(40); eq(x.c.sent.filter(m => m.t === 'full').length, 0, 'só o outro mudou: espero');
    x.c.emit('data', {t:'full', data:rp, hash:rh, base:mine}); await W(60); eq(state.project.name, 'Projeto de demonstração'); eq(take(x.c, 'ack').hash, rh); eq(lastOf(x.L.pr), rh);
    eq(JSON.parse(localStorage.getItem(LS_KEY)).project.name, 'Projeto de demonstração', 'fica gravado'); ok(JSON.parse(lsGet(LS_BACKUP)).data.books[0].chapters[0].name === 'C1', 'antes de substituir um projeto com conteúdo, guarda-se uma cópia'); reset();
    x = await linkUp(); const r2 = remoteProject(), h2 = await projHash(r2); x.c.emit('data', {t:'head', hash:h2, last:null, blank:false}); await W(40); eq(modals().length, 0, 'em branco: não pergunta');
    x.c.emit('data', {t:'full', data:r2, hash:h2, base:null}); await W(60); eq(Object.keys(state.scenes).length, 10); eq(lsGet(LS_BACKUP), null); });
  await T('P03 os dois mudaram: pergunta nos dois; escolher «deste dispositivo» envia esta versão; escolher a do outro espera por ela', async () => { fx(); commit();
    let x = await linkUp('base0'); x.c.emit('data', {t:'head', hash:'zz', last:'base0', blank:false, sum:'9 Tomos', at:Date.now()}); await W(60);
    ok(topModal() && topModal().textContent.includes('Versões diferentes') && topModal().textContent.includes('9 Tomos'));
    btn('Manter a deste dispositivo').click(); await W(60); eq(take(x.c, 'choose').keep, Sync.cfg.id); const f = take(x.c, 'full'); ok(f && f.forced); eq(modals().length, 0); reset();
    fx(); commit(); x = await linkUp('base0'); x.c.emit('data', {t:'head', hash:'zz', last:'base0', blank:false}); await W(60);
    btn('Manter a de «Telemóvel»').click(); await W(40); eq(take(x.c, 'choose').keep, RID); eq(x.c.sent.filter(m => m.t === 'full').length, 0);
    const mineName = state.books[0].name; const rp = remoteProject(), rh = await projHash(rp); x.c.emit('data', {t:'full', data:rp, hash:rh, base:'zz', forced:true}); await W(60);
    eq(state.project.name, 'Projeto de demonstração'); const bk = JSON.parse(lsGet(LS_BACKUP)); eq(bk.from, 'Telemóvel'); eq(bk.data.books[0].name, mineName, 'a versão posta de lado fica guardada');
    setTab('settings'); ok(btn('Repor a cópia de segurança', $('#view-page'))); syncRestoreBackup(); await W(30); await answer(true); eq(state.books[0].name, mineName); eq(JSON.parse(lsGet(LS_BACKUP)).data.project.name, 'Projeto de demonstração'); reset();
    fx(); commit(); x = await linkUp('base0'); x.c.emit('data', {t:'head', hash:'zz', last:'base0', blank:false}); await W(60); x.c.emit('data', {t:'choose', keep:Sync.cfg.id}); await W(60);
    eq(modals().length, 0, 'a escolha feita no outro fecha a pergunta aqui'); ok(take(x.c, 'full').forced); });
  await T('P04 ao vivo: cada alteração segue para o outro; o que chega do outro não volta para trás; alteração ao mesmo tempo pergunta', async () => { const f = fx(); commit(); const h0 = await projHash(state);
    const x = await linkUp(h0); x.c.emit('data', {t:'head', hash:h0, last:h0, blank:false}); await W(40); ok(x.L.synced);
    f.a1.title = 'Mudado aqui'; commit(); flushSave(); await W(650); const live = take(x.c, 'full'); ok(live && live.live, 'devia enviar'); eq(live.base, h0); eq(live.data.scenes[f.a1.id].title, 'Mudado aqui');
    x.c.emit('data', {t:'ack', hash:live.hash}); await W(20);
    const rp = JSON.parse(JSON.stringify(state)); rp.scenes[f.a2.id].title = 'Mudado lá'; const rh = await projHash(sanitize(JSON.parse(JSON.stringify(rp))));
    openSceneFicha(f.a2.id); x.c.emit('data', {t:'full', data:rp, hash:rh, base:live.hash, live:true}); await W(80);
    eq(state.scenes[f.a2.id].title, 'Mudado lá'); eq(modals().length, 1, 'a ficha aberta reabre'); eq(topModal().querySelector('input').value, 'Mudado lá'); closeAllModals();
    await W(650); eq(x.c.sent.filter(m => m.t === 'full').length, 0, 'não ecoa'); undo(); await W(650); ok(take(x.c, 'full'), 'anular também segue');
    x.c.emit('data', {t:'ack', hash:await projHash(state)}); await W(20);
    state.scenes[f.a3.id].title = 'Concorrente'; commit(); /* depois de anular, os objetos antigos já não fazem parte do projeto */ x.c.emit('data', {t:'full', data:rp, hash:rh, base:'outra', live:true}); await W(80); ok(topModal() && topModal().textContent.includes('Versões diferentes'), 'alteração ao mesmo tempo devia perguntar'); });
  await T('P05 ficheiros das Referências: pede os que faltam, envia só os do projeto, guarda os que chegam', async () => { fx(); commit();
    const r1 = {id:'rf1', type:'document', title:'Mapa', fileName:'mapa.pdf', mime:'application/pdf', size:3, links:[], created:1}; state.refs.push(r1); commit(); await idb.put('rf1', new Blob([new Uint8Array([1, 2, 3])], {type:'application/pdf'}));
    const h0 = await projHash(state); const x = await linkUp(h0);
    x.c.emit('data', {t:'need', ids:['rf1', 'naoexiste', 5]}); await W(80); const fl = x.c.sent.filter(m => m.t === 'file'); eq(fl.length, 1); eq(fl[0].id, 'rf1'); eq([...new Uint8Array(fl[0].buf)], [1, 2, 3]);
    await idb.del('rf1'); x.c.emit('data', {t:'head', hash:h0, last:h0, blank:false}); await W(80); eq(take(x.c, 'need').ids, ['rf1']);
    x.c.emit('data', {t:'file', id:'rf1', mime:'text/html', buf:new Uint8Array([9, 8]).buffer}); x.c.emit('data', {t:'file', id:'intruso', buf:new Uint8Array([1]).buffer}); await W(80);
    const b = await idb.get('rf1'); eq([...new Uint8Array(await b.arrayBuffer())], [9, 8]); eq(b.type, 'application/pdf', 'o tipo vem da Referência, nunca da mensagem'); eq(await idb.get('intruso'), undefined);
    x.c.emit('data', {t:'file', id:'rf1', buf:new Uint8Array([6]).buffer}); await W(60); eq((await idb.get('rf1')).size, 2, 'só se aceita um ficheiro pedido'); await idb.del('rf1'); });
  await T('P06 dados estranhos de um dispositivo emparelhado não rebentam nem injetam nada; projeto recebido durante a visita fica guardado à parte', async () => { fx(); commit();
    const x = await linkUp(); x.c.emit('data', null); x.c.emit('data', 'texto'); x.c.emit('data', {t:'full', data:{books:'x', scenes:7}, hash:'h1', base:null, forced:true}); await W(60);
    ok(Array.isArray(state.books) && typeof state.scenes === 'object', 'continua um projeto válido');
    x.c.emit('data', {t:'name', name:'<img src=x onerror=alert(1)>' + 'z'.repeat(200)}); await W(20); eq(Sync.cfg.pairs[0].name.length, 60); setTab('settings'); ok(!document.querySelector('.sync-card img'), 'o nome entra como texto');
    reset(); fx(); commit(); const y = await linkUp(); startTour(); const rp = remoteProject(), rh = await projHash(rp); y.c.emit('data', {t:'full', data:rp, hash:rh, base:null, forced:true}); await W(60);
    eq(state.project.name, 'Projeto de demonstração', 'a visita continua'); endTour(); eq(Object.keys(state.scenes).length, 10, 'no fim da visita, fica o projeto recebido'); });
  await T('P07 Enter que fecha uma janela não chega ao botão que recebe o foco; código de ligação inválido é recusado logo', async () => { fx();
    const p = promptDialog('T', 'E', 'abc'); const ev = new KeyboardEvent('keydown', {key:'Enter', bubbles:true, cancelable:true}); topModal().querySelector('input').dispatchEvent(ev); await p; ok(ev.defaultPrevented, 'promptDialog');
    const f = fx(); openSceneFicha(f.a1.id); btn('+ Associar Localização').click(); await W(20); const inp = topModal().querySelector('input'); inp.focus(); setInput(inp, 'Gruta'); await W(10);
    const ev2 = new KeyboardEvent('keydown', {key:'Enter', bubbles:true, cancelable:true}); inp.dispatchEvent(ev2); await W(20); ok(ev2.defaultPrevented, 'sugestões'); eq(state.sceneries.length, 1); closeAllModals();
    syncPairEnter(); await W(20); const ci = topModal().querySelector('input'); ci.value = 'OI01ZZ'; ci.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true, cancelable:true})); await W(30);
    ok([...document.querySelectorAll('.toast')].some(t => t.textContent.includes('Código inválido')), 'aviso'); eq(modals().length, 0); });
  await T('P08 Definições: cartão de sincronização, nome do dispositivo, desligar; aviso quando o outro desliga', async () => { fx(); const x = await linkUp(); setTab('settings');
    const card = $('.sync-card'); ok(card && card.textContent.includes('Telemóvel') && card.textContent.includes('Ligado agora'));
    const miss = [...card.querySelectorAll('button, .field')].filter(el => !tipFor(el)).map(el => el.textContent); eq(miss, []); ok(tipFor($('#syncBtn')));
    const ni = card.querySelector('input'); ni.value = 'O meu PC'; ni.dispatchEvent(new Event('change')); eq(Sync.cfg.name, 'O meu PC'); eq(take(x.c, 'name').name, 'O meu PC');
    btn('Deixar de sincronizar', $('.sync-card')).click(); await W(20); await answer(true); await W(400); eq(Sync.cfg.pairs.length, 0); ok(take(x.c, 'unpair'), 'o outro é avisado'); ok($('#syncBtn').hidden);
    const y = await linkUp(); y.c.emit('data', {t:'unpair'}); await W(30); eq(Sync.cfg.pairs.length, 0); ok([...document.querySelectorAll('.toast')].some(t => t.textContent.includes('deixou de sincronizar')));
    Sync.cfg.name = defaultDeviceName(); syncSave(); });
  await T('P09 dois dispositivos ligados ao mesmo tempo: fica uma só ligação; um dispositivo reaberto substitui a ligação antiga', async () => { fx(); commit();
    const x = await linkUp(); const c2 = fakeConn(); c2.metadata.boot = 'r1'; syncAccept(c2); c2.emit('open');
    ok(Sync.links.get(RID).conn === c2 && x.c.closed, 'o outro voltou a ligar-se na mesma sessão: desistiu da anterior, fica a nova'); take(c2, 'hi');
    const x2 = Sync.links.get(RID); c2.emit('data', {t:'proof', mac:await hmac(SECRET, x2.nonce + '|' + RID)}); await W(40); ok(x2.authed);
    const c3 = fakeConn(); c3.metadata.boot = 'r2'; syncAccept(c3); c3.emit('open'); const hi = take(c3, 'hi'); ok(Sync.links.get(RID) === x2, 'até provar, a antiga continua');
    c3.emit('data', {t:'proof', mac:await hmac(SECRET, hi.nonce + '|' + RID)}); await W(40); ok(Sync.links.get(RID).conn === c3, 'reaberto: a nova substitui'); ok(c2.closed); });
  await T('P10 partilha e instalação: etiquetas para o WhatsApp, ícones e manifesto', async () => { const og = p => (document.querySelector('meta[property="' + p + '"]') || {}).content;
    ok(/^https:\/\/.+\/icons\/og-image\.png$/.test(og('og:image'))); eq([og('og:image:width'), og('og:image:height'), og('og:image:type')], ['1200', '630', 'image/png']); ok(og('og:title') && og('og:description'));
    const img = await fetch('icons/og-image.png'); ok(img.ok && (await img.blob()).size < 300 * 1024, 'imagem de partilha com menos de 300 KB');
    ok((await fetch($('link[rel="apple-touch-icon"]').href)).ok); const m = await (await fetch('manifest.webmanifest')).json(); eq(m.id, './'); ok(m.screenshots.length === 2 && m.icons.some(i => i.purpose === 'maskable')); });
  await T('P11 a configuração existe desde o início (reabrir no separador Definições não interrompe o arranque)', () => { ok(Sync.cfg && ID_RE.test(Sync.cfg.id)); activeTab = 'settings'; renderPage(); ok($('.sync-card')); ok(Hist.last !== null); });
  await T('P12 escolhas opostas feitas ao mesmo tempo: vale a do identificador menor, nos dois; sem espaço para a cópia, nada é substituído', async () => { fx(); commit();
    const lower = Sync.cfg.id < RID, x = await linkUp('base0'); x.c.emit('data', {t:'head', hash:'zz', last:'base0', blank:false}); await W(60);
    btn('Manter a deste dispositivo').click(); await W(60); take(x.c, 'choose'); const sentMine = !!take(x.c, 'full');
    x.c.emit('data', {t:'choose', keep:RID}); await W(60);
    const rp = remoteProject(), rh = await projHash(rp); const before = state.project.name; x.c.emit('data', {t:'full', data:rp, hash:rh, base:'zz', forced:true}); await W(60);
    if (lower){ ok(sentMine); eq(state.project.name, before, 'a escolha deste (identificador menor) prevalece: a versão do outro é ignorada'); }
    else { eq(state.project.name, 'Projeto de demonstração', 'a escolha do outro (identificador menor) prevalece'); }
    reset(); fx(); commit(); const y = await linkUp('base0'); const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, v){ if (k === LS_BACKUP) throw new Error('QuotaExceededError'); return setItem.call(this, k, v); };
    try { const rp2 = remoteProject(), rh2 = await projHash(rp2); const nm = state.books[0].name; y.c.emit('data', {t:'full', data:rp2, hash:rh2, base:'base0', forced:true}); await W(60);
      eq(state.books[0].name, nm, 'sem cópia de segurança, a versão daqui fica'); ok([...document.querySelectorAll('.toast')].some(t => t.textContent.includes('Não há espaço'))); eq(take(y.c, 'ack'), null); }
    finally { Storage.prototype.setItem = setItem; } });
  await T('P13 fechar a pergunta sem escolher põe a sincronização em pausa, com «Escolher a versão» nas Definições', async () => { fx(); commit();
    const x = await linkUp('base0'); x.c.emit('data', {t:'head', hash:'zz', last:'base0', blank:false, sum:'3 Tomos'}); await W(60); topModal().querySelector('.modal-head .modal-x').click(); await W(20);
    eq(syncState(), 'conflict'); eq($('#syncBtn').dataset.state, 'conflict'); state.scenes[Object.keys(state.scenes)[0]].title = 'Durante a pausa'; commit(); flushSave(); await W(650); eq(x.c.sent.filter(m => m.t === 'full').length, 0, 'em pausa, nada é enviado');
    setTab('settings'); const b = btn('Escolher a versão', $('.sync-card')); ok(b && tipFor(b)); b.click(); await W(20); ok(topModal().textContent.includes('3 Tomos')); btn('Manter a deste dispositivo').click(); await W(60); ok(take(x.c, 'full').forced); });
  await T('P14 ficheiro com tipo perigoso nunca se abre no browser; um projeto «Novo Projeto» com Tomos renomeados não conta como em branco', async () => {
    const r1 = {id:'rx1', type:'document', title:'Página', fileName:'p.html', mime:'image/png', size:5, links:[], created:1}; state.refs.push(r1); commit(); await idb.put('rx1', new Blob(['<script>x</script>'], {type:'text/html'}));
    openRefFicha('rx1'); await W(120); ok(!btn('Abrir', topModal()) || !/^Abrir$/.test(btn('Abrir', topModal()).textContent), 'não deve haver «Abrir»'); ok(btn('Descarregar', topModal()));
    const a = [...topModal().querySelectorAll('a.btn')].find(x => x.textContent === 'Descarregar'); const served = await (await fetch(a.href)).blob(); eq(served.type, 'application/octet-stream'); closeAllModals(); await idb.del('rx1');
    const s = blankProject(); ok(isBlankProject(s)); s.books[0].name = 'O meu romance'; ok(!isBlankProject(s)); const s2 = blankProject(); s2.project.name = 'Saga'; ok(!isBlankProject(s2)); });
  await T('P15 dispositivos em projetos diferentes: a sincronização espera e oferece receber o projeto do outro', async () => { fx(); commit(); flushSave();
    const x = await linkUp(); const mine = projActive();
    x.c.emit('data', {t:'head', pid:'pOutroProj01', pname:'Romance do telemóvel', hash:'zz', last:null, blank:false}); await W(60);
    eq(syncState(), 'other'); eq(x.c.sent.filter(m => m.t === 'full').length, 0, 'nada é enviado'); setTab('settings');
    const b = btn('Abrir «Romance do telemóvel» neste dispositivo', $('.sync-card')); ok(b, 'botão para receber'); b.click(); await W(30); eq(take(x.c, 'want').pid, 'pOutroProj01');
    const rp = remoteProject(); rp.project.name = 'Romance do telemóvel'; const rh = await projHash(rp);
    x.c.emit('data', {t:'full', pid:'pOutroProj01', want:true, data:rp, hash:rh, base:null}); await W(120);
    eq(projActive(), 'pOutroProj01'); eq(state.project.name, 'Romance do telemóvel'); ok(Projects.idx.open.includes(mine), 'o projeto que estava aberto continua aberto');
    const ack = x.c.sent.filter(m => m.t === 'ack').pop(); eq(ack && ack.hash, rh);
    x.c.emit('data', {t:'full', pid:'pIntruso0001', data:rp, hash:rh, base:null, forced:true}); await W(60); ok(!Projects.idx.open.includes('pIntruso0001'), 'um projeto não pedido não entra');
    projSwitch(mine); await W(60); const hd = x.c.sent.filter(m => m.t === 'head').pop(); eq(hd.pid, mine, 'ao mudar de projeto, avisa o outro'); });
  /* ---- U: atualizações automáticas (o site é simulado: a ferramenta pergunta a versão e recebe a que o teste quiser) ---- */
  async function withRemote(version, fn){
    const f0 = window.fetch, r0 = Upd.reload, h0 = Upd.hidden, gr = navigator.serviceWorker && navigator.serviceWorker.getRegistration; let reloads = 0;
    window.fetch = (u, o) => /js\/version\.js/.test(String(u)) ? Promise.resolve(new Response('self.APP_RELEASE = ' + JSON.stringify({version, date:'2030-01-01', notes:'Coisas novas.'}) + ';')) : f0(u, o);
    Upd.reload = () => { reloads++; }; Upd.hidden = () => false; // o browser de testes sem interface diz que a página está escondida
    if (gr) navigator.serviceWorker.getRegistration = () => Promise.resolve(null);
    try { await fn(() => reloads); } finally { window.fetch = f0; Upd.reload = r0; Upd.hidden = h0; if (gr) navigator.serviceWorker.getRegistration = gr; clearInterval(Upd.waitI); try { sessionStorage.removeItem(SS_UPDATED); } catch (e) {} }
  }
  await T('U01 versões: comparação número a número e leitura do ficheiro publicado', async () => {
    eq([verCmp('1.10.0', '1.9.9'), verCmp('1.7', '1.7.0'), verCmp('1.7.0', '1.7.1'), verCmp('2', '1.99')], [1, 0, -1, 1]);
    const txt = await (await fetch('js/version.js', {cache:'no-store'})).text(); const rel = parseRelease(txt); eq(rel.version, Upd.cur); eq(rel.version, self.APP_RELEASE.version);
    eq(parseRelease('self.APP_RELEASE = {"version":"x"};'), null); eq(parseRelease('<html>'), null); });
  await T('U02 versão mais recente: nada muda; versão nova com instalação automática: espera por um momento livre e só então atualiza', async () => { const f = fx();
    await withRemote(Upd.cur, async n => { await updCheck(true); eq(Upd.state, 'current'); eq(n(), 0); ok([...document.querySelectorAll('.toast')].some(t => t.textContent.includes('mais recente'))); });
    await withRemote('99.0.0', async n => {
      openSceneFicha(f.a1.id); await updCheck(false); eq(Upd.state, 'ready'); ok($('#updBtn').hidden, 'automático: sem botão'); await W(1700); eq(n(), 0, 'com uma ficha aberta não atualiza');
      closeAllModals(); Upd.lastInput = Date.now(); await W(1700); eq(n(), 0, 'acabou de mexer: ainda espera');
      f.a1.title = 'Por gravar'; save(); Upd.lastInput = Date.now() - 10000; await W(1700); eq(n(), 1, 'momento livre: atualiza');
      eq(JSON.parse(localStorage.getItem(LS_KEY)).scenes[f.a1.id].title, 'Por gravar', 'grava antes de recarregar'); eq(ssGet(SS_UPDATED), '99.0.0'); eq(updCfg().tried, '99.0.0'); }); });
  await T('U03 instalação automática desligada: aparece «Atualizar» e é o utilizador que escolhe; uma atualização que não chegou não entra em ciclo', async () => {
    updSet({auto:false});
    await withRemote('99.0.0', async n => { await updCheck(false); ok(!$('#updBtn').hidden, 'botão na barra de topo'); ok(tipFor($('#updBtn'))); Upd.lastInput = 0; await W(1700); eq(n(), 0);
      setTab('settings'); const card = $('.upd-card'); ok(card.textContent.includes('99.0.0') && card.textContent.includes('Coisas novas')); ok(!card.querySelector('input[type=checkbox]').checked);
      eq([...card.querySelectorAll('button, .switch-wrap')].filter(el => !tipFor(el)).map(el => el.textContent), []);
      btn('Atualizar agora', card).click(); eq(n(), 1); });
    updSet({auto:true, tried:'99.0.0', triedAt:Date.now()});
    await withRemote('99.0.0', async n => { await updCheck(false); Upd.lastInput = 0; await W(1700); eq(n(), 0, 'já tentada há pouco: não volta a recarregar sozinha'); ok(!$('#updBtn').hidden, 'fica o botão'); });
    updSet({tried:'99.0.0', triedAt:Date.now() - 2 * 3600000});
    await withRemote('99.0.0', async n => { await updCheck(false); Upd.lastInput = 0; await W(1700); eq(n(), 1, 'passada uma hora, tenta outra vez'); }); });
  await T('U04 sem internet ou com o site em baixo: não rebenta nem recarrega; durante a visita nunca atualiza', async () => {
    const f0 = window.fetch; window.fetch = () => Promise.reject(new Error('rede')); try { await updCheck(true); eq(Upd.state, 'error'); ok([...document.querySelectorAll('.toast')].some(t => t.textContent.includes('Não foi possível procurar'))); } finally { window.fetch = f0; }
    await withRemote('99.0.0', async n => { startTour(); await updCheck(false); Upd.lastInput = 0; await W(1700); eq(n(), 0); endTour(); await W(1700); eq(n(), 1, 'no fim da visita, atualiza'); }); });
  await T('U06 página escondida (a app noutra janela ou o telemóvel bloqueado): atualiza sem esperar', async () => { await withRemote('99.0.0', async n => { Upd.hidden = () => true; Upd.lastInput = Date.now(); await updCheck(false); await W(300); eq(n(), 1); }); });
  await T('U05 depois de atualizar, avisa uma vez com a versão nova', async () => { ssSet(SS_UPDATED, Upd.cur); updSet({tried:Upd.cur, triedAt:Date.now()}); initUpdate(); await W(800);
    ok([...document.querySelectorAll('.toast')].some(t => t.textContent.includes('atualizada para a versão ' + Upd.cur))); eq(ssGet(SS_UPDATED), null); eq(updCfg().tried, null); });
  /* ---- V: vários projetos, página inicial, Nova Nota rápida, visitas ---- */
  const answerBtn = async label => { await W(20); const b = btn(label, topModal()); ok(b, 'sem botão ' + label); b.click(); await W(40); };
  await T('V01 o projeto da versão anterior continua onde estava e passa a ser um projeto aberto, já como guardado; projetos fora do índice voltam a ele', () => {
    const keepIdx = lsGet(LS_PROJ), old = demoProjectMini(); old.project.name = 'Antigo';
    try { localStorage.setItem(LEGACY_KEY, JSON.stringify(old)); localStorage.setItem('narrativa.p.pSolto0001', JSON.stringify(blankProject()));
      const idx = projRepair(null); ok(idx.open.includes(LEGACY_ID) && idx.open.includes('pSolto0001')); eq(idx.meta[LEGACY_ID].name, 'Antigo'); eq(idx.meta[LEGACY_ID].dirty, false);
      eq(projKey(LEGACY_ID), LEGACY_KEY, 'sem cópia: nada pode falhar por falta de espaço'); ok(localStorage.getItem(LEGACY_KEY), 'continua lá'); }
    finally { localStorage.removeItem(LEGACY_KEY); localStorage.removeItem('narrativa.p.pSolto0001'); localStorage.setItem(LS_PROJ, keepIdx); } });
  await T('V02 seletor na barra de topo: lista os abertos, muda de projeto e guarda o anular de cada um', async () => { const f = fx(); commit(); flushSave(); const p1 = projActive(); histInit();
    f.a1.title = 'Mudado no 1'; commit(); flushSave(); newProject(); await W(20); const p2 = projActive(); state.project.name = 'Segundo'; commit(); flushSave();
    ok(tipFor($('#projBtn'))); $('#projBtn').click(); await W(20); const menu = document.querySelector('.proj-menu'); ok(menu, 'menu');
    const items = [...menu.querySelectorAll('.proj-item')]; eq(items.length, 2); ok(items[1].classList.contains('on')); ok(menuLabels().includes('Guardar Projeto') && menuLabels().includes('Fechar Projeto'));
    eq([...menu.querySelectorAll('.ctx-item')].filter(el => !tipFor(el)).map(el => el.textContent), []);
    items[0].closest('.ctx-item').click(); await W(20); eq(projActive(), p1); eq(state.scenes[f.a1.id].title, 'Mudado no 1'); undo(); eq(state.scenes[f.a1.id].title, 'a1', 'o anular deste projeto continua cá');
    eq(document.title, state.project.name + ' — Narrative'); ok($('#projBtn').classList.contains('dirty'), '● alterações por guardar');
    projSwitch(p2); eq(state.project.name, 'Segundo'); eq(JSON.parse(localStorage.getItem(LS_KEY)).project.name, 'Segundo'); });
  await T('V03 Guardar Projeto tira o ●; Fechar pergunta só com alterações; Cancelar, Fechar sem guardar, recentes e página inicial', async () => { const f = fx(); commit(); flushSave(); const p1 = projActive();
    const oc = URL.createObjectURL, ac = HTMLAnchorElement.prototype.click; let saved = 0; URL.createObjectURL = () => 'blob:x'; HTMLAnchorElement.prototype.click = function(){ saved++; };
    try { ok(projMeta(p1).dirty); ok(await exportProject()); eq(saved, 1); ok(!projMeta(p1).dirty && !$('#projBtn').classList.contains('dirty'));
      closeProject(); await W(30); eq(modals().length, 0, 'sem alterações: fecha sem perguntar'); ok(projNone()); ok(!$('#landing').hidden, 'página inicial'); eq(Projects.idx.recent, [p1]);
      ok($('#landing').textContent.includes('Projetos recentes')); ok($('#landing .land-thumb'), 'silhueta do projeto'); btn('Continuar', $('#landing')).click(); await W(30); eq(projActive(), p1); eq(state.scenes[f.a1.id].title, 'a1'); ok($('#landing').hidden);
      f.a1.title = 'x'; state.scenes[f.a1.id].title = 'Alterado'; commit(); flushSave(); ok(projMeta(p1).dirty);
      setTab('settings'); btn('Fechar Projeto', $('#view-page')).click(); await W(30); ok(topModal().textContent.includes('Quer guardar'));
      await answerBtn('Cancelar'); eq(projActive(), p1, 'cancelar: continua aberto');
      closeProject(); await answerBtn('Guardar e fechar'); eq(saved, 2, 'guardou'); ok(projNone());
      projReopen(p1); state.scenes[f.a1.id].title = 'De novo'; commit(); flushSave(); closeProject(); await W(20); ok(topModal().textContent.includes('serão perdidas'), 'avisa que se perdem'); await answerBtn('Fechar sem guardar'); ok(projNone()); eq(saved, 2);
      projReopen(p1); eq(state.scenes[f.a1.id].title, 'Alterado', 'fechar sem guardar volta à versão guardada'); }
    finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ac; } });
  await T('V04 Abrir Projeto abre como mais um projeto; o mesmo projeto pergunta se substitui; Referências repetidas ganham identificador novo', async () => { const f = fx(); commit(); flushSave(); const p1 = projActive();
    await addFilesAsRefs([new File(['um'], 'a.txt', {type:'text/plain'})], null); await W(50); const rid = state.refs[0].id; flushSave();
    const blob = await projFileData(); const text = await blob.text();
    const other = JSON.parse(text); other.pid = 'pFicheiro001'; other.project.name = 'Do ficheiro'; other.files[rid] = 'data:text/plain;base64,ZG9pcw==';
    await importProject(new File([JSON.stringify(other)], 'o.narrativa.json')); await W(60);
    eq(projActive(), 'pFicheiro001'); eq(Projects.idx.open, [p1, 'pFicheiro001'], 'o atual continua aberto'); ok(!projMeta('pFicheiro001').dirty, 'acabado de abrir: nada por guardar');
    const nr = state.refs[0].id; ok(nr !== rid, 'identificador novo'); eq(await (await idb.get(nr)).text(), 'dois'); eq(await (await idb.get(rid)).text(), 'um', 'o ficheiro do outro projeto fica intacto');
    projSwitch(p1); state.scenes[f.a1.id].title = 'Depois de guardar'; commit(); flushSave();
    const p = importProject(new File([text], 'p.narrativa.json')); await W(60); ok(topModal().textContent.includes('já está aberto')); await answer(false); await p; eq(state.scenes[f.a1.id].title, 'Depois de guardar', 'cancelar: fica o que está aberto');
    const p2 = importProject(new File([text], 'p.narrativa.json')); await W(60); await answer(true); await p2; eq(state.scenes[f.a1.id].title, 'a1', 'substituído pelo ficheiro'); eq(Projects.idx.open.length, 2);
    await purgeOrphanFiles(); ok(await idb.get(nr) && await idb.get(rid), 'os ficheiros de todos os projetos ficam'); });
  await T('V05 página inicial: três sugestões com explicador, sem separadores; a visita parte dela e volta a ela', async () => { closeProject(); await W(20); if (modals().length) await answerBtn('Fechar sem guardar');
    ok(projNone()); const L = $('#landing'); ok(!L.hidden && document.body.classList.contains('no-project')); eq(getComputedStyle($('#rail')).display, 'none'); ok($('#projBtn').hidden);
    const cards = [...L.querySelectorAll('.land-card')].map(c => c.querySelector('.land-t').textContent); eq(cards, ['Criar novo Projeto', 'Abrir Projeto', 'Correr visita guiada', 'Começar com um exemplo', 'Começar de um modelo']);
    eq([...L.querySelectorAll('button')].filter(b => !tipFor(b)).map(b => b.textContent), []);
    commit(); flushSave(); eq(LS_KEY, null, 'nada é gravado sem projeto');
    L.querySelectorAll('.land-card')[2].click(); await W(30); ok(Tour.active && L.hidden && !$('#projBtn').hidden); endTour(); await W(20); ok(!L.hidden && projNone());
    L.querySelectorAll('.land-card')[0].click(); await W(30); ok(!projNone() && L.hidden); eq(Object.keys(state.scenes).length, 0); });
  /* a ferramenta numa janela de telemóvel (mesma origem: partilha o projeto guardado) */
  const phone = async (w, hh, fn) => { flushSave(); const saved = localStorage.getItem(LS_KEY); ssSet(SS_TAB, 'board'); lsSet(LS_TOUR, '1');
    const fr = h('iframe', {src:location.pathname, style:{position:'fixed', left:'0', top:'0', width:w + 'px', height:hh + 'px', border:'0', zIndex:'99999', background:'#fff'}}); document.body.append(fr);
    try { await new Promise((res, rej) => { fr.onload = res; setTimeout(() => rej(new Error('a janela de teste não carregou')), 8000); }); await W(300); await fn(fr.contentWindow, fr.contentDocument); }
    finally { fr.remove(); localStorage.setItem(LS_KEY, saved); } };
  await T('V06 botão Criar flutuante: só no telemóvel, com a barra de baixo; abre a folha Criar, com a Nota primeiro', async () => { fx(); commit(); fabUI(); ok($('#createFab').hidden, 'no PC, o Criar está na barra lateral');
    await phone(360, 740, async (w, d) => { const E = x => w.eval(x), b = d.querySelector('#createFab'); ok(!b.hidden, 'visível'); ok(w.tipFor(b));
      const rc = b.getBoundingClientRect(), nav = d.querySelector('#bnav').getBoundingClientRect(); ok(rc.width >= 48 && rc.right <= 360 && rc.bottom <= nav.top, 'por cima da barra de baixo');
      b.click(); await W(30); eq([...d.querySelectorAll('.create-grid button')].map(x => x.textContent), ['Nota', 'Cena', 'Capítulo', 'Tomo', 'Arco Narrativo', 'Personagem', 'Localização', 'Referência', 'Objetivo de pesquisa']); ok(b.hidden, 'escondido com a folha aberta');
      [...d.querySelectorAll('.create-grid button')].forEach(x => ok(w.tipFor(x), 'sem explicador: ' + x.textContent));
      d.querySelector('.create-grid button').click(); await W(60); eq(E('state.refs[state.refs.length - 1].type'), 'note'); ok(d.querySelector('.modal').textContent.includes('Associada a'));
      eq(d.activeElement, d.querySelector('.modal input'), 'pronta a escrever'); w.closeAllModals(); ok(!b.hidden);
      w.setTab('settings'); ok(b.hidden, 'nas Definições não aparece'); }); });
  await T('V07 visitas: a principal cobre projetos e Notas e oferece a detalhada; a detalhada tem alvo em todos os passos', async () => {
    const titlesB = TOUR_STEPS.map(s => s.title); ['Projetos', 'Notas', 'Tomos', 'Cenas', 'Arcos Narrativos e Ramos', 'Convergências', 'Definições do Projeto', 'Telemóvel e PC sincronizados'].forEach(t => ok(titlesB.includes(t), 'falta ' + t));
    startTour(); Tour.i = Tour.steps.length - 1; showTourStep(); const deepBtn = btn('Fazer a visita detalhada', $('#tourPop')); ok(deepBtn && tipFor(deepBtn)); deepBtn.click(); await W(40);
    ok(Tour.active && Tour.kind === 'deep'); const missing = [];
    for (let i = 0; i < Tour.steps.length; i++){ Tour.i = i; showTourStep(); await W(40); const st = Tour.steps[i]; if (st.sel){ const el = document.querySelector(st.sel); if (!el || !el.getClientRects().length) missing.push(st.title); } }
    eq(missing, [], 'passos sem alvo'); ok(Tour.steps.length >= 15); btn('Concluir', $('#tourPop')).click(); await W(20); ok(!Tour.active && !tourMode); });
  await T('V08 outra janela muda de projeto: esta acompanha; o aviso ao sair só com alterações por guardar', async () => { fx(); commit(); flushSave(); const p1 = projActive();
    newProject(); await W(20); const p2 = projActive(); projSwitch(p1);
    const other = JSON.parse(lsGet(LS_PROJ)); other.active = p2; localStorage.setItem(LS_PROJ, JSON.stringify(other));
    window.dispatchEvent(new StorageEvent('storage', {key:LS_PROJ, newValue:JSON.stringify(other)})); eq(projActive(), p2); eq(LS_KEY, projKey(p2));
    projSwitch(p1); ok(projMeta(p1).dirty); const ev = new Event('beforeunload', {cancelable:true}); window.dispatchEvent(ev); ok(ev.defaultPrevented, 'pergunta antes de sair');
    lsSet(LS_LEAVE, '0'); const ev2 = new Event('beforeunload', {cancelable:true}); window.dispatchEvent(ev2); ok(!ev2.defaultPrevented, 'opção desligada'); lsSet(LS_LEAVE, '1');
    Projects.leaving = true; const ev3 = new Event('beforeunload', {cancelable:true}); window.dispatchEvent(ev3); ok(!ev3.defaultPrevented, 'a atualização automática não pergunta'); Projects.leaving = false; });
  await T('V09 emparelhar guarda a ligação já por projeto; dispositivo da versão anterior só sincroniza o projeto que ela conhece', async () => { fx(); commit();
    syncAddPair({id:RID, name:'Novo', secret:SECRET}); ok(Sync.cfg.pairs[0].lasts && lastOf(Sync.cfg.pairs[0]) === null, 'sem erro'); Sync.cfg.pairs = [];
    const x = await linkUp(); x.c.emit('data', {t:'head', pid:undefined, hash:'zz', last:null, blank:false}); await W(60); eq(syncState(), 'other', 'outro projeto: espera');
    const rp = remoteProject(), rh = await projHash(rp); x.c.emit('data', {t:'full', pid:undefined, data:rp, hash:rh, base:null, forced:true}); await W(60); ok(state.project.name !== 'Projeto de demonstração', 'não entra noutro projeto'); });
  await T('V10 os recentes nunca perdem um projeto com alterações por guardar; abrir um ficheiro de um projeto recente pergunta', async () => { fx(); commit(); flushSave();
    const I = Projects.idx, first = projActive();
    for (let i = 0; i < 9; i++) I.recent.push('pRecente' + i + 'xx'); I.recent.forEach(id => { projMeta(id).dirty = false; localStorage.setItem(projKey(id), JSON.stringify(blankProject())); });
    I.recent.push('pSujo00001'); projMeta('pSujo00001').dirty = true; localStorage.setItem(projKey('pSujo00001'), JSON.stringify(blankProject())); projSaveIdx();
    newProject(); await W(20); closeProject(); await W(30); ok(I.recent.includes('pSujo00001'), 'o projeto com alterações por guardar fica'); ok(!I.recent.includes('pRecente8xx'), 'os mais antigos sem alterações saem');
    projSwitch(first); state.scenes[Object.keys(state.scenes)[0]].title = 'Por guardar'; commit(); flushSave();
    const blob = await projFileData(); const text = await blob.text(); projMeta(first).savedSig = projSig(JSON.stringify(state)); projSnap(first, JSON.stringify(state)); projMeta(first).dirty = false; projSaveIdx();
    closeProject(); await W(30); ok(I.recent.includes(first));
    const p = importProject(new File([text], 'p.narrativa.json')); await W(60); ok(topModal().textContent.includes('projetos recentes')); await answer(false); await p;
    eq(projActive(), first, 'cancelar: reabre como estava'); eq(state.scenes[Object.keys(state.scenes)[0]].title, 'Por guardar');
    I.recent.filter(id => /^pRecente|^pSujo/.test(id)).forEach(id => { localStorage.removeItem(projKey(id)); }); I.recent = I.recent.filter(id => !/^pRecente|^pSujo/.test(id)); projSaveIdx(); });
  await T('V11 menu de projetos com o teclado: setas, Esc devolve o foco e aria-expanded; o mesmo clique fecha', async () => { fx(); newProject(); await W(20);
    $('#projBtn').click(); await W(20); const menu = document.querySelector('.proj-menu'); ok(menu); eq($('#projBtn').getAttribute('aria-expanded'), 'true'); eq(menu.querySelector('.ctx-item').getAttribute('role'), 'menuitem');
    const its = [...menu.querySelectorAll('.ctx-item')]; eq(document.activeElement, its[0]); menu.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowDown', bubbles:true})); eq(document.activeElement, its[1]);
    menu.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowUp', bubbles:true})); menu.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowUp', bubbles:true})); eq(document.activeElement, its[its.length - 1], 'dá a volta');
    menu.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true})); ok(!document.querySelector('.proj-menu')); eq($('#projBtn').getAttribute('aria-expanded'), 'false'); eq(document.activeElement, $('#projBtn'));
    $('#projBtn').click(); await W(20); ok(document.querySelector('.proj-menu')); $('#projBtn').dispatchEvent(new PointerEvent('pointerdown', {bubbles:true})); closeMenu(); $('#projBtn').click(); await W(20); ok(!document.querySelector('.proj-menu'), 'o clique que fecha não reabre'); });
  await T('V12 outra janela muda de projeto durante a visita: no fim, esta mostra o projeto certo; e uma edição pendente não se perde ao acompanhar outra janela', async () => { fx(); commit(); flushSave(); const p1 = projActive();
    newProject(); await W(20); const p2 = projActive(); projSwitch(p1); startTour();
    const other = JSON.parse(lsGet(LS_PROJ)); other.active = p2; localStorage.setItem(LS_PROJ, JSON.stringify(other)); window.dispatchEvent(new StorageEvent('storage', {key:LS_PROJ, newValue:JSON.stringify(other)}));
    endTour(); eq(LS_KEY, projKey(p2)); eq(projActive(), p2); ok(projAdd(blankProject()) !== null);
    projSwitch(p1); state.project.name = 'Escrito à pressa'; save(); const o2 = JSON.parse(lsGet(LS_PROJ)); o2.active = p2; localStorage.setItem(LS_PROJ, JSON.stringify(o2));
    window.dispatchEvent(new StorageEvent('storage', {key:LS_PROJ, newValue:JSON.stringify(o2)})); eq(projActive(), p2); eq(JSON.parse(localStorage.getItem(projKey(p1))).project.name, 'Escrito à pressa');
    eq(JSON.parse(lsGet(LS_PROJ)).active, p2, 'a gravação não desfaz a troca da outra janela'); });
  await T('V13 limpeza de ficheiros: um projeto guardado ilegível impede-a', async () => { fx(); await idb.put('rOrfao01', new Blob(['x'])); localStorage.setItem('narrativa.p.pPartido01', '{partido');
    try { await purgeOrphanFiles(); ok(await idb.get('rOrfao01'), 'nada apagado'); } finally { localStorage.removeItem('narrativa.p.pPartido01'); }
    await purgeOrphanFiles(); eq(await idb.get('rOrfao01'), undefined, 'sem projetos ilegíveis, o órfão sai'); });
  await T('V14 página inicial: sem aviso de rodar nem botão de sincronização', async () => { closeProject(); await W(20); if (modals().length) await answerBtn('Fechar sem guardar');
    Sync.cfg.pairs = [{id:RID, name:'T', secret:SECRET, lasts:{}, at:0}]; syncUI(); eq(getComputedStyle($('#syncBtn')).display, 'none'); Sync.cfg.pairs = []; syncUI(); ok($('#orientHint').hidden); });
  await T('W01 Materiais de Apoio: secção Pontuação com as fichas principais, pesquisa, itálico e ligações', async () => {
    const sec = SUPPORT.find(s => s.key === 'pontuacao'); ok(sec, 'secção'); const names = sec.groups.flatMap(g => g.items.map(i => i.n));
    ['Ponto final', 'Vírgula: princípios', 'Vírgula: quando não usar', 'Ponto e vírgula', 'Dois pontos', 'Reticências', 'Aspas', 'Travessão (incisos)', 'Pontuação do diálogo com travessão', 'Hífen, meia-risca e travessão', 'Erros frequentes de pontuação'].forEach(n => ok(names.includes(n), 'falta ' + n));
    ok(names.length >= 30); const bad = []; for (const g of sec.groups) for (const it of g.items){ if (!it.d || !it.u || !it.x || !it.x.length) bad.push(it.n); (it.s || []).forEach(r => { if (!supportIndex.has(r)) bad.push(it.n + ' → ' + r); }); }
    eq(bad, [], 'fichas incompletas ou ligações partidas');
    setTab('support'); const b = document.querySelector('.sup-nav button[data-sec="pontuacao"]'); ok(b, 'botão da secção'); b.click(); await W(30);
    ok($('#view-page').textContent.includes('Ponto e vírgula'));
    const search = $('#view-page input'); setInput(search, 'travessao'); await W(60); ok($('#view-page').textContent.includes('Pontuação do diálogo com travessão'), 'a pesquisa sem acentos encontra');
    openSupportFicha('Pensamentos e discurso interior'); await W(20); ok(topModal().querySelector('em'), 'itálico desenhado'); ok(!topModal().textContent.includes('*Não vou'), 'sem asteriscos à vista');
    const chip = [...topModal().querySelectorAll('.chip.click')].find(c => c.textContent === 'Discurso indireto livre'); ok(chip); chip.click(); await W(20); ok(topModal().textContent.includes('Discurso indireto livre'));
    closeAllModals(); openSupportFicha('Apóstrofo, barra e asterisco'); await W(20); ok(topModal().textContent.includes('* * *'), 'o asterisco isolado fica como está'); });
  await T('W02 Materiais de Apoio: Ortografia, Sintaxe, Estilos Narrativos e Escrita Antiga; nomes de Portugal; todas as fichas completas e ligadas', async () => {
    const sec = k => SUPPORT.find(s => s.key === k); eq(sec('figuras').name, 'Figuras de Estilo'); ok(sec('figuras').intro.includes('no Brasil, figuras de linguagem'));
    const names = k => sec(k).groups.flatMap(g => g.items.map(i => i.n));
    ['Regras de acentuação', 'Hífen com prefixos', 'Consoantes mudas', 'Confusões frequentes: porque, por que, porquê'].forEach(n => ok(names('ortografia').includes(n), 'falta ' + n));
    ['Funções sintáticas', 'Colocação dos pronomes', 'Tempos e modos: o conjuntivo', 'Regência verbal'].forEach(n => ok(names('sintaxe').includes(n), 'falta ' + n));
    ['Romantismo', 'Neorrealismo', 'Conto', 'Novela', 'Romance policial', 'Estilo sóbrio'].forEach(n => ok(names('estilos-narrativos').includes(n), 'falta ' + n));
    ['Ortografia pseudoetimológica (até 1911)', 'Reforma ortográfica de 1911', 'Acordo Ortográfico de 1945', 'Alterações de 1971 (Brasil) e 1973 (Portugal)', 'Acordo Ortográfico de 1990', 'Escrita antiga: português medieval', 'Que grafia usar em cada época'].forEach(n => ok(names('escrita-antiga').includes(n), 'falta ' + n));
    const all = new Set(); const bad = [];
    for (const s of SUPPORT) for (const g of s.groups) for (const it of g.items){ if (all.has(it.n)) bad.push('repetida: ' + it.n); all.add(it.n);
      if (!it.d || (!it.u && !it.f)) bad.push('incompleta: ' + it.n); (it.s || []).forEach(x => { if (!supportIndex.has(x)) bad.push(it.n + ' → ' + x); }); }
    eq(bad, []); ok(supportIndex.has('O que está em jogo') && supportIndex.has('Contrarrelógio') && supportIndex.has('Contraponto') && !supportIndex.has('Apostas'));
    setTab('support'); eq(document.querySelectorAll('.sup-nav button').length, 11); const search = $('#view-page input');
    setInput(search, 'pharmacia'); await W(60); ok($('#view-page').textContent.includes('Ortografia pseudoetimológica'), 'pesquisa encontra grafias antigas');
    setInput(search, 'mesoclise'); await W(60); ok($('#view-page').textContent.includes('Colocação dos pronomes'), 'pesquisa sem acentos');
    openSupportFicha('Romance histórico'); await W(20); ok(topModal().querySelector('em'), 'títulos em itálico'); const ch = [...topModal().querySelectorAll('.chip.click')].find(c => c.textContent === 'Escrever um romance histórico: a linguagem'); ok(ch, 'liga à Escrita Antiga'); ch.click(); await W(20); ok(topModal().textContent.includes('Arcaísmo de vocabulário'));
    closeAllModals(); eq($('#tourBtn').getAttribute('aria-label'), 'Ajuda e visitas guiadas'); });
  /* ---- X: Calendarização e Objetivos ---- */
  await T('X01 Cenas completas completam o Capítulo e o Tomo; desmarcar para reescrever tira a revisão; a revisão só depois de escrita', async () => { const f = fx(); commit(); histInit();
    const ids = f.c1.scenes; eq(chapterProg(f.c1, 'write').pct, 0); ids.forEach(id => setStage(id, 'write', true));
    ok(chapterProg(f.c1, 'write').complete, 'Capítulo completo'); ok(!bookProg(f.B1, 'write').complete, 'Tomo ainda não'); eq(bookProg(f.B1, 'write').pct, 75);
    setStage(f.a3.id, 'write', true); ok(bookProg(f.B1, 'write').complete, 'Tomo completo'); ok([...document.querySelectorAll('.toast')].some(t => t.textContent.includes('Tomo «Tomo 1» completa')));
    setStage(f.a1.id, 'review', true); ok(isDone(f.a1, 'review')); setStage(f.a2.id, 'write', false); ok(!isDone(f.a2, 'write'));
    setStage(f.a1.id, 'write', false); ok(!isDone(f.a1, 'review'), 'reescrever tira a revisão'); ok([...document.querySelectorAll('.toast')].some(t => t.textContent.includes('Revisão desmarcada')));
    setStage(f.a1.id, 'review', true); ok(!isDone(f.a1, 'review'), 'não se revê o que não está escrito');
    undo(); ok(isDone(state.scenes[f.a1.id], 'write'), 'anular repõe'); });
  await T('X02 acrescentar, mover e eliminar Cenas e Capítulos atualiza as percentagens', async () => { const f = fx(); [f.a1, f.b1, f.a2].forEach(s => setStage(s.id, 'write', true)); ok(chapterProg(f.c1, 'write').complete);
    const n = insertScene(f.c1.id, 3, f.A.id); commit(); eq(chapterProg(state.books[0].chapters[0], 'write').pct, 75, 'Cena nova por escrever');
    deleteScene(n.id); commit(); ok(chapterProg(state.books[0].chapters[0], 'write').complete);
    const st = structFromState(); const sid = st[0].chapters[0].scenes.shift(); st[0].chapters[1].scenes.push(sid); applyStruct(st); commit();
    eq(chapterProg(state.books[0].chapters[1], 'write').pct, 50, 'a Cena movida leva o estado'); eq(projectProg('write').total, 6); });
  await T('X03 sem campos vazios: o que a normalização produz é igual ao que se cria no uso (a sincronização compara bem)', async () => { const f = fx(); commit();
    const same = () => eq(JSON.stringify(sanitize(JSON.parse(JSON.stringify(state)))), JSON.stringify(state), 'normalização idempotente');
    same(); setStage(f.a1.id, 'write', true); setSceneDue(f.a2.id, 'review', '2030-01-02'); setDue(f.B1, 'write', '2030-02-01'); setPhase('write', 'start', '2030-01-01'); createGoal({kind:'scene', id:f.a1.id}); closeAllModals(); same();
    setStage(f.a1.id, 'write', false); setSceneDue(f.a2.id, 'review', ''); setDue(f.B1, 'write', ''); setPhase('write', 'start', ''); same();
    ok(!state.scenes[f.a1.id].prog && !state.books[0].due && !state.plan, 'desmarcar e apagar datas deixa tudo como estava'); });
  await T('X04 o separador: visão global, Escrita, Revisão, Pesquisa e Calendário, sem erros e com explicadores', async () => { const f = fx(); setStage(f.a1.id, 'write', true); setDue(f.B1, 'review', '2030-05-05'); commit();
    setTab('plan'); ok($('#view-page h1').textContent === 'Calendarização e Objetivos'); eq($('#rail [aria-current="page"]').dataset.tab, 'plan');
    for (const v of ['overview', 'research', 'progress', 'calendar']){ [...document.querySelectorAll('.plan-nav button')].find(b => b.textContent === PLAN_VIEWS.find(x => x[0] === v)[1]).click(); await W(10); eq(filters.planView, v);
      eq([...$('#view-page').querySelectorAll('button, input, select, .pbar, .goal-t, .cal-ev')].filter(el => el.offsetParent && !tipFor(el)).map(el => v + ': ' + (el.textContent || el.type)).slice(0, 5), []); }
    filters.planView = 'write'; renderAll(); eq(filters.planView, 'progress', 'Escrita e Revisão são agora uma só lista'); const chk = [...$('#view-page').querySelectorAll('.stage-scene input[type=checkbox]')]; eq(chk.length, 12, 'duas marcas por Cena'); ok(chk[0].checked && !chk[1].checked);
    chk[2].click(); ok(isDone(f.b1, 'write'), 'marca a partir do separador'); ok($('#view-page .chk.off'), 'revisão bloqueada nas por escrever');
    eq($('#view-page').querySelectorAll('.due-chip').length, 1, 'só o prazo que existe ocupa espaço'); ok($('#view-page .due-add'), '«+ prazo» onde não há');
    $('#view-page .stage-scene .due-add').click(); const di = $('#view-page .stage-scene input[type=date]'); ok(di, 'o «+ prazo» dá lugar ao campo da data'); di.value = '2031-02-03'; di.dispatchEvent(new Event('change')); eq(stg(f.a1, 'write').due, '2031-02-03'); });
  await T('X05 ficha da Cena e do Tomo: marcar como completa, prazos e objetivos de pesquisa', async () => { const f = fx(); openSceneFicha(f.a1.id);
    const sec = [...topModal().querySelectorAll('.sec')].find(s => s.textContent.startsWith('Progresso')); ok(sec, 'secção Progresso');
    eq([...sec.querySelectorAll('.steps3 button')].map(b => b.getAttribute('aria-pressed')), ['true', 'false', 'false'], 'três passos: por escrever, escrita, revista');
    sec.querySelector('.steps3 button[data-st="1"]').click(); await W(10); ok(isDone(state.scenes[f.a1.id], 'write'), 'marcada na ficha');
    const due = sec.querySelector('input[type=date]'); due.value = '2030-03-03'; due.dispatchEvent(new Event('change')); eq(stg(state.scenes[f.a1.id], 'write').due, '2030-03-03');
    btn('+ Objetivo de pesquisa', topModal()).click(); await W(20); ok(topModal().textContent.includes('Objetivo de pesquisa')); const g = state.goals[state.goals.length - 1]; eq(g.target, {kind:'scene', id:f.a1.id});
    closeAllModals(); openBookFicha(f.B1.id); ok([...topModal().querySelectorAll('.sec')].some(s => s.textContent.startsWith('Progresso') && s.querySelector('.pbar'))); });
  await T('X06 objetivos de pesquisa: tipos, associação, data e hora, Notas e Referências, eliminar', async () => { const f = fx(); setTab('plan'); filters.planView = 'research'; renderAll();
    btn('+ Objetivo de pesquisa', $('#view-page')).click(); await W(20); const g = state.goals[0]; eq(g.target.kind, 'project');
    const m = topModal(); setInput(m.querySelector('input'), 'Entrevistar o faroleiro'); const sels = m.querySelectorAll('select'); eq(sels[0].options.length, GOAL_TYPES.length);
    sels[0].value = 'entrevista'; sels[0].dispatchEvent(new Event('change')); await W(10); const sel2 = topModal().querySelectorAll('select')[1]; ok([...sel2.options].some(o => o.value === 'chapter:' + f.c2.id), 'Capítulos na lista');
    sel2.value = 'chapter:' + f.c2.id; sel2.dispatchEvent(new Event('change')); await W(10); eq(g.target, {kind:'chapter', id:f.c2.id}); eq(g.type, 'entrevista');
    const d = topModal().querySelector('input[type=date]'); d.value = '2030-04-10'; d.dispatchEvent(new Event('change')); await W(10); const tm = topModal().querySelector('input[type=time]'); tm.value = '15:30'; tm.dispatchEvent(new Event('change'));
    eq([g.due, g.time], ['2030-04-10', '15:30']); ok(topModal().querySelector('.cal-links'), 'ligações para os calendários');
    btn('+ Criar Nota', topModal()).click(); await W(20); const note = state.refs[state.refs.length - 1]; eq(note.links, [{kind:'goal', id:g.id}]); ok(topModal().textContent.includes('Objetivo de pesquisa: Entrevistar o faroleiro'), 'a Nota mostra o objetivo');
    closeAllModals(); openGoalFicha(g.id); ok(topModal().textContent.includes(note.title)); btn('Eliminar objetivo', topModal()).click(); await W(20); ok(topModal().textContent.includes('As Referências associadas mantêm-se.') && btn('Cancelar', topModal()), 'pede confirmação'); await answer(true);
    eq(state.goals.length, 0); eq(state.refs.find(r => r.id === note.id).links, [], 'a Nota fica, sem a ligação');
    const g2 = newGoal({kind:'scene', id:f.a1.id}); commit(); deleteScene(f.a1.id); commit(); eq(g2.target, {kind:'project', id:null}, 'Cena eliminada: o objetivo passa logo a geral');
    eq(JSON.stringify(sanitize(JSON.parse(JSON.stringify(state)))), JSON.stringify(state), 'e continua igual depois da normalização'); });
  await T('X09 correções da revisão: ficha atualiza ao marcar, datas só completas, projeto com objetivos não é «em branco», .ics com acentos e às 23:30', async () => { const f = fx();
    openSceneFicha(f.a1.id); const sec = () => [...topModal().querySelectorAll('.sec')].find(s => s.textContent.startsWith('Progresso'));
    sec().querySelector('.steps3 button[data-st="1"]').click(); await W(10); eq(sec().querySelector('.steps3 [aria-pressed="true"]').dataset.st, '1', 'a ficha mostra logo a Cena escrita');
    sec().querySelector('.steps3 button[data-st="2"]').click(); await W(10); ok(isDone(state.scenes[f.a1.id], 'review')); sec().querySelector('.steps3 button[data-st="0"]').click(); await W(10); ok(!state.scenes[f.a1.id].prog, 'voltar a «por escrever» limpa as duas marcas');
    sec().querySelector('.steps3 button[data-st="2"]').click(); await W(10); ok(isDone(state.scenes[f.a1.id], 'write') && isDone(state.scenes[f.a1.id], 'review'), 'de «por escrever» para «revista» fica também escrita'); closeAllModals();
    const inp = dueInput(null, v => { inp._set = v; }, 'x'); inp.value = '0202-01-01'; inp.dispatchEvent(new Event('change')); eq(inp._set, undefined, 'ano incompleto não grava'); inp.value = '2027-01-01'; inp.dispatchEvent(new Event('change')); eq(inp._set, '2027-01-01');
    const bp = blankProject(); ok(isBlankProject(bp)); bp.goals = [{id:'g', title:'x'}]; ok(!isBlankProject(bp), 'com objetivos não é em branco');
    const e = {key:'k', date:'2030-12-31', time:'23:30', title:'Revisão: «Ação» à noite — café ☕ e mais texto para passar dos setenta e cinco octetos', kind:'goal', done:false, desc:'x'};
    const ics = buildICS([e]); ok(ics.includes('DTEND:20310101T003000'), 'passa para o dia seguinte'); const enc = new TextEncoder();
    ok(ics.split('\r\n').every(l => enc.encode(l).length <= 75), 'linhas até 75 octetos'); ok(!ics.includes('\uFFFD')); ok(/SEQUENCE:\d+/.test(ics));
    eq(new URL(googleURL(e)).searchParams.get('dates'), '20301231T233000/20310101T003000'); ok(outlookURL(e, true).includes('subject=Revis%C3%A3o%3A%20'), 'espaços como %20');
    const B = state.books[0]; B.chapters.push({id:uid('c'), name:'Vazio', scenes:[]}); [f.a1, f.b1, f.a2, f.a3].forEach(s => setStage(s.id, 'write', true)); ok(!bookProg(B, 'write').complete, 'Capítulo vazio: Tomo não está completo');
    setTab('plan'); filters.planView = 'research'; renderAll(); ok(tipFor([...document.querySelectorAll('.plan-view .seg button')].find(b => b.textContent === 'Todos')).text.includes('objetivos'), 'explicador certo'); });
  await T('X07 calendário e exportação: eventos, mês, .ics válido e ligações para Google e Outlook / Teams', async () => { const f = fx();
    setSceneDue(f.a1.id, 'write', '2030-06-15'); setDue(f.c1, 'review', '2030-06-20'); const g = newGoal(); g.title = 'Ver mapa, antigo; raro'; g.due = '2030-06-15'; g.time = '09:30'; setPhase('review', 'end', '2030-06-30'); commit();
    const ev = planEvents(); eq(ev.map(e => e.kind), ['write', 'goal', 'review', 'phase'], 'no mesmo dia, primeiro os eventos de dia inteiro');
    const ics = buildICS(ev); ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.trim().endsWith('END:VCALENDAR')); eq((ics.match(/BEGIN:VEVENT/g) || []).length, 4);
    ok(ics.includes('DTSTART;VALUE=DATE:20300615') && ics.includes('DTSTART:20300615T093000'), 'datas'); ok(ics.includes('Ver mapa\\, antigo\\; raro'), 'escapes');
    ok(ics.split('\r\n').every(l => l.length <= 75), 'linhas dobradas'); ok(/UID:[^\r]+-goal-/.test(ics), 'identificador fixo'); eq(buildICS(planEvents()).replace(/DTSTAMP:\S+/g, ''), ics.replace(/DTSTAMP:\S+/g, ''), 'o mesmo projeto dá o mesmo ficheiro');
    const gu = new URL(googleURL(ev.find(e => e.kind === 'goal'))); eq(gu.searchParams.get('dates'), '20300615T093000/20300615T103000'); ok(outlookURL(ev[1], true).startsWith('https://outlook.office.com/') && outlookURL(ev[1], false).startsWith('https://outlook.live.com/'));
    setTab('plan'); filters.planView = 'calendar'; filters.calMonth = '2030-06'; renderAll(); eq($('#view-page .cal-grid').querySelectorAll('.cal-day:not(.empty)').length, 30); eq($('#view-page .cal-grid').querySelectorAll('.cal-ev').length, 4);
    btn('›', $('#view-page')).click(); eq(filters.calMonth, '2030-07'); btn('Hoje', $('#view-page')).click(); eq(filters.calMonth, todayISO().slice(0, 7));
    filters.calMonth = '2030-06'; renderAll(); $('#view-page .cal-ev.ev-write').click(); await W(20); ok(topModal() && topModal().textContent.includes('Ficha da Cena'), 'o evento abre a Cena'); closeAllModals();
    const oc = URL.createObjectURL, ac = HTMLAnchorElement.prototype.click; let got = null; URL.createObjectURL = b => { got = b; return 'blob:x'; }; HTMLAnchorElement.prototype.click = function(){};
    try { btn('Exportar calendário (.ics)', $('#view-page')).click(); await W(10); ok(got && got.type.startsWith('text/calendar')); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ac; } });
  await T('X08 telemóvel: o separador cabe em 360 px sem deslizar para o lado', async () => { const f = fx(); setDue(f.B1, 'write', '2030-01-01'); newGoal().title = 'Um objetivo com um título bastante comprido para ver se cabe'; commit(); setTab('plan');
    const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;left:0;top:0;width:360px;height:740px;border:0;z-index:99999;background:#fff'; flushSave(); document.body.append(fr);
    try { fr.src = location.href; await new Promise(r => fr.onload = r); await W(400); const w = fr.contentWindow;
      for (const v of ['overview', 'write', 'research', 'calendar']){ w.eval(`filters.planView = '${v}'; activeTab = 'plan'; renderAll();`); await W(30); ok(w.document.documentElement.scrollWidth <= 361 && w.document.querySelector('#view-page').scrollWidth <= 361, v + ' desliza para o lado: ' + w.document.querySelector('#view-page').scrollWidth); } }
    finally { fr.remove(); } });
  /* ---- Y: ícones do projeto, fecho, Referências com leitores, tema ---- */
  await T('Y00 ícone «+» cria um Novo Projeto sem fechar o atual; os ícones da barra de topo têm todos o mesmo desenho', async () => { fx(); commit(); flushSave();
    const first = projActive(), n0 = Projects.idx.open.length; $('#projNewBtn').click(); await W(30);
    ok(projActive() !== first); eq(Projects.idx.open.length, n0 + 1); eq(state.project.name, 'Novo Projeto'); eq(activeTab, 'board');
    const ics = [...document.querySelectorAll('#topbar .icon-btn:not(#langBtn)')]; // a língua mostra as iniciais (PT, EN…), não um ícone ok(ics.length >= 9, 'ícones: ' + ics.length);
    ics.forEach(b => { const s = b.querySelector('svg'); ok(s && !b.textContent.trim(), 'só SVG: ' + b.id); eq(getComputedStyle(s).strokeLinecap, 'round'); eq(getComputedStyle(s).fill, 'none'); });
    eq(new Set(ics.filter(b => b.offsetParent).map(b => Math.round(b.getBoundingClientRect().width))).size, 1, 'todos com o mesmo tamanho'); });
  await T('Y01 ícones Guardar, Abrir e Fechar junto ao nome do projeto', async () => { fx(); commit(); flushSave();
    ['#projNewBtn', '#projSaveBtn', '#projOpenBtn', '#projCloseBtn'].forEach(s => { const b = $(s); ok(b && b.offsetParent, s); ok(tipFor(b), 'explicador ' + s); ok(b.getBoundingClientRect().width >= 28); });
    ok(document.body.classList.contains('proj-dirty'), 'Guardar em destaque com alterações por guardar');
    const oc = URL.createObjectURL, ac = HTMLAnchorElement.prototype.click; let n = 0; URL.createObjectURL = () => 'blob:x'; HTMLAnchorElement.prototype.click = function(){ n++; };
    try { $('#projSaveBtn').click(); await W(60); eq(n, 1); ok(!document.body.classList.contains('proj-dirty')); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ac; }
    $('#projCloseBtn').click(); await W(30); ok(projNone(), 'acabado de guardar: fecha sem perguntar'); ok(!$('#projSaveBtn').offsetParent, 'sem projeto, os ícones escondem-se'); });
  await T('Y02 fechar um projeto nunca guardado pergunta sempre e, sem guardar, perde-o', async () => { fx(); commit(); flushSave(); const id = projActive();
    ok(!projMeta(id).savedSig); $('#projCloseBtn').click(); await W(30); ok(topModal().textContent.includes('nunca foi guardado') && topModal().textContent.includes('serão perdidos'));
    await answerBtn('Cancelar'); eq(projActive(), id); $('#projCloseBtn').click(); await W(30); await answerBtn('Fechar sem guardar');
    ok(!Projects.idx.open.includes(id) && !Projects.idx.recent.includes(id), 'o projeto desaparece'); eq(lsGet(projKey(id)), null); });
  await T('Y03 vídeos e podcasts por endereço: Referência de Video ou Audio, com leitor na ficha; links clicáveis num novo separador', async () => {
    eq(mediaEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5').src, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=5'); eq(mediaEmbed('https://youtu.be/dQw4w9WgXcQ').kind, 'video');
    eq(mediaEmbed('https://vimeo.com/76979871').src, 'https://player.vimeo.com/video/76979871'); eq(mediaEmbed('https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk').src, 'https://open.spotify.com/embed/episode/4rOoJ6Egrf8K2IrywzwOMk');
    eq(mediaEmbed('https://podcasts.apple.com/pt/podcast/x/id123?i=456').kind, 'audio'); eq(mediaEmbed('https://soundcloud.com/a/b').kind, 'audio');
    eq(mediaEmbed('https://exemplo.pt/ep1.mp3').tag, 'audio'); eq(mediaEmbed('https://exemplo.pt/filme.mp4?x=1').tag, 'video'); eq(mediaEmbed('https://exemplo.pt/'), null); eq(mediaEmbed('javascript:alert(1)'), null);
    newRefDialog(null); await W(20); const ins = topModal().querySelectorAll('input.inp'); ins[0].value = 'https://youtu.be/dQw4w9WgXcQ'; btn('Adicionar Link', topModal()).click(); await W(30);
    const rv = state.refs[state.refs.length - 1]; eq(rv.type, 'video'); openRefFicha(rv.id); await W(20);
    const fr = topModal().querySelector('iframe.embed'); ok(fr && fr.src.startsWith('https://www.youtube-nocookie.com/embed/'), 'leitor incorporado'); ok(/allow-scripts/.test(fr.getAttribute('sandbox')));
    const a = [...topModal().querySelectorAll('a.btn')].find(x => x.textContent === 'Abrir ↗'); ok(a && a.target === '_blank' && /noopener/.test(a.rel)); closeAllModals();
    const n = newNote([]); n.text = 'Ver https://exemplo.pt/mapa, e também https://pt.wikipedia.org/wiki/Farol.'; commit(); openRefFicha(n.id); await W(20);
    eq([...topModal().querySelectorAll('.note-links a')].map(x => x.href), ['https://exemplo.pt/mapa', 'https://pt.wikipedia.org/wiki/Farol']); closeAllModals();
    setTab('refs'); const card = [...document.querySelectorAll('#view-page .card')].find(c => c.textContent.includes('youtu.be')); ok(card.querySelector('a.ext-link[target="_blank"]'), 'o endereço é clicável no cartão'); });
  await T('Y04 ficheiros: PDF e texto pré-visualizados, outros tipos com indicação para descarregar', async () => { fx();
    await addFilesAsRefs([new File(['%PDF-1.4 teste'], 'mapa.pdf', {type:'application/pdf'}), new File(['Linha um\nLinha dois'], 'notas.txt', {type:'text/plain'}), new File(['PK'], 'carta.docx', {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})], null); await W(80);
    const byName = nm => state.refs.find(r => r.fileName === nm);
    openRefFicha(byName('mapa.pdf').id); await W(150); ok(topModal().querySelector('iframe.doc-view'), 'PDF na ficha'); closeAllModals();
    openRefFicha(byName('notas.txt').id); await W(150); ok((topModal().querySelector('pre.doc-text') || {}).textContent.includes('Linha dois'), 'texto na ficha'); closeAllModals();
    openRefFicha(byName('carta.docx').id); await W(150); ok(topModal().textContent.includes('Descarregar') && topModal().textContent.includes('não se pode mostrar')); closeAllModals(); });
  await T('Y05 tema: por omissão segue o sistema; a escolha fica lembrada e aplica-se logo', async () => { fx();
    localStorage.removeItem(LS_THEME); eq(themePref(), 'auto'); eq(effectiveMode(), matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light', 'segue o sistema');
    setTab('settings'); const seg = $('.theme-seg'); ok(seg); ok([...seg.querySelectorAll('button')].every(b => tipFor(b)));
    [...seg.querySelectorAll('button')].find(b => b.textContent === 'Claro').click(); eq(lsGet(LS_THEME), 'light'); eq(document.documentElement.dataset.mode, 'light'); eq(paletteVars({h:state.project.palette.h, mode:'light'})['--bg'], getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
    [...$('.theme-seg').querySelectorAll('button')].find(b => b.textContent === 'Escuro').click(); eq(effectiveMode(), 'dark'); eq(document.documentElement.style.colorScheme, 'dark');
    [...document.querySelectorAll('.pal')].find(p => p.textContent.includes('Pergaminho')).click(); eq(lsGet(LS_THEME), 'light', 'escolher uma paleta clara lembra o claro'); eq(state.project.palette.h, 40);
    [...$('.theme-seg').querySelectorAll('button')].find(b => b.textContent.startsWith('Automático')).click(); eq(lsGet(LS_THEME), 'auto'); });
  await T('Y06 Calendarização e Objetivos é o segundo separador', () => { eq(TABS[1][0], 'plan'); eq(document.querySelectorAll('#rail .nav-item')[1].textContent, 'Plano'); });
  await T('Y07 barra em camadas nos Tomos e Capítulos: Pesquisa por baixo, Escrita por cima, Revisão por cima de tudo', async () => { const f = fx(); commit();
    ok(bkHead(f.B1.id).querySelector('.lbar'), 'no cabeçalho do Tomo'); ok(chHead(f.c1.id).querySelector('.lbar'), 'no cabeçalho do Capítulo'); eq(bkHead(f.B1.id).querySelectorAll('.lb-r').length, 0, 'sem objetivos, sem camada de Pesquisa');
    [f.a1, f.b1].forEach(s => setStage(s.id, 'write', true)); setStage(f.a1.id, 'review', true); const g = newGoal({kind:'chapter', id:f.c1.id}); g.done = true; newGoal({kind:'scene', id:f.a3.id}); commit();
    const bar = bkHead(f.B1.id).querySelector('.lbar'), segs = [...bar.querySelectorAll('.lb')].map(x => x.className.split(' ')[1]);
    eq(segs, ['lb-r', 'lb-w', 'lb-v'], 'ordem das camadas: a última fica por cima'); eq([...bar.querySelectorAll('.lb')].map(x => x.style.width), ['50%', '50%', '25%']);
    ok(tipFor(bar) && tipFor(bar).text.includes('Pesquisa 50%')); const cb = chHead(f.c1.id).querySelector('.lbar'); eq(cb.querySelector('.lb-w').style.width, '67%');
    eq(chHead(f.c3.id).querySelectorAll('.lb-r').length, 0); const empty = {id:uid('c'), name:'Vazio', scenes:[]}; f.B2.chapters.push(empty); commit(); ok(!chHead(empty.id).querySelector('.lbar'), 'Capítulo vazio sem barra');
    setTab('plan'); filters.planView = 'overview'; renderAll(); ok(document.querySelectorAll('#view-page .lbar').length >= 4, 'na visão global'); openBookFicha(f.B1.id); ok(topModal().querySelector('.lbar.big'), 'na ficha do Tomo'); });
  await T('Y08 leitores: momento de início, listas, vídeos não listados, Drive, endereços inválidos e ligações seguras', async () => { fx();
    const src = u => (mediaEmbed(u) || {}).src;
    eq(src('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90'); eq(src('https://youtu.be/dQw4w9WgXcQ?t=42'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=42');
    eq(src('https://m.youtube.com/shorts/dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'); eq(src('https://www.youtube.com/playlist?list=PL590L5WQmH8fJ54F369BLDSqIwcs-TCfs'), 'https://www.youtube-nocookie.com/embed/videoseries?list=PL590L5WQmH8fJ54F369BLDSqIwcs-TCfs');
    eq(mediaEmbed('https://www.youtube.com/@canal'), null, 'um canal não é um vídeo'); eq(mediaEmbed('https://notyoutube.com/watch?v=dQw4w9WgXcQ'), null, 'só o YouTube verdadeiro');
    eq(src('https://vimeo.com/123456/abcdef12'), 'https://player.vimeo.com/video/123456?h=abcdef12'); eq(src('https://vimeo.com/channels/staffpicks/76979871'), 'https://player.vimeo.com/video/76979871');
    eq(src('https://dai.ly/x8abc12'), 'https://geo.dailymotion.com/player.html?video=x8abc12'); eq(src('https://open.spotify.com/intl-pt/episode/4rOoJ6Egrf8K2IrywzwOMk?si=x'), 'https://open.spotify.com/embed/episode/4rOoJ6Egrf8K2IrywzwOMk');
    eq(mediaEmbed('https://soundcloud.com/forss'), null, 'um perfil do SoundCloud não é uma faixa'); eq(src('https://soundcloud.com/forss/flickermood?utm=x'), 'https://w.soundcloud.com/player/?visual=false&url=' + encodeURIComponent('https://soundcloud.com/forss/flickermood'));
    eq(src('https://podcasts.apple.com/pt/podcast/x/id123?i=456&l=en'), 'https://embed.podcasts.apple.com/pt/podcast/x/id123?i=456');
    const d = mediaEmbed('https://drive.google.com/file/d/1AbC_d-9/view?usp=sharing'); eq(d.kind, 'document'); eq(d.src, 'https://drive.google.com/file/d/1AbC_d-9/preview'); ok(embedEl(d).classList.contains('doc-view'));
    for (const bad of ['https://', 'https://exa mple.pt/a.mp3', 'http://[::1', 'ftp://x/y.mp3']) eq(mediaEmbed(bad), null, 'inválido: ' + bad);
    state.refs.push({id:uid('r'), type:'link', title:'Má', url:'javascript:alert(1)', links:[], created:Date.now()}); commit(); setTab('refs');
    const card = [...document.querySelectorAll('#view-page .card')].find(c => c.textContent.includes('Má')); ok(card && !card.querySelector('a[href^="javascript"]'), 'um endereço javascript: nunca fica clicável');
    openRefFicha(state.refs[state.refs.length - 1].id); await W(20); ok(!topModal().querySelector('a[href^="javascript"]') && !topModal().querySelector('iframe')); closeAllModals();
    eq(sanitize({...state, refs:[{id:'r9', type:'link', url:{x:1}, links:[]}]}).refs[0].url, '[object Object]', 'o endereço guarda-se sempre como texto'); });
  /* ---- Z: barra lateral, Criar, «+ Cena» no quadro, pega de convergência, telemóvel (barra de baixo e Lista) ---- */
  const mv = (el, x, y) => el.dispatchEvent(new PointerEvent('pointermove', {bubbles:true, cancelable:true, clientX:x, clientY:y, pointerType:'mouse'}));
  const cellXY = (chId, slot, li) => { const r = $('#bodyLayer').getBoundingClientRect(), c = L.chapters.find(x => x.id === chId); return [r.left + c.x + B.CP + slot * (B.SW + B.SG) + B.SW / 2, r.top + B.TOP + li * B.LANE + B.LANE / 2]; };
  const laneOf = arc => L.lanes.findIndex(l => l.arc.id === arc.id);
  const bodyAt = chId => document.querySelector(`.ch-body[data-chapter="${chId}"]`);
  await T('Z01 barra lateral: Criar e oito áreas, a área à vista assinalada; Definições na roda dentada, que volta atrás; topo numa linha', async () => { fx();
    eq(document.body.dataset.nav, 'rail'); ok(!$('#bnav').offsetParent, 'sem barra de baixo no PC');
    eq([...document.querySelectorAll('#rail .nav-item')].map(b => b.textContent), ['Narrativa', 'Plano', 'Tomos', 'Arcos', 'Personagens', 'Localizações', 'Referências', 'Apoio']);
    eq($('#rail [aria-current="page"]').dataset.tab, 'board');
    document.querySelector('#rail .nav-item[data-tab="characters"]').click(); eq(activeTab, 'characters'); eq($('#rail [aria-current="page"]').dataset.tab, 'characters'); ok(!document.querySelector('.el-tabs'), 'no PC, sem o seletor de Elementos');
    $('#setBtn').click(); eq(activeTab, 'settings'); ok($('#setBtn').classList.contains('on') && $('#view-page .settings'));
    $('#setBtn').click(); eq(activeTab, 'characters', 'outro clique volta à área em que estava');
    [...document.querySelectorAll('#rail button, #topbar button')].forEach(b => ok(tipFor(b), 'sem explicador: ' + (b.id || b.textContent)));
    ok($('#topbar').getBoundingClientRect().height <= 64, 'a barra de topo tem uma só linha'); const nm = $('#projName'); ok(nm.scrollWidth <= nm.clientWidth + 1, 'o nome do projeto ficou cortado'); });
  await T('Z02 ajuda: as duas visitas; durante a visita, a barra lateral fica inativa', async () => { fx(); $('#tourBtn').click(); eq(menuLabels(), ['Visita guiada', 'Visita detalhada', 'Atalhos de teclado']); eq($('#tourBtn').getAttribute('aria-expanded'), 'true');
    await menuClick('Visita detalhada'); ok(Tour.active && Tour.kind === 'deep'); ok($('#rail').inert); endTour(); ok(!$('#rail').inert); });
  await T('Z03 Criar: nove opções, cada uma cria o que diz', async () => { const f = fx();
    $('#createBtn').click(); eq(menuLabels(), ['Cena', 'Capítulo', 'Tomo', 'Arco Narrativo', 'Personagem', 'Localização', 'Nota', 'Referência', 'Objetivo de pesquisa']);
    document.querySelectorAll('.create-menu .ctx-item').forEach(b => ok(tipFor(b), 'sem explicador: ' + b.textContent));
    await menuClick('Personagem'); ok(topModal().textContent.includes('Ficha da Personagem')); closeAllModals();
    $('#createBtn').click(); await menuClick('Localização'); ok(topModal().textContent.includes('Localização')); closeAllModals();
    const nb = state.books.length; $('#createBtn').click(); await menuClick('Tomo'); eq(state.books.length, nb + 1); ok(topModal().textContent.includes('Ficha do Tomo')); await W(50); eq(document.activeElement, topModal().querySelector('input'), 'nome pronto a mudar'); closeAllModals();
    $('#createBtn').click(); await menuClick('Nota'); ok(topModal().textContent.includes('Associada a')); closeAllModals();
    $('#createBtn').click(); await menuClick('Referência'); ok(topModal().textContent.includes('Nova Referência')); closeAllModals();
    const ng = state.goals.length; $('#createBtn').click(); await menuClick('Objetivo de pesquisa'); eq(state.goals.length, ng + 1); closeAllModals();
    $('#createBtn').click(); await menuClick('Arco Narrativo'); setInput(topModal().querySelector('input'), 'Novo arco'); btn('OK').click(); await W(40); ok(state.arcs.some(a => a.name === 'Novo arco')); ok(topModal().textContent.includes('Ficha do Arco Narrativo')); closeAllModals();
    $('#createBtn').click(); await menuClick('Capítulo'); const m = topModal(); setInput(m.querySelector('input'), 'Epílogo'); setSelect(m.querySelector('select'), f.B1.id); btn('Criar', m).click(); await W(30); eq(f.B1.chapters[f.B1.chapters.length - 1].name, 'Epílogo');
    $('#createBtn').click(); await menuClick('Cena'); const m2 = topModal(); setInput(m2.querySelector('input'), 'Nova cena'); setSelect(m2.querySelectorAll('select')[0], f.c2.id); setSelect(m2.querySelectorAll('select')[1], f.Bq.id); btn('Criar', m2).click(); await W(30);
    const s = state.scenes[f.c2.scenes[f.c2.scenes.length - 1]]; eq([s.title, s.arcId], ['Nova cena', f.Bq.id]); ok(!topModal(), 'Criar fecha a janela');
    $('#createBtn').click(); await menuClick('Cena'); const m3 = topModal(); setInput(m3.querySelector('input'), 'Com arco novo'); setSelect(m3.querySelectorAll('select')[1], '+novo'); setInput(m3.querySelectorAll('input')[1], 'Arco C'); btn('Mais opções', m3).click(); await W(30);
    ok(topModal().textContent.includes('Ficha da Cena'), '«Mais opções» abre a ficha'); const c = state.arcs.find(a => a.name === 'Arco C'); ok(c && arcOwnScenes(c.id)[0].title === 'Com arco novo'); });
  await T('Z04 «+ Cena» num espaço vazio: cria ali, no Arco Narrativo da faixa; o título escreve-se no cartão e um só Anular desfaz tudo', async () => { const f = fx(); commit(); histInit();
    const [x, y] = cellXY(f.c1.id, 0, laneOf(f.Bq)); mv(bodyAt(f.c1.id), x, y); // C1: a1 (A), b1 (B), a2 (A) — a primeira coluna da faixa B está vazia
    const g = $('.ghost-scene'); ok(g && !g.hidden, 'o «+ Cena» não apareceu'); ok(tipFor(g));
    g.click(); await W(20); const n = state.scenes[f.c1.scenes[0]]; eq(n.arcId, f.Bq.id); const inp = $('.scene-rename'); ok(inp, 'o título não ficou pronto a escrever'); ok(document.activeElement === inp || !document.hasFocus(), 'sem foco no título');
    inp.value = 'Prólogo'; inp.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true})); await W(20);
    eq(n.title, 'Prólogo'); eq(sceneEl(n.id).querySelector('.scene-title').textContent, 'Prólogo'); eq(Hist.undo.length, 1, 'um só passo no histórico');
    undo(); ok(!state.scenes[n.id], 'Anular desfaz a criação'); layoutInvariants(); });
  await T('Z05 «+ Cena»: Esc ou sair sem escrever desiste, sem deixar rasto; com texto escrito, fica', async () => { const f = fx(); commit(); histInit(); const n0 = Object.keys(state.scenes).length;
    const [x, y] = cellXY(f.c1.id, 0, laneOf(f.Bq)); mv(bodyAt(f.c1.id), x, y); $('.ghost-scene').click(); await W(20);
    $('.scene-rename').dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true})); await W(20); eq(Object.keys(state.scenes).length, n0); eq([Hist.undo.length, Hist.redo.length], [0, 0], 'nada no histórico');
    mv(bodyAt(f.c1.id), x, y); $('.ghost-scene').click(); await W(20); $('.scene-rename').dispatchEvent(new FocusEvent('blur')); await W(20); eq(Object.keys(state.scenes).length, n0, 'sair sem escrever');
    mv(bodyAt(f.c1.id), x, y); $('.ghost-scene').click(); await W(20); $('.scene-rename').value = 'Fica'; $('.scene-rename').dispatchEvent(new FocusEvent('blur')); await W(20); eq(Object.keys(state.scenes).length, n0 + 1); ok(Object.values(state.scenes).some(z => z.title === 'Fica')); });
  await T('Z06 «+» entre duas Cenas do mesmo Arco Narrativo insere no meio; nada aparece por cima de Cenas, com janelas abertas, na visita ou ao toque', async () => { const f = fx();
    insertScene(f.c3.id, 2, f.A.id).title = 'a5'; commit(); histInit(); settle(); // C3: b2 (B), a4 (A), a5 (A)
    const r = $('#bodyLayer').getBoundingClientRect(), c = L.chapters.find(x => x.id === f.c3.id), li = laneOf(f.A);
    mv(bodyAt(f.c3.id), r.left + c.x + B.CP + 2 * (B.SW + B.SG) - B.SG / 2, r.top + B.TOP + li * B.LANE + B.LANE / 2);
    const p = $('.ins-plus'); ok(!p.hidden, 'o «+» não apareceu'); ok(tipFor(p)); p.click(); await W(20);
    const c3 = () => findChapter(f.c3.id).chapter; eq(state.scenes[c3().scenes[2]].arcId, f.A.id); eq([state.scenes[c3().scenes[1]].title, state.scenes[c3().scenes[3]].title], ['a4', 'a5'], 'inserida no meio');
    $('.scene-rename').dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true})); await W(20); eq(c3().scenes.length, 3);
    const sc = sceneEl(f.a1.id), sr = sc.getBoundingClientRect(); mv(sc, sr.left + 20, sr.top + 20); ok($('.ghost-scene').hidden && $('.ins-plus').hidden, 'por cima de uma Cena');
    const [x, y] = cellXY(f.c1.id, 0, laneOf(f.Bq)); openBookFicha(f.B1.id); mv(bodyAt(f.c1.id), x, y); ok($('.ghost-scene').hidden, 'com uma janela aberta'); closeAllModals();
    startTour(); mv($('.ch-body'), x, y); ok($('.ghost-scene').hidden, 'na visita'); endTour();
    bodyAt(f.c1.id).dispatchEvent(new PointerEvent('pointermove', {bubbles:true, clientX:x, clientY:y, pointerType:'touch'})); ok($('.ghost-scene').hidden, 'ao toque não há «passar o rato»'); });
  await T('Z07 pega de convergência: só na última Cena de cada Arco Narrativo; arrastá-la até outra Cena converge; um clique escolhe a seguir', async () => { const f = fx();
    eq([...document.querySelectorAll('.conv-h')].map(x => x.closest('.scene').dataset.scene).sort(), [f.a4.id, f.b2.id].sort());
    const h1 = sceneEl(f.a4.id).querySelector('.conv-h'), hr = h1.getBoundingClientRect(); ok(tipFor(h1));
    pe('pointerdown', h1, hr.left + 8, hr.top + 8); ok(linkDrag && linkDrag.handle, 'a ligação não começou');
    const t = sceneEl(f.b1.id).getBoundingClientRect(); pe('pointermove', window, t.left + 30, t.top + 20); eq(linkDrag.hover, f.b1.id); pe('pointerup', window, t.left + 30, t.top + 20); await W(30);
    ok(topModal().textContent.includes('convergência')); await answer(true); eq(f.a4.convergeTo, f.b1.id); ok(!sceneEl(f.a4.id).querySelector('.conv-h'), 'depois de convergir, a pega sai');
    const h2 = sceneEl(f.b2.id).querySelector('.conv-h'), r2 = h2.getBoundingClientRect(); pe('pointerdown', h2, r2.left + 8, r2.top + 8); pe('pointerup', window, r2.left + 8, r2.top + 8); h2.click(); await W(20);
    eq(pickLink, f.b2.id, 'um clique sem arrastar passa a escolher a Cena de destino'); endPickLink(); });
  await T('Z08 com alterações por guardar, o texto da ferramenta mantém a cor e o tamanho', () => { fx(); commit(); document.body.classList.add('proj-dirty');
    const probe = h('span', {style:{color:'var(--text)'}}); document.body.append(probe); const want = getComputedStyle(probe).color; probe.remove();
    eq(getComputedStyle(document.body).color, want); eq(getComputedStyle(document.body).fontSize, '14px'); projUI(); });
  await T('Z09 telemóvel ao alto: cinco destinos em baixo, topo só com o nome e ⋮, Narrativa em Lista, Elementos e Mais', async () => { const f = fx(); f.a1.pov = newCharacter('Ana').id; commit(); flushSave();
    await phone(360, 740, async (w, d) => { const E = x => w.eval(x), q = x => d.querySelector(x), qa = x => [...d.querySelectorAll(x)];
      eq(d.body.dataset.nav, 'bottom'); ok(!q('#rail').offsetParent && q('#bnav').offsetParent);
      eq(qa('#bnav .nav-item').map(b => b.textContent), ['Narrativa', 'Plano', 'Elementos', 'Referências', 'Mais']);
      ok(q('#moreBtn').offsetParent && !q('#undoBtn').offsetParent && !q('#setBtn').offsetParent && !q('#tourBtn').offsetParent, 'topo do telemóvel');
      const nm = q('#projName'); ok(nm.scrollWidth <= nm.clientWidth + 1, 'o nome do projeto ficou cortado');
      ok(!q('#narrList').hidden && q('#board-scroll').hidden, 'a Narrativa abre em Lista');
      eq(qa('.nl-row').map(r => r.querySelector('b').textContent), ['a1', 'b1', 'a2', 'a3', 'b2', 'a4']); ok(q('.nl-row small').textContent.includes('POV Ana'));
      qa('#narrList button').forEach(b => ok(w.tipFor(b), 'sem explicador: ' + b.className));
      q('.nl-row').click(); await W(30); ok(q('.modal') && q('.modal').textContent.includes('Ficha da Cena')); w.closeAllModals();
      q('.nl-row').dispatchEvent(new w.MouseEvent('contextmenu', {bubbles:true, cancelable:true, clientX:100, clientY:200})); ok(qa('.ctx-item').some(x => x.textContent === 'Criar nova Cena aqui'), 'menu da Cena'); w.closeMenu();
      q('.view-toggle button[data-view="board"]').click(); await W(30); ok(q('#narrList').hidden && !q('#board-scroll').hidden, 'Quadro'); ok(q('.corner .view-toggle'), 'a escolha está no canto do quadro');
      q('.corner .view-toggle button[data-view="list"]').click(); await W(30); ok(!q('#narrList').hidden);
      q('#bnav .nav-item[data-tab="elements"]').click(); await W(30); eq(E('activeTab'), 'books'); eq(qa('.el-tabs button').map(b => b.textContent), ['Tomos', 'Capítulos', 'Arcos Narrativos', 'Personagens', 'Localizações']);
      qa('.el-tabs button')[3].click(); await W(30); eq(E('activeTab'), 'characters'); eq(q('#bnav [aria-current="page"]').dataset.tab, 'elements');
      q('#bnav .nav-item[data-tab="more"]').click(); await W(30); eq(qa('.sheet-row').map(b => b.textContent), ['Materiais de Apoio', 'Definições do Projeto', 'Visita guiada', 'Visita detalhada']);
      qa('.sheet-row')[1].click(); await W(400); ok(q('#setDrawer').classList.contains('open') && E('activeTab') === 'settings', 'Definições na barra lateral'); E('closeDrawer()'); await W(30); eq(E('activeTab'), 'characters');
      q('#moreBtn').click(); await W(20); eq(qa('.ctx-item').map(x => x.textContent), ['Novo Projeto', 'Abrir Projeto…', 'Guardar Projeto', 'Fechar Projeto', 'Anular', 'Refazer']); w.closeMenu(); }); });
  await T('Z10 telemóvel deitado: barra lateral com os cinco destinos e o nome do projeto à vista', async () => { fx(); commit(); flushSave();
    await phone(740, 360, async (w, d) => { eq(d.body.dataset.nav, 'compact'); eq([...d.querySelectorAll('#rail .nav-item')].map(b => b.textContent), ['Narrativa', 'Plano', 'Elementos', 'Referências', 'Mais']);
      ok(d.querySelector('#createBtn').offsetParent && !d.querySelector('#bnav').offsetParent); ok(d.querySelector('#projName').offsetWidth > 40, 'o nome do projeto está escondido');
      ok(!d.querySelector('#board-scroll').hidden, 'deitado, a Narrativa é o quadro'); const rl = d.querySelector('#rail'); ok(rl.scrollHeight <= rl.clientHeight + 1, 'a barra lateral não cabe'); }); });
  /* ----- línguas, privacidade, linhas de escrita e revisão, listas de palavras, acessibilidade ----- */
  const SRC = ['core', 'board', 'fichas', 'tabs', 'nav', 'projects', 'plan', 'device', 'sync', 'update', 'tour', 'tips', 'prefs', 'data', 'i18n', 'view', 'find'];
  const txtOf = async f => (await fetch(f, {cache:'no-store'})).text();
  await T('Q01 _(), _n() e _x(): marcadores, plural e contexto; sem dicionário, o português', () => {
    eq(_('Tomo «{nome}»', {nome:'X'}), 'Tomo «X»'); eq(_n(1, '{n} Cena', '{n} Cenas'), '1 Cena'); eq(_n(3, '{n} Cena', '{n} Cenas'), '3 Cenas');
    eq(_x('estado', 'Escrita'), 'Escrita'); eq(LANG, 'pt'); eq(document.documentElement.lang, 'pt-PT'); eq(Object.keys(LANGS), ['pt', 'en', 'es', 'fr']); });
  await T('Q02 dicionários EN, ES e FR: todos os textos da interface, com os mesmos marcadores', async () => {
    const LIT = "'((?:[^'\\\\\\n]|\\\\.)*)'", unq = x => x.replace(/\\(.)/g, (m, c) => c === 'n' ? '\n' : c), keys = new Set();
    for (const f of SRC){ const t = await txtOf('js/' + f + '.js'); let m;
      const r1 = new RegExp('(?<![\\w$])_\\(\\s*' + LIT, 'g'); while ((m = r1.exec(t))) keys.add(unq(m[1]));
      const r2 = new RegExp('(?<![\\w$])_n\\([^,]+,\\s*' + LIT + '\\s*,\\s*' + LIT, 'g'); while ((m = r2.exec(t))){ keys.add(unq(m[1])); keys.add(unq(m[2])); }
      const r3 = new RegExp('(?<![\\w$])_x\\(\\s*' + LIT + '\\s*,\\s*' + LIT, 'g'); while ((m = r3.exec(t))) keys.add(unq(m[1]) + '|' + unq(m[2])); }
    ok(keys.size > 1000, 'poucos textos: ' + keys.size);
    const ph = x => (String(x).match(/\{\w+\}/g) || []).sort().join();
    for (const l of ['en', 'es', 'fr']){ const box = {}; new Function('I18N', await txtOf('js/lang-' + l + '.js'))(box); const d = box[l]; ok(d, 'sem dicionário ' + l);
      const miss = [...keys].filter(k => !(k in d)), bad = [...keys].filter(k => k in d && ph(k) !== ph(d[k]));
      eq(miss.slice(0, 5), [], l + ': faltam ' + miss.length); eq(bad.slice(0, 5), [], l + ': marcadores'); } });
  await T('Q03 Materiais de Apoio de cada língua: as 11 secções, 12 narradores, nomes únicos e «Ver também» sem ligações partidas', async () => {
    const KEYS = ['narrador', 'figuras', 'estilo', 'recursos', 'tecnicas', 'metodos', 'estilos-narrativos', 'pontuacao', 'ortografia', 'sintaxe', 'escrita-antiga'];
    for (const l of ['pt', 'en', 'es', 'fr']){ const S = [], N = [];
      for (const f of SUPPORT_FILES[l]) new Function('SUPPORT', 'NARRATORS', await txtOf(f))(S, N);
      eq(S.map(x => x.key).sort(), [...KEYS].sort(), l + ': secções'); eq(N.length, 12, l + ': narradores');
      const names = new Map(); S.forEach(x => x.groups.forEach(g => g.items.forEach(it => names.set(it.n, (names.get(it.n) || 0) + 1))));
      eq([...names].filter(([n, c]) => c > 1).map(([n]) => n), [], l + ': nomes repetidos');
      const broken = []; S.forEach(x => x.groups.forEach(g => g.items.forEach(it => (it.s || []).forEach(n => { if (!names.has(n)) broken.push(it.n + ' → ' + n); }))));
      eq(broken.slice(0, 8), [], l + ': ' + broken.length + ' ligações partidas');
      N.forEach(n => ok(names.has(n.name), l + ': o narrador «' + n.name + '» não tem ficha'));
      ok(S.some(x => x.groups.some(g => g.items.some(it => it.w && it.w.length > 30))), l + ': sem listas de palavras'); } });
  await T('Q04 aviso de privacidade: na primeira abertura e sempre no fim das Definições', async () => {
    localStorage.removeItem(LS_PRIV); welcomeIfNeeded(); await W(30);
    ok(topModal() && topModal().textContent.includes('Bem-vindo ao Narrative') && topModal().textContent.includes('gratuita e sem fins lucrativos'));
    ok(topModal().textContent.includes(onPhoneOrTablet() ? 'unicamente gravados no seu aparelho' : 'unicamente gravados no seu computador') && topModal().textContent.includes('encriptado') && topModal().textContent.includes('não recolhe nenhuns dados nem analytics'));
    eq([...topModal().querySelectorAll('.lang-seg button')].map(b => b.textContent), ['Português', 'English', 'Español', 'Français']);
    btn('Começar').click(); await W(20); eq(modals().length, 0); eq(lsGet(LS_PRIV), '1'); welcomeIfNeeded(); await W(20); eq(modals().length, 0, 'só uma vez');
    setTab('settings'); await W(20); const cards = [...$('#view-page .settings').children]; ok(cards[cards.length - 1].classList.contains('privacy-card'), 'o aviso é o último cartão');
    ok($('.lang-card') && $('.a11y-card')); ok($('#langBtn') && $('#langBtn').textContent === 'PT'); });
  await T('Q05 «A escrita vai aqui» e «A revisão vai aqui»: no quadro e na Lista, antes da primeira Cena por escrever e por rever', async () => {
    const f = fx(); setTab('board'); renderAll(); await W(30);
    const marks = () => [...document.querySelectorAll('#lines .frontier text:not(.fr-top)')].map(t => t.textContent);
    eq(marks(), ['A escrita vai aqui'], 'nada escrito: só a escrita, no início');
    const order = narrOrder(); setStage(order[0], 'write', true); setStage(order[1], 'write', true); await W(30);
    eq(marks(), ['A escrita vai aqui', 'A revisão vai aqui']); eq([...document.querySelectorAll('#lines .fr-top')].map(t => t.textContent), marks(), 'a legenda repete-se no cimo');
    eq(frontiers().map(x => x.id), [order[2], order[0]]);
    const x = parseFloat(document.querySelector('#lines .fr-write path').getAttribute('d').slice(1)); ok(Math.abs(x - (cur['s:' + order[2]].x - 9)) < 2, 'a linha fica antes da Cena');
    order.forEach(id => { setStage(id, 'write', true); setStage(id, 'review', true); }); await W(30); eq(marks(), [], 'tudo revisto: sem linhas');
    setStage(order[3], 'review', false); await W(30); eq(marks(), ['A revisão vai aqui']); commit(); flushSave();
    await phone(390, 800, async (w, d) => { const r = [...d.querySelectorAll('.nl-frontier')].map(e => e.textContent); eq(r, ['A revisão vai aqui']); }); });
  await T('Q06 listas de palavras das reformas: pesquisa sem acentos, contagem, e a pesquisa geral leva à palavra', async () => {
    openSupportFicha('Reforma ortográfica de 1911'); const m = topModal(); const rows = () => m.querySelectorAll('.wl-table tbody tr').length;
    ok(rows() > 300, 'lista curta: ' + rows()); const inp = m.querySelector('.wl input'); inp.value = 'PHARMACIA'; inp.dispatchEvent(new Event('input'));
    ok(rows() >= 1 && rows() < 5); ok(m.querySelector('.wl-new').textContent.includes('farmácia')); ok(/\d+ de \d+ palavras?/.test(m.querySelector('.wl .muted').textContent)); closeAllModals();
    ok(supportSearch('pharmacia').some(r => r.it.n === 'Reforma ortográfica de 1911'), 'a pesquisa geral encontra a palavra');
    openSupportFicha('Reforma ortográfica de 1911', 'pharmacia'); ok(topModal().querySelector('.wl input').value === 'pharmacia' && topModal().querySelectorAll('.wl-table tbody tr').length < 5); closeAllModals();
    for (const n of ['Acordo Ortográfico de 1945', 'Alterações de 1971 (Brasil) e 1973 (Portugal)', 'Acordo Ortográfico de 1990']) ok((supportIndex.get(n) || {it:{}}).it.w, 'sem lista: ' + n);
    ok(SUPPORT.find(x => x.key === 'pontuacao').groups.some(g => g.name === 'Quando usar o quê'), 'pontuação: quando usar o quê'); });
  await T('Q07 acessibilidade: tamanho do texto, animações, contraste e cores dos Arcos Narrativos (anulável)', async () => {
    try { setA11y('size', 'xl'); eq(document.body.dataset.fs, 'xl'); setA11y('motion', 'reduce'); ok(document.body.classList.contains('reduce-motion'));
      setA11y('contrast', true); ok(document.body.classList.contains('hc')); eq(getComputedStyle(document.body).getPropertyValue('--muted').trim(), getComputedStyle(document.body).getPropertyValue('--text').trim());
    } finally { lsSet(LS_A11Y, '{}'); applyA11y(); }
    eq(document.body.dataset.fs, 'm'); const f = fx(); f.A.hue = 10; f.A.sat = 72; commit(); recolorArcs(); commit(); eq([f.A.hue, f.A.sat], ARC_TONES[0]); undo(); eq([arcById(f.A.id).hue, arcById(f.A.id).sat], [10, 72]); });
  await T('Q08 ficha da Cena: a fita do percurso — nomes, posição, linhas até às caixas das Cenas, bifurcação e convergência; a ficha não fecha ao navegar e desliza', async () => {
    state = demoProjectMini(); state.scenes.s7.convergeTo = 's9'; commit(); renderAll(); closeAllModals();
    const q = s => topModal().querySelector(s), qa = s => [...topModal().querySelectorAll(s)], names = s => qa(s + ' .ft-node').map(n => n.textContent + (n.classList.contains('alt') ? '*' : ''));
    const title = () => q('.ficha input').value, cssColor = css => { const d = h('span', {style:{color:css}}); document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; };
    openSceneFicha('s1'); const box = topModal();
    eq(qa('.ft-here .ft-long').map(x => x.textContent), ['1 de 10', '1 de 4']); eq(qa('.ft-end').map(x => x.textContent), ['Início do livro', 'Início do Arco']);
    eq(qa('.ft-arrow').map(b => b.dataset.nav + (b.disabled ? ' ×' : '')), ['narr-prev ×', 'arc-prev ×', 'narr-next', 'arc-next'], 'setas agrupadas por lado: anteriores à esquerda, seguintes à direita'); eq(names('.ft-trk.narr .ft-c.next'), ['A casa da avó']);
    eq(getComputedStyle(q('[data-nav="narr-next"]')).backgroundColor, 'rgb(255, 255, 255)', 'a seta do livro é branca'); eq(getComputedStyle(q('[data-nav="arc-next"]')).backgroundColor, cssColor(arcColor(arcById('a1'))), 'a do Arco tem a cor do Arco');
    ok(parseFloat(getComputedStyle(q('.ft-trk.arc .ft-here'), '::after').height) >= 6, 'linhas grossas'); eq(getComputedStyle(q('.ft-trk.narr'), '::before').content, 'none', 'a linha não atravessa a ficha');
    { const cell = q('.ft-trk.narr .ft-c.next'), cr = cell.getBoundingClientRect(), nr = cell.querySelector('.ft-node').getBoundingClientRect(), fr = q('.scn-fita').getBoundingClientRect(), ln = getComputedStyle(cell, '::after');
      ok(Math.abs(nr.right - cr.right) < 1.5 && ln.display !== 'none' && ln.content !== 'none' && cr.width > nr.width - 1, 'a linha estica-se até à caixa da Cena seguinte, encostada à direita: ' + JSON.stringify([nr.right, cr.right, ln.display, ln.width, cr.width, nr.width])); ok(fr.right - cr.right < 30, 'e a fita ocupa a largura toda da ficha');
      eq(qa('.ft-cap').map(x => x.textContent), ['Ordem Narrativa', 'Ordem Cronológica'], 'cada linha tem a sua legenda'); }
    eq(getComputedStyle(q('.ft-trk.narr .ft-here'), '::before').display, 'none', 'no início do livro não há linha para trás'); eq(getComputedStyle(q('[data-nav="arc-next"]')).backgroundImage, 'none', 'sem bifurcação, a seta tem só a cor do Arco'); ok(!q('.modal-head .ft-arrow') && !q('.modal-head button:not(.icon-btn)'), 'a linha do título fica só com o título e o ✕');
    ok(q('.scn-fita').offsetHeight <= 100, 'a fita, com as duas legendas, ocupa pouco: ' + q('.scn-fita').offsetHeight + ' px');
    q('[data-nav="narr-next"]').click(); await W(20);
    ok(topModal() === box && modals().length === 1, 'é a mesma ficha, não uma nova'); eq(title(), 'A casa da avó'); eq(openModals[0].entity, {kind:'scene', id:'s2'}); eq(document.activeElement.dataset.nav, 'narr-next', 'o foco fica na seta');
    { const back = box.closest('.modal-back'), g = back.querySelector('.slide-ghost'); ok(g && g.inert && g.querySelector('.ficha input').value === 'Inês desembarca na ilha', 'a Cena anterior sai para o lado, com o que lá estava'); ok(!g.querySelector('.ft-sides') && !g.querySelector('[id]'), 'a cópia não leva as setas nem ids');
      ok(back.classList.contains('sliding') && box.getAnimations().some(a => !(window.CSSAnimation && a instanceof CSSAnimation)), 'a nova entra do outro lado, sem recomeçar a animação de abertura (era o que fazia piscar)');
      eq(getComputedStyle(box).animationName, 'pop'); ok(q('.ft-side.next').getAnimations().length > 0, 'as setas fazem o movimento contrário: ficam paradas no ecrã');
      const an = back._slide.anims; an.forEach(a => { a.pause(); a.currentTime = 0; }); const r0 = box.getBoundingClientRect().left, g0 = g.getBoundingClientRect().left, a0 = q('.ft-side.next').getBoundingClientRect().left;
      an.forEach(a => a.currentTime = 120); const r1 = box.getBoundingClientRect().left, g1 = g.getBoundingClientRect().left, a1 = q('.ft-side.next').getBoundingClientRect().left; an.forEach(a => a.finish());
      ok(r0 > r1 && g0 > g1 && r0 - g0 > box.offsetWidth, 'para a frente: a nova vem da direita e a anterior sai pela esquerda, lado a lado: ' + JSON.stringify([r0, r1, g0, g1])); ok(Math.abs(a0 - a1) < 1, 'a seta não se mexe');
      ok(Math.abs((r0 - g0) - (r1 - g1)) < 1.5, 'carrossel: as duas andam juntas, à mesma distância uma da outra: ' + JSON.stringify([r0 - g0, r1 - g1]));
      { const end = an[1].effect.getComputedTiming().duration, br = back.getBoundingClientRect(), vl = Math.max(br.left, 0); an.forEach(a => { a.pause(); a.currentTime = end - 1; });
        const gr = g.getBoundingClientRect(), nb = box.getBoundingClientRect(), g9 = gr.right; an.forEach(a => a.currentTime = end * .6); const g6 = g.getBoundingClientRect().right;
        ok(g9 <= vl + 2, 'quando a nova chega ao lugar, a anterior acabou de sair da área visível (não fica parada à beira): ' + JSON.stringify([g9, vl, nb.left]));
        ok(g6 > vl + 2, 'e não sai antes disso'); an.forEach(a => a.finish()); }
      await W(20); ok(!back.querySelector('.slide-ghost') && !back.classList.contains('sliding'), 'no fim, a cópia sai'); }
    // bifurcação: a linha do Arco divide-se; a seta segue em frente e a Cena do Ramo fica por baixo, na cor do Ramo
    eq(names('.ft-trk.arc .ft-c.next'), ['A carta por abrir', 'Duarte foge de casa*']); ok(q('[data-nav="arc-next"]').classList.contains('fork'), 'a seta mostra a bifurcação');
    { const bg = getComputedStyle(q('[data-nav="arc-next"]')).backgroundImage; ok(/gradient/.test(bg) && bg.includes(cssColor(arcColor(arcById('a1')))) && bg.includes(cssColor(arcColor(arcById('a3')))), 'na bifurcação, a seta mistura as cores dos dois Arcos: ' + bg);
      const ink = [.082, .09, .11]; [arcById('a1'), arcById('a3')].forEach(x => ok(contrast(cssColor(arcColor(x)).match(/[\d.]+/g).slice(0, 3).map(v => v / 255), ink) >= 7, 'o símbolo lê-se sobre as duas cores')); }
    eq(getComputedStyle(q('[data-nav="arc-next-1"]')).backgroundColor, cssColor(arcColor(arcById('a3')))); ok(parseFloat(getComputedStyle(q('[data-nav="arc-next-1"]'), '::before').height) > 20, 'cotovelo da bifurcação');
    qa('.ft-arrow, .ft-node').forEach(x => ok(tipFor(x) && tipFor(x).text && x.getAttribute('aria-label'), 'sem explicador: ' + x.dataset.nav)); ok(tipFor(q('.ft-here')), 'a posição tem explicador');
    // na bifurcação, a seta abre a escolha: primeiro o caminho deste Arco, depois o Ramo, com o foco já no menu
    q('[data-nav="arc-next"]').click(); await W(20); eq(title(), 'A casa da avó', 'a seta não escolhe sozinha'); eq(menuLabels(), ['A carta por abrir · O regresso de Inês', 'Duarte foge de casa · A fuga de Duarte']);
    ok(document.activeElement && document.activeElement.classList.contains('ctx-item'), 'o foco vai para o menu');
    document.querySelectorAll('.ctx-item')[0].click(); await W(20); eq(title(), 'A carta por abrir', 'continuar no Arco'); eq(document.activeElement.dataset.nav, 'arc-next', 'o foco volta à seta usada');
    q('[data-nav="arc-prev"]').click(); await W(20); eq(title(), 'A casa da avó'); { const g = box.closest('.modal-back').querySelector('.slide-ghost'), an = box.closest('.modal-back')._slide.anims; an.forEach(a => { a.pause(); a.currentTime = 0; }); ok(box.getBoundingClientRect().left < g.getBoundingClientRect().left, 'para trás, a nova vem da esquerda'); an.forEach(a => a.finish()); }
    q('[data-nav="arc-next-1"]').click(); await W(20); eq(title(), 'Duarte foge de casa', 'a Cena da fita leva ao Ramo'); eq(document.activeElement.dataset.nav, 'arc-next');
    ok(q('[data-nav="arc-prev"]').classList.contains('fork')); eq(names('.ft-trk.arc .ft-c.prev'), ['A casa da avó']); eq(getComputedStyle(q('[data-nav="arc-next"]')).backgroundColor, cssColor(arcColor(arcById('a3'))));
    q('[data-nav="arc-next"]').click(); await W(20); eq(title(), 'Noite no cais', 'com um só caminho, a seta vai direta'); ok(q('[data-nav="arc-next"]').classList.contains('merge'), 'a seta mostra a convergência'); ok(/gradient/.test(getComputedStyle(q('[data-nav="arc-next"]')).backgroundImage), 'e mistura as cores');
    q('[data-nav="arc-next"]').click(); await W(20); eq(title(), 'O que a avó sabia', 'convergência: um só caminho, vai direta'); eq(names('.ft-trk.arc .ft-c.prev'), ['A carta por abrir', 'Noite no cais*']);
    q('[data-nav="arc-prev"]').click(); await W(20); eq(title(), 'O que a avó sabia'); eq(menuLabels(), ['A carta por abrir · O regresso de Inês', 'Noite no cais · A fuga de Duarte'], 'na convergência, escolhe-se de onde vir');
    document.querySelectorAll('.ctx-item')[1].click(); await W(20); eq(title(), 'Noite no cais'); q('[data-nav="arc-next"]').click(); await W(20); eq(title(), 'O que a avó sabia');
    ok(q('[data-nav="arc-next"]').disabled); eq(qa('.ft-end').map(x => x.textContent), ['Fim do Arco']);
    // a ficha acompanha o que muda no projeto: ao anular, a fita volta a desenhar-se
    state.scenes.s7.convergeTo = null; commit(); renderAll(); topModal() && openModals[0].redraw(); eq(names('.ft-trk.arc .ft-c.prev'), ['A carta por abrir']);
    await W(900); ok(!document.querySelector('.slide-ghost, .modal-back.sliding'), 'a animação termina');
    closeAllModals(); fx(); });
  await T('Q09 ficha da Cena: ← e → percorrem o livro e, com Shift, o Arco Narrativo — não ao escrever, nem com outra janela por cima, nem na visita', async () => {
    state = demoProjectMini(); commit(); renderAll(); closeAllModals(); openSceneFicha('s2'); const box = topModal();
    const title = () => box.querySelector('.ficha input').value;
    const key = (k, o, el) => { const ev = new KeyboardEvent('keydown', Object.assign({key:k, bubbles:true, cancelable:true}, o || {})); (el || document.body).dispatchEvent(ev); return ev.defaultPrevented; };
    ok(key('ArrowRight'), 'a tecla é usada'); eq(title(), 'Luz apagada'); eq(modals().length, 1); key('ArrowLeft'); eq(title(), 'A casa da avó');
    key('ArrowRight', {shiftKey:true}); eq(title(), 'A casa da avó', 'Shift + → numa bifurcação abre a escolha'); eq(menuLabels().length, 2); ok(document.activeElement.classList.contains('ctx-item'), 'com o foco no menu');
    ok(!key('ArrowRight'), 'com o menu aberto, as setas não mudam de Cena'); eq(title(), 'A casa da avó');
    document.activeElement.click(); await W(20); eq(title(), 'A carta por abrir', 'Shift: pelo Arco'); key('ArrowLeft', {shiftKey:true}); eq(title(), 'A casa da avó');
    key('ArrowLeft'); key('ArrowLeft'); eq(title(), 'Inês desembarca na ilha', 'no início do livro, ← não faz nada');
    slideStop(box.closest('.modal-back')); key('ArrowRight', {repeat:true}); eq(title(), 'A casa da avó'); ok(!document.querySelector('.slide-ghost') && !box.getAnimations().some(a => !(window.CSSAnimation && a instanceof CSSAnimation)), 'tecla premida: sem animação');
    const inp = box.querySelector('.ficha input'); inp.focus(); ok(!key('ArrowLeft', null, inp), 'num campo de texto, a seta é do texto'); ok(!key('ArrowLeft', null, box.querySelector('.ficha textarea'))); ok(!key('ArrowLeft', null, box.querySelector('.ficha select'))); eq(title(), 'A casa da avó');
    const chk = box.querySelector('.ficha .steps3 button'); ok(chk, 'há botões de estado na ficha'); ok(key('ArrowRight', null, chk), 'num botão, navega'); eq(title(), 'Luz apagada'); key('ArrowLeft');
    ok(!key('ArrowRight', {ctrlKey:true}) && !key('ArrowRight', {altKey:true}), 'com Ctrl ou Alt, não'); eq(title(), 'A casa da avó');
    openCharFicha(state.characters[0].id); ok(!key('ArrowRight'), 'com outra ficha por cima, não'); openModals[openModals.length - 1].close(); eq(title(), 'A casa da avó');
    Tour.active = true; try { key('ArrowRight'); eq(title(), 'A casa da avó', 'na visita guiada, as setas são da visita'); } finally { Tour.active = false; }
    closeAllModals(); ok(!key('ArrowRight'), 'sem ficha aberta, nada'); fx(); });
  await T('Q10 fita e setas: no PC as setas ficam fora da ficha, a meio da altura; em janelas estreitas, nas pontas das linhas; no telemóvel, a fita fica fixa em baixo', async () => {
    state = demoProjectMini(); commit(); flushSave();
    const probe = async (w, hh) => { let r; await phone(w, hh, async (win, d) => { win.eval("closeAllModals(); quietModals = true; openSceneFicha('s2'); quietModals = false;"); await W(80);
      const m = d.querySelector('.modal.scene-modal'), box = m.getBoundingClientRect(), f = d.querySelector('.scn-fita').getBoundingClientRect(), A = k => d.querySelector('.ft-arrow[data-nav="' + k + '"]').getBoundingClientRect();
      const all = ['narr-prev', 'narr-next', 'arc-prev', 'arc-next'].map(A), mid = () => (A('narr-prev').top + A('arc-prev').bottom) / 2, mid0 = mid();
      d.querySelector('.modal-back').scrollTop = 240; await W(30); const mid1 = mid(); d.querySelector('.modal-back').scrollTop = 0;
      r = {wide:m.classList.contains('ft-wide'), out:all.every(x => x.right <= box.left + 1 || x.left >= box.right - 1), inside:all.every(x => x.left >= box.left - 1 && x.right <= box.right + 1),
        seen:all.every(x => x.left >= 0 && x.right <= win.innerWidth), left:A('narr-prev').right <= box.left && A('arc-prev').right <= box.left, right:A('narr-next').left >= box.right && A('arc-next').left >= box.right,
        mid0:Math.round(mid0), mid1:Math.round(mid1), vh:win.innerHeight, fitaTop:Math.round(f.top), fitaBottom:Math.round(f.bottom), headBottom:Math.round(d.querySelector('.modal-head').getBoundingClientRect().bottom),
        noScrollX:d.documentElement.scrollWidth <= win.innerWidth + 1, big:A('narr-prev').width > A('arc-prev').width, short:win.getComputedStyle(d.querySelector('.ft-short')).display !== 'none',
        level:Math.abs(A('narr-prev').top - A('narr-next').top) < 1 && Math.abs(A('arc-prev').top - A('arc-next').top) < 1, inFita:!!d.querySelector('.scn-fita .ft-arrow'),
        names:[...d.querySelectorAll('.ft-node')].map(x => x.textContent).join('|')}; }); return r; };
    let r = await probe(1280, 800); ok(r.wide && r.out && r.left && r.right && r.seen && r.big && r.level && !r.short && !r.inFita, 'PC: setas fora da ficha, de cada lado, a branca maior ' + JSON.stringify(r));
    ok(Math.abs(r.mid0 - r.vh / 2) < 4, 'PC: as setas ficam a meio da altura: ' + r.mid0 + ' de ' + r.vh); ok(Math.abs(r.mid1 - r.mid0) < 2, 'PC: ao deslocar a ficha, as setas ficam no mesmo sítio: ' + r.mid1);
    ok(Math.abs(r.fitaTop - r.headBottom) < 8, 'PC: a fita fica sob o título'); eq(r.names, 'Inês desembarca na ilha|Luz apagada|Inês desembarca na ilha|A carta por abrir|Duarte foge de casa');
    r = await probe(800, 900); ok(!r.wide && r.inside && r.inFita && r.noScrollX && r.level, 'janela estreita: setas nas pontas das linhas da fita ' + JSON.stringify(r)); ok(Math.abs(r.fitaTop - r.headBottom) < 8, 'janela estreita: sob o título');
    r = await probe(390, 800); ok(!r.wide && r.inside && r.inFita && r.noScrollX && r.short, 'telemóvel ' + JSON.stringify(r)); ok(Math.abs(r.fitaBottom - r.vh) < 2, 'telemóvel: a fita fica fixa em baixo: ' + r.fitaBottom + ' de ' + r.vh); });
  await T('Q11 etapa 1: dias da semana curtos no telemóvel, bifurcações na ficha do Arco, cápsulas e gravação na barra de topo, índice das Definições', async () => {
    const f = fx(); const br = newArc('Ramo X', f.A.id, f.a2.id); f.b2.convergeTo = f.a3.id; commit(); const B = arcById(f.b2.arcId);
    openArcFicha(f.A.id); const lk = id => [...topModal().querySelectorAll('.arc-card[data-scene="' + id + '"] .arc-link')].map(x => x.textContent);
    eq(lk(f.a2.id), ['Ramo X'], 'a bifurcação aparece na Cena onde acontece'); eq(lk(f.a3.id), [B.name], 'a convergência aparece na Cena que a recebe'); eq(lk(f.a1.id), []);
    const l = topModal().querySelector('.arc-link'); ok(tipFor(l), 'explicador da etiqueta'); l.click(); eq(modals().length, 2); eq(topModal().querySelector('input').value, 'Ramo X', 'abre a ficha do Ramo'); closeAllModals();
    openArcFicha(B.id); ok(topModal().querySelector('.arc-card[data-scene="' + f.b2.id + '"] .arc-link'), 'e na Cena de onde parte'); closeAllModals();
    eq([...document.querySelectorAll('#topbar .tb-group')].map(g => [...g.children].map(b => b.id).join('+')), ['undoBtn+redoBtn', 'dualBtn+installBtn']);
    setSaveUI('ok'); const lbl = $('#saveState .lbl'); ok(innerWidth > 900 && lbl.getBoundingClientRect().width > 20, 'no PC, a gravação lê-se por extenso'); eq(lbl.textContent, 'Guardado');
    setTab('settings'); await W(30); const toc = [...document.querySelectorAll('.set-toc button')], cards = [...document.querySelectorAll('#view-page .settings > .card')];
    ok(toc.length >= 8 && toc.length <= cards.length, 'um item por cartão com título: ' + toc.length); eq(toc[0].textContent, 'Nome do Projeto'); ok(toc.every(b => tipFor(b)), 'explicadores do índice');
    ok(document.querySelector('.set-toc').getBoundingClientRect().width > 100, 'o índice está à vista no PC'); const pg = $('#view-page');
    pg.scrollTop = pg.scrollHeight; pg.dispatchEvent(new Event('scroll')); await W(30); ok(toc[toc.length - 1].classList.contains('on'), 'no fim, o último cartão fica assinalado');
    pg.scrollTop = 0; pg.dispatchEvent(new Event('scroll')); await W(30); ok(toc[0].classList.contains('on'), 'no início, o primeiro'); setTab('board');
    await phone(390, 800, async (w, d) => { w.eval("filters.calMode = 'month'"); w.setTab('plan'); await W(30); [...d.querySelectorAll('.plan-nav button')].find(b => b.textContent === w.eval("PLAN_VIEWS.find(x => x[0] === 'calendar')[1]")).click(); await W(40);
      const dw = [...d.querySelectorAll('.cal-dow')]; eq(dw.length, 7); ok(dw.every(x => x.getBoundingClientRect().height < 30), 'os nomes dos dias não se partem em duas linhas');
      eq(dw.map(x => x.querySelector('.dow-s').textContent.length <= 3 && w.getComputedStyle(x.querySelector('.dow-l')).display === 'none').filter(Boolean).length, 7);
      }); });
  /* ---- primeira auditoria, propostas 3 a 10 e 12 ---- */
  await T('R01 quadro: estado em cada Cena, um clique avança; a linha «vai aqui» acompanha', async () => { const f = fx();
    const st = id => sceneEl(id).querySelector('.scene-st'); ok(st(f.a1.id) && tipFor(st(f.a1.id)).title === 'Por escrever', 'marca e explicador');
    st(f.a1.id).click(); await W(20); ok(isDone(f.a1, 'write') && !isDone(f.a1, 'review')); ok(st(f.a1.id).classList.contains('wr')); eq(modals().length, 0, 'clicar na marca não abre a ficha');
    st(f.a1.id).click(); await W(20); ok(isDone(f.a1, 'review') && st(f.a1.id).classList.contains('rv')); st(f.a1.id).click(); await W(20); ok(!f.a1.prog, 'o terceiro clique volta a «por escrever»');
    sceneEl(f.a1.id).click(); await W(20); eq(modals().length, 1, 'o resto do cartão continua a abrir a ficha'); });
  await T('R02 filtros: Personagem, POV, Localização e estado destacam Cenas; etiqueta com ✕ e contador; nada muda no projeto', async () => { const f = fx();
    const ana = newCharacter('Ana'), lug = newScenery('Farol'); f.a1.chars.push(ana.id); f.b2.pov = ana.id; f.a3.sceneries.push(lug.id); setStage(f.a1.id, 'write', true); commit(); const snap = JSON.stringify(state);
    const dim = () => ['a1', 'b1', 'a2', 'a3', 'b2', 'a4'].filter(t => sceneEl(f[t].id).classList.contains('dim')).join();
    ok($('#boardBar') && !$('#boardBar').hidden && $('#filterBtn') && tipFor($('#filterBtn')), 'barra do quadro com Filtrar'); eq(dim(), '');
    $('#filterBtn').click(); await W(20); eq(menuLabels(), ['Personagem…', 'Personagem POV…', 'Localização…', 'Por escrever', 'Escritas, por rever', 'Revistas']); ok([...document.querySelectorAll('.ctx-item')].every(x => tipFor(x)), 'explicadores do menu');
    await menuClick('Personagem…'); await pickAC(topModal().querySelector('input'), 'An', 'Ana'); await W(20); eq(dim(), 'b1,a2,a3,a4', 'Personagem: presente ou POV');
    eq($('#boardBar .f-count').textContent, '2 de 6 Cenas'); eq($('#boardBar .f-chip').textContent.replace('✕', ''), 'Personagem: Ana');
    setFilter('st', 'written'); eq(dim(), 'b1,a2,a3,b2,a4', 'os filtros somam-se'); setFilter('char', null); setFilter('st', 'todo'); eq(dim(), 'a1'); setFilter('st', null);
    setFilter('pov', ana.id); eq(dim(), 'a1,b1,a2,a3,a4'); setFilter('pov', null); setFilter('scenery', lug.id); eq(dim(), 'a1,b1,a2,b2,a4');
    $('#boardBar .f-chip .chip-x').click(); await W(20); eq(dim(), '', 'o ✕ retira o filtro'); ok(!$('#boardBar .f-count')); eq(JSON.stringify(state), snap, 'filtrar não altera o projeto'); });
  await T('R03 visto de cada Arco Narrativo: sem visto, a faixa recolhe-se e as Cenas e linhas desse Arco deixam de se ver', async () => { const f = fx(); const snap = JSON.stringify(state);
    const ck = () => document.querySelector('.lane-label[data-arc="' + f.Bq.id + '"] .lane-ck'), y0 = target['s:' + f.a1.id].y, h0 = L.bodyH;
    ok(ck() && ck().getAttribute('aria-checked') === 'true' && tipFor(ck())); ck().click(); await W(20); settle();
    eq(modals().length, 0, 'o visto não abre a ficha'); eq(ck().getAttribute('aria-checked'), 'false'); ok(sceneEl(f.b1.id).classList.contains('gone') && getComputedStyle(sceneEl(f.b1.id)).display === 'none');
    eq(L.bodyH, h0 - B.LANE + B.LANE_OFF, 'a faixa fica fina'); eq(target['s:' + f.a1.id].y, y0); ok(!$('#lines').innerHTML.includes(arcStroke(f.Bq)), 'sem linhas desse Arco');
    eq($('#boardBar .f-chip').textContent.replace('✕', ''), '1 Arco recolhido'); const r = document.querySelector('.lane-row.off').getBoundingClientRect(); ok(!hoverAt(L.chapters[0].x + 30, L.laneTop[1] + 5), 'nada se cria numa faixa recolhida');
    document.querySelector('.lane-label[data-arc="' + f.Bq.id + '"] .lane-name').click(); await W(20); eq(modals().length, 1, 'o nome continua a abrir a ficha'); closeAllModals();
    ck().click(); await W(20); ok(!sceneEl(f.b1.id).classList.contains('gone')); eq(L.bodyH, h0); eq(JSON.stringify(state), snap); layoutInvariants(); });
  await T('R04 vistas no PC: Quadro, Compacta e Lista; arrastar na Lista muda a ordem', async () => { const f = fx(); if (navMode() !== 'rail') return;
    const seg = k => $('#boardBar .view-seg button[data-v="' + k + '"]'); ok(seg('board') && seg('compact') && seg('list') && [seg('board'), seg('compact'), seg('list')].every(b => tipFor(b)), 'três vistas com explicador');
    eq(seg('board').getAttribute('aria-pressed'), 'true'); const h1 = sceneEl(f.a1.id).getBoundingClientRect().height; eq(Math.round(h1), 56);
    seg('compact').click(); await W(30); settle(); eq(B.SH, 28); eq(Math.round(sceneEl(f.a1.id).getBoundingClientRect().height), 28, 'as Cenas reduzem-se a etiquetas'); ok(document.body.classList.contains('dens-compact')); layoutInvariants();
    ok(sceneEl(f.a1.id).querySelector('.scene-st').offsetParent, 'o estado continua à vista'); await dragTo(sceneEl(f.a1.id), dropX('scene', f.a1.id, f.c1.id, 2)); eq(titles()[0][0], ['b1', 'a2', 'a1'], 'arrastar funciona na vista Compacta'); snackEl().querySelector('.snack-undo').click(); await W(30);
    seg('list').click(); await W(30); ok(!$('#narrList').hidden && $('#board-scroll').hidden, 'Lista no PC'); ok(!$('#narrList .nl-top'), 'a escolha da vista está na barra'); eq(seg('list').getAttribute('aria-pressed'), 'true');
    const row = t => [...document.querySelectorAll('.nl-row')].find(x => x.querySelector('b').textContent === t), ra = row('a1').getBoundingClientRect(), rb = row('a2').getBoundingClientRect();
    const me = (type, el, x, y) => el.dispatchEvent(new PointerEvent(type, {bubbles:true, cancelable:true, clientX:x, clientY:y, button:0, pointerId:1, pointerType:'mouse'}));
    me('pointerdown', row('a1'), ra.left + 60, ra.top + 10); me('pointermove', window, ra.left + 60, ra.top + 30); me('pointermove', window, rb.left + 60, rb.bottom - 6); ok(document.querySelector('.nl-drop') && !document.querySelector('.nl-drop').hidden, 'linha a mostrar onde fica');
    me('pointerup', window, rb.left + 60, rb.bottom - 6); await W(30); eq(titles()[0][0], ['b1', 'a2', 'a1'], 'arrastar na Lista reordena'); ok(snackEl().textContent.includes('Cena «a1» movida')); eq(modals().length, 0, 'largar não abre a ficha');
    seg('board').click(); await W(30); eq(B.SH, 56); ok($('#narrList').hidden); });
  await T('R05 ampliação: − + 100 % e Ajustar; arrastar e criar continuam certos com o quadro reduzido; mini-mapa', async () => { const f = fx(); if (navMode() !== 'rail') return;
    const z = $('#zoomBox'); ok(z && !z.hidden && [...z.querySelectorAll('button')].every(b => tipFor(b)), 'controlo de ampliação com explicadores'); eq(z.querySelector('.zoom-pct').textContent, '100%');
    z.querySelector('[data-z="out"]').click(); z.querySelector('[data-z="out"]').click(); z.querySelector('[data-z="out"]').click(); eq(Z(), .7); eq(z.querySelector('.zoom-pct').textContent, '70%'); settle();
    const r = sceneEl(f.a1.id).getBoundingClientRect(); ok(Math.abs(r.width - 140 * .7) < 1.5, 'as Cenas ficam mais pequenas: ' + r.width);
    const bl = $('#board').getBoundingClientRect().left, cx = bl + (L.chapters[0].x + B.CP + B.SW + 10) * Z(); await dragTo(sceneEl(f.a1.id), cx); eq(titles()[0][0], ['b1', 'a1', 'a2'], 'largar cai no sítio certo a 70 %'); settle();
    const br = $('#bodyLayer').getBoundingClientRect(), c2 = L.chapters[1]; const at = hoverAt((br.left + (c2.x + B.CP + B.SW + 4) * Z() - br.left) / Z(), L.laneTop[0] + 20); ok(at && at.chId === f.c2.id && at.idx === 1, 'criar com o rato aponta para o sítio certo: ' + JSON.stringify(at && [at.kind, at.idx]));
    key('0'); eq(Z(), 1, 'tecla 0 repõe'); key('-'); eq(Z(), .9); key('+'); eq(Z(), 1);
    for (let i = 0; i < 30; i++){ const c = {id:uid('c'), name:'Cap ' + i, scenes:[]}; f.B2.chapters.push(c); insertScene(c.id, 0, f.A.id).title = 'x' + i; } commit(); settle(); await W(30);
    const mm = $('#miniMap'); ok(mm && !mm.hidden && tipFor(mm), 'mini-mapa quando a narrativa não cabe'); const sc = $('#board-scroll'), mr = mm.getBoundingClientRect();
    pe('pointerdown', mm, mr.right - 6, mr.top + 6); await W(30); ok(sc.scrollLeft > 500, 'clicar no mini-mapa leva a esse ponto: ' + sc.scrollLeft); pe('pointerup', mm, mr.right - 6, mr.top + 6);
    z.querySelector('[data-z="fit"]').click(); await W(30); ok(Z() < 1 && (L.width * Z() <= sc.clientWidth + 2 || Z() === .3), 'Ajustar: a narrativa toda cabe, ou fica no mínimo de 30 % (' + Z() + ')'); eq(sc.scrollLeft, 0); setZoom(1); });
  await T('R06 pesquisa em todo o projeto e ações; atalhos de teclado e a sua folha', async () => { const f = fx(); const ana = newCharacter('Ana Farol'); f.a2.summary = 'Uma tempestade no farol'; state.refs.push({id:'rz', type:'note', title:'Ideia do farol', text:'', links:[], created:1}); commit();
    ok($('#searchBtn') && $('#searchBtn').offsetParent && tipFor($('#searchBtn')), 'botão de pesquisa no topo'); key('/'); await W(20); const inp = () => topModal().querySelector('.find-inp'); ok(inp() && document.activeElement === inp(), '/ abre a pesquisa');
    const groups = () => [...topModal().querySelectorAll('.find-group')].map(x => x.textContent), items = () => [...topModal().querySelectorAll('.find-item .find-l')].map(x => x.textContent);
    eq(groups(), ['Ações'], 'sem texto, mostra as ações'); setInput(inp(), 'farol'); eq(groups().slice(0, 3), ['Cenas', 'Personagens', 'Referências']); eq(items().slice(0, 3), ['a2', 'Ana Farol', 'Ideia do farol'], 'procura também no resumo, sem distinguir maiúsculas');
    key('ArrowDown', {}, inp()); key('Enter', {}, inp()); await W(30); ok(!document.querySelector('.find-modal') && topModal().querySelector('input').value === 'Ana Farol', 'Enter abre a ficha escolhida'); closeAllModals();
    key('k', {ctrlKey:true}); await W(20); setInput(inp(), 'tema claro'); eq(items()[0], 'Tema claro'); key('Enter', {}, inp()); await W(30); eq(themePref(), 'light', 'a pesquisa aceita ações'); setTheme('dark');
    openSearch(); setInput(inp(), 'nova personagem'); ok(items().includes('Criar Personagem') || items().some(x => /Personagem/.test(x)), 'ação de criar'); setInput(inp(), 'zzzz'); ok(topModal().querySelector('.find-none')); key('Escape'); await W(20); eq(modals().length, 0);
    key('?'); await W(20); ok(document.querySelector('.keys-modal') && topModal().querySelectorAll('.key-row').length >= 15, 'folha de atalhos'); key('Escape'); await W(20);
    key('3'); eq(activeTab, 'books'); key('1'); eq(activeTab, 'board'); key('n'); await W(20); ok(topModal().textContent.includes('Nova Cena'), 'N abre «Nova Cena»'); const ti = topModal().querySelector('input'); key('2', {}, ti); eq(activeTab, 'board', 'a escrever, as teclas não são atalhos'); closeAllModals(); });
  await T('R07 eliminar pergunta sempre, e depois a barra em baixo oferece «Anular»', async () => { const f = fx();
    openSceneFicha(f.a4.id); btn('Eliminar Cena').click(); await W(20); ok(topModal().textContent.includes('Eliminar a Cena «a4»?'), 'pergunta'); await answer(false); ok(state.scenes[f.a4.id] && modals().length === 1, 'cancelar: a Cena fica, e a ficha também');
    btn('Eliminar Cena').click(); await W(20); await answer(true); eq(modals().length, 0, 'confirmado, a ficha fecha'); ok(!state.scenes[f.a4.id]); ok(snackEl().textContent.includes('Cena «a4» eliminada') && tipFor(snackEl().querySelector('.snack-undo')));
    snackEl().querySelector('.snack-undo').click(); await W(30); ok(state.scenes[f.a4.id] && !snackEl(), 'Anular repõe a Cena');
    const n = newNote(); n.title = 'Lembrete'; commit(); openRefFicha(n.id); btn('Eliminar', topModal()).click(); await W(20); ok(topModal().textContent.includes('Eliminar a Nota «Lembrete»?')); await answer(true); eq(state.refs.length, 0); ok(snackEl().textContent.includes('Nota «Lembrete» eliminada'));
    const c0 = {id:uid('c'), name:'Vazio', scenes:[]}; state.books[0].chapters.push(c0); commit(); askDeleteChapter(c0.id); await W(20); ok(topModal() && topModal().textContent.includes('Eliminar o Capítulo «Vazio»?'), 'mesmo vazio, um Capítulo pergunta'); await answer(true); ok(snackEl().textContent.includes('Capítulo «Vazio» eliminado'));
    askDeleteChapter(state.books[0].chapters[0].id); await W(20); ok(topModal() && topModal().textContent.includes('e as suas 3 Cenas?'), 'com Cenas, pergunta'); await answer(false);
    const s1 = state.books[0].chapters[0].scenes[0]; deleteScene(s1); commit(); snack('x'); const b = snackEl().querySelector('.snack-undo'); state.project.name = 'Outro'; commit(); b.click(); await W(20); eq(state.project.name, 'Outro', 'depois de outra alteração, o botão da barra já não anula'); ok(!state.scenes[s1]); });
  await T('R08 ficha ao lado: painel à direita, quadro utilizável, Cena aberta assinalada; por omissão, a janela ao centro', async () => { const f = fx(); const ana = newCharacter('Ana'); f.a1.chars.push(ana.id); commit();
    openSceneFicha(f.a1.id); const dk = () => topModal().querySelector('.dock-btn'); ok(dk() && tipFor(dk()), 'botão no cabeçalho da ficha'); ok(!$('.modal-back.docked') && $('main').inert, 'por omissão: janela ao centro');
    const dbg = () => JSON.stringify({w:innerWidth, nav:navMode(), on:Dock.on, docked:!!$('.modal-back.docked'), body:document.body.className});
    if (innerWidth < 1100){ ok(dk().hidden, 'em janelas estreitas não se oferece'); return; }
    ok(topModal().classList.contains('ft-wide'), 'na janela, as setas ficam de fora'); ok(!dk().hidden, 'o botão está à vista ' + dbg()); dk().click(); await W(30);
    const back = $('.modal-back.docked'); ok(back && document.body.classList.contains('dock-on'), 'a ficha passa para o painel ' + dbg()); ok(!$('main').inert && !$('#topbar').inert, 'o que está por trás fica utilizável');
    const br = back.getBoundingClientRect(), mr = $('main').getBoundingClientRect(); ok(br.right >= innerWidth - 1 && mr.right <= br.left + 1, 'o quadro encolhe e nada fica tapado ' + JSON.stringify([br.left, br.right, mr.right, innerWidth])); ok(!topModal().classList.contains('ft-wide') && topModal().querySelector('.scn-fita .ft-arrow'), 'no painel, as setas ficam nas pontas da fita');
    ok(sceneEl(f.a1.id).classList.contains('is-open'), 'a Cena aberta fica assinalada'); pe('pointerdown', sceneEl(f.a2.id), 5, 5); pe('pointerup', window, 5, 5); await W(10); sceneEl(f.a2.id).click(); await W(30); eq(modals().length, 1, 'abrir outra Cena substitui a do painel');
    eq(topModal().querySelector('.title-inp').value, 'a2'); ok(sceneEl(f.a2.id).classList.contains('is-open') && !sceneEl(f.a1.id).classList.contains('is-open'), 'a marca passa para a nova Cena');
    key('ArrowLeft'); await W(30); eq(topModal().querySelector('.title-inp').value, 'b1', '← e → continuam a percorrer'); ok(sceneEl(f.b1.id).classList.contains('is-open'), 'a marca acompanha as setas');
    pe('pointerdown', sceneEl(f.a1.id), 5, 5); pe('pointerup', window, 5, 5); await W(10); sceneEl(f.a1.id).click(); await W(30); const chip = [...topModal().querySelectorAll('.chip.click span')].find(x => x.textContent === 'Ana'); pe('pointerdown', chip, 5, 5); chip.click(); await W(30); eq(modals().length, 2, 'a partir de dentro da ficha, abre por cima'); ok(topModal().closest('.docked'), 'a segunda ficha também fica no painel');
    key('Escape'); await W(20); eq(modals().length, 1); eq(lsGet(LS_DOCK), '1', 'fica lembrado'); dk().click(); await W(30); ok(!$('.modal-back.docked') && !document.body.classList.contains('dock-on') && $('main').inert, 'e volta à janela'); eq(lsGet(LS_DOCK), '0'); });
  await T('R09 listas: iniciais na cor do Arco, tira de presença, procurar, ordenar e linhas — as mesmas ferramentas em todas', async () => { const f = fx();
    const ana = newCharacter('Ana Maria Faria'), rui = newCharacter('rui'), lug = newScenery('Farol'); f.b1.chars.push(ana.id); f.b2.pov = ana.id; f.a4.chars.push(rui.id); f.a3.sceneries.push(lug.id); commit();
    for (const t of ['books', 'characters', 'arcs', 'sceneries', 'refs']){ setTab(t); const hd = $('#view-page .page-head'); ok(hd.querySelector('.list-q') && hd.querySelector('.list-sort') && hd.querySelectorAll('.list-lay button').length === 2, t + ': procurar, ordenar e disposição');
      ok([hd.querySelector('.list-q'), hd.querySelector('.list-sort'), ...hd.querySelectorAll('.list-lay button')].every(x => tipFor(x)), t + ': explicadores'); }
    setTab('characters'); const cards = () => [...document.querySelectorAll('#view-page .card')], names = () => cards().map(c => c.querySelector('h3').textContent);
    eq(names(), ['Ana Maria Faria', 'rui']); const av = cards()[0].querySelector('.avatar'); eq(av.textContent, 'AF', 'iniciais do primeiro e do último nome'); eq(cards()[1].querySelector('.avatar').textContent, 'R');
    ok(av.style.background && tipFor(av), 'cor do Arco em que mais aparece');
    const pr = cards()[0].querySelector('.pres'); ok(pr && tipFor(pr).text.includes('2 de 6 Cenas'), 'presença: ' + tipFor(pr).text); eq(pr.querySelectorAll('i').length, 2, 'um bloco por Tomo'); ok(pr.querySelector('i').style.getPropertyValue('--fill').includes('linear-gradient'));
    const sel = $('#view-page .list-sort'); sel.value = 'scenes'; sel.dispatchEvent(new Event('change')); eq(names(), ['Ana Maria Faria', 'rui']); sel.value = 'first'; sel.dispatchEvent(new Event('change')); eq(names(), ['Ana Maria Faria', 'rui'], 'pela primeira aparição');
    const q = $('#view-page .list-q'); q.focus(); setInput(q, 'RU'); eq(names(), ['rui'], 'procurar não distingue maiúsculas'); ok(document.activeElement === q, 'o foco fica na caixa enquanto se escreve'); setInput(q, 'zz'); ok($('#view-page .empty').textContent.includes('Nada encontrado')); setInput(q, '');
    $('#view-page .list-lay [data-lay="rows"]').click(); await W(20); ok($('#view-page .el-rows') && cards().every(c => c.classList.contains('el-row')), 'em linhas'); ok(cards()[0].querySelector('.pres') && cards()[0].querySelector('.avatar'));
    cards()[1].click(); await W(20); eq(topModal().querySelector('input').value, 'rui', 'uma linha abre a ficha'); closeAllModals(); setTab('arcs'); ok($('#view-page .el-rows'), 'a disposição vale para todas as listas'); eq(lsGet(LS_LAYOUT), 'rows');
    $('#view-page .list-lay [data-lay="cards"]').click(); await W(20); ok($('#view-page .grid')); eq([...document.querySelectorAll('#view-page .card .pres')].length, 2, 'Arcos com tira de presença'); });
  await T('R10 Plano: anéis, linha do tempo das fases, arrastar um evento no calendário e criar um objetivo num dia', async () => { const f = fx(); setStage(f.a1.id, 'write', true); const g = newGoal(); g.title = 'Ver mapa'; g.due = '2030-06-10'; commit();
    setTab('plan'); filters.planView = 'overview'; renderAll(); ok($('#view-page .rings') && $('#view-page .rings').getAttribute('aria-label').includes('Escrita 17%'), 'anéis: ' + $('#view-page .rings').getAttribute('aria-label')); eq($('#view-page .rings').querySelectorAll('circle.ring').length, 1, 'só há traço onde há progresso');
    ok(!$('#view-page .tl'), 'sem datas, sem linha do tempo'); setPhase('write', 'start', '2030-05-01'); setPhase('write', 'end', '2030-07-31'); setPhase('review', 'start', '2030-08-01');
    const tl = $('#view-page .tl'); ok(tl, 'linha do tempo'); eq(tl.querySelectorAll('.tl-bar').length, 1); eq(tl.querySelectorAll('.tl-tick').length, 1, 'uma fase só com início é uma marca'); ok(tl.querySelector('.tl-now') && tl.querySelector('.tl-dots .ev-dot'), 'hoje e os prazos como pontos');
    const bar = tl.querySelector('.tl-bar'); ok(tipFor(bar).text.includes('Arraste as pontas')); const hd = bar.querySelector('.tl-h.e'), hr = hd.getBoundingClientRect(), rows = tl.querySelector('.tl-rows').getBoundingClientRect();
    pe('pointerdown', hd, hr.left + 3, hr.top + 5); hd.dispatchEvent(new PointerEvent('pointermove', {bubbles:true, clientX:rows.right - 2, clientY:hr.top + 5, pointerId:1})); hd.dispatchEvent(new PointerEvent('pointerup', {bubbles:true, clientX:rows.right - 2, clientY:hr.top + 5, pointerId:1})); await W(20);
    ok(phaseOf('write').end > '2030-07-31', 'arrastar a ponta muda a data: ' + phaseOf('write').end); eq(phaseOf('write').start, '2030-05-01');
    filters.planView = 'calendar'; filters.calMonth = '2030-06'; filters.calDay = null; renderAll(); const day = iso => $('#view-page .cal-day[data-day="' + iso + '"]');
    ok(day('2030-06-10').querySelector('.cal-ev[draggable="true"]'), 'os eventos arrastam-se'); ok(moveEvent('goal-' + g.id, '2030-06-12')); eq(goalById(g.id).due, '2030-06-12'); ok(snackEl().textContent.includes('Data alterada'));
    ok(day('2030-06-12').querySelector('.cal-ev') && !day('2030-06-10').querySelector('.cal-ev')); setSceneDue(f.a1.id, 'write', '2030-06-02'); ok(moveEvent('scene-write-' + f.a1.id, '2030-06-03')); eq(stg(f.a1, 'write').due, '2030-06-03'); ok(moveEvent('phase-write-start', '2030-05-02')); eq(phaseOf('write').start, '2030-05-02'); ok(!moveEvent('nada', '2030-06-03'));
    const add = day('2030-06-20').querySelector('.cal-add'); ok(add && tipFor(add)); add.click(); await W(20); const g2 = state.goals[state.goals.length - 1]; eq(g2.due, '2030-06-20', 'o «+» cria um objetivo nesse dia'); ok(topModal().textContent.includes('Objetivo de pesquisa')); closeAllModals();
    day('2030-06-25').click(); await W(20); eq(filters.calDay, '2030-06-25', 'um dia sem eventos também se escolhe'); ok(btn('+ Objetivo de pesquisa neste dia', $('#view-page'))); });
  await T('R11 primeiros passos: exemplo para mexer, modelos de estrutura, «+ Cena» já à vista no quadro vazio e dicas uma só vez', async () => {
    const fs = document.querySelector('.first-scene'); ok(fs && fs.offsetParent && tipFor(fs), 'no quadro vazio, o cartão «+ Cena» já está à vista'); const hint = document.querySelector('.board-hint').getBoundingClientRect(); ok(hint.top >= fs.getBoundingClientRect().bottom - 1, 'a frase de ajuda fica por baixo');
    fs.click(); await W(40); ok(topModal() && topModal().textContent.includes('Arco Narrativo'), 'sem Arcos Narrativos, pede primeiro o Arco'); closeAllModals(); newArc('Trama'); commit(); document.querySelector('.first-scene').click(); await W(40);
    const ren = document.querySelector('.scene-rename'); ok(ren, 'com um Arco, cria logo e pede o título'); setInput(ren, 'Primeira'); key('Enter', {}, ren); await W(30); eq(Object.values(state.scenes).map(s => s.title), ['Primeira']); ok(!document.querySelector('.first-scene'));
    const n0 = Projects.idx.open.length; startExample(); await W(30); eq(Projects.idx.open.length, n0 + 1, 'o exemplo é mais um projeto aberto'); eq(Object.keys(state.scenes).length, 42); ok(!tourMode && LS_KEY, 'é um projeto verdadeiro, que se guarda');
    templateProject('heroi'); await W(30); eq(state.books[0].chapters.length, 12); eq(state.arcs.map(a => a.name), ['Jornada do herói']); eq(Object.keys(state.scenes).length, 0); ok(!Hist.undo.length, 'o modelo é o ponto de partida');
    templateProject('linhas'); eq(state.arcs.map(a => a.name), ['Presente', 'Passado']); eq(state.books[0].chapters.length, 4); templateProject('atos'); eq(state.books[0].chapters.map(c => c.name), ['Ato I — Apresentação', 'Ato II — Confronto', 'Ato III — Resolução']);
    templateDialog(); await W(20); eq([...topModal().querySelectorAll('.tpl-item b')].map(x => x.textContent), ['Três atos', 'Jornada do herói', 'Duas linhas temporais']); ok([...topModal().querySelectorAll('.tpl-item')].every(x => tipFor(x))); closeAllModals();
    Coach.seen = {}; Coach.last = 0; ok(coach('teste', 'Uma dica'), 'a dica aparece'); ok(document.querySelector('.coach') && tipFor(document.querySelector('.coach-x'))); ok(!coach('teste', 'Uma dica'), 'e só uma vez'); document.querySelector('.coach-x').click(); ok(!document.querySelector('.coach'));
    Coach.last = 0; ok(!coach('teste', 'x')); Coach.last = Infinity; });
  await T('R12 fichas: secções que abrem e fecham, com contador; ícones nos campos da Cena; telemóvel sem transbordo com as novas barras', async () => { const f = fx();
    state.refs.push({id:'r1', type:'note', title:'n1', text:'', links:[{kind:'scene', id:f.a1.id}], created:1}, {id:'r2', type:'note', title:'n2', text:'', links:[{kind:'scene', id:f.a1.id}], created:2}); commit(); openSceneFicha(f.a1.id);
    const sec = t => [...topModal().querySelectorAll('.sec')].find(s => s.querySelector('.sec-title').textContent === t); eq(sec('Notas').querySelector('.sec-n').textContent, '2', 'contador'); ok(!sec('Referências').querySelector('.sec-n'), 'sem itens, sem contador');
    const tg = sec('Notas').querySelector('.sec-tog'); ok(tipFor(tg)); tg.click(); ok(sec('Notas').querySelector('.sec-body').hidden && tg.getAttribute('aria-expanded') === 'false'); closeAllModals(); openSceneFicha(f.a2.id); ok(sec('Notas').querySelector('.sec-body').hidden, 'fica lembrado nas outras fichas');
    sec('Notas').querySelector('.sec-tog').click(); ok(!sec('Notas').querySelector('.sec-body').hidden); eq(topModal().querySelectorAll('.field > label .f-ic').length, 7, 'ícones nos campos'); ok(!topModal().querySelector('.posbox').textContent.includes('podem partilhar'), 'Posição mais curta'); closeAllModals();
    await phone(390, 800, async (w, d) => { await W(60); ok(d.querySelector('#boardBar') && !d.querySelector('#boardBar').hidden && d.querySelector('#filterBtn').offsetParent, 'filtros também no telemóvel'); ok(!d.querySelector('#boardBar .view-seg') && d.querySelector('.view-toggle'), 'a escolha Lista/Quadro fica onde estava');
      ok(d.querySelector('#searchBtn').offsetParent, 'pesquisa no topo'); ok(d.documentElement.scrollWidth <= 391, 'sem transbordo no topo: ' + d.documentElement.scrollWidth); ok(d.querySelector('#zoomBox') === null || d.querySelector('#zoomBox').hidden, 'sem ampliação no telemóvel');
      for (const t of ['books', 'characters', 'arcs', 'sceneries', 'refs']){ w.setTab(t); await W(30); ok(d.documentElement.scrollWidth <= 391 && d.querySelector('#view-page').scrollWidth <= 391, t + ' sem transbordo'); }
      w.eval("filters.planView = 'progress'; activeTab = 'plan'; renderAll();"); await W(30); ok(d.querySelector('#view-page').scrollWidth <= 391, 'Escrita e Revisão cabem no telemóvel: ' + d.querySelector('#view-page').scrollWidth);
      w.eval("openSearch()"); await W(30); ok(d.querySelector('.find-modal').getBoundingClientRect().width <= 390); }); });
  /* ---- segunda auditoria revista (14, 15, 17, 18, 20, 21, 23) e pedidos de 2026-11-24 ---- */
  await T('S01 Localizações: o nome novo em toda a interface e nos três dicionários', async () => { const f = fx(); const lug = newScenery(); eq(lug.name, 'Nova Localização'); commit();
    eq(TABS.find(t => t[0] === 'sceneries')[1], 'Localizações'); setTab('sceneries'); eq($('#view-page h1').textContent, 'Localizações'); ok(btn('+ Nova Localização', $('#view-page')));
    openSceneryFicha(lug.id); ok(topModal().textContent.includes('Ficha da Localização') && btn('Eliminar Localização')); closeAllModals(); openSceneFicha(f.a1.id); ok([...topModal().querySelectorAll('.field > label')].some(l => l.textContent === 'Localizações')); closeAllModals();
    for (const l of ['en', 'es', 'fr']){ const src = await (await fetch('js/lang-' + l + '.js')).text(); ok(!/Cenário/.test(src), l + ': ainda há chaves com «Cenário»'); ok(!/Scenery|Sceneries|Escenario|Décor/.test(src), l + ': a tradução ainda usa o nome antigo'); ok(/Location|Lugar|Lieu/.test(src)); ok(!/Localizaci/.test(src), l + ': em espanhol é «Lugar»'); }
    for (const f2 of ['js/tips.js', 'js/tour.js', 'js/fichas.js', 'js/tabs.js']){ const src = await (await fetch(f2)).text(); ok(!/Cenário/.test(src), f2 + ': ainda diz «Cenário»'); } });
  await T('S02 Tomos e Capítulos: os Capítulos numa secção da mesma página, com os mesmos filtros e a mesma procura', async () => { const f = fx(); const ana = newCharacter('Ana'); f.a3.chars.push(ana.id); commit();
    eq(TABS.find(t => t[0] === 'books')[1], 'Tomos e Capítulos'); setTab('books'); eq($('#view-page h1').textContent, 'Tomos e Capítulos'); eq($('#rail .nav-item[data-tab="books"] .nav-label').textContent, 'Tomos', 'na barra, o nome curto');
    eq([...document.querySelectorAll('#view-page .list-subt')].map(x => x.firstChild.textContent), ['Tomos', 'Capítulos']); const ch = () => [...document.querySelectorAll('#view-page .ch-card h3')].map(x => x.textContent);
    eq(ch(), ['C1', 'C2', 'C3']); ok(document.querySelector('#view-page .ch-card .pres'), 'tira de presença do Capítulo'); ok(tipFor(document.querySelector('#view-page .ch-card')));
    ok(document.querySelector('#view-page .ch-card').textContent.includes('Tomo 1 · Capítulo 1') && document.querySelector('#view-page .ch-card').textContent.includes('3 Cenas'));
    filters.booksChar = ana.id; renderAll(); eq(ch(), ['C2'], 'o filtro por Personagem vale para os Capítulos'); filters.booksChar = null; renderAll();
    setInput($('#view-page .list-q'), 'c3'); eq(ch(), ['C3'], 'a procura também'); eq(document.querySelectorAll('#view-page .card:not(.ch-card)').length, 0); setInput($('#view-page .list-q'), '');
    ok(btn('+ Novo Capítulo', $('#view-page')) && tipFor(btn('+ Novo Capítulo', $('#view-page')))); document.querySelectorAll('#view-page .ch-card')[1].click(); await W(60); eq(activeTab, 'board', 'clicar num Capítulo leva-o ao quadro'); });
  await T('S03 importar Personagens, Localizações e Referências de outro projeto aberto', async () => { const f = fx();
    setTab('characters'); const ib = $('#view-page .imp-btn'); ok(ib && tipFor(ib)); ib.click(); await W(20); eq(modals().length, 0, 'sem outro projeto aberto, só avisa'); ok([...document.querySelectorAll('.toast')].some(t => t.textContent.includes('outro projeto aberto')));
    const other = blankProject(); other.project.name = 'Fonte'; other.characters = [{id:'c1', name:'Ana', gender:'F', age:'30', description:'Alta'}, {id:'c2', name:'Rui', gender:'M', age:'', description:''}];
    other.sceneries = [{id:'l1', name:'Farol', chars:['c1', 'c2']}]; other.refs = [{id:'r1', type:'note', title:'Ideia', text:'texto', links:[{kind:'character', id:'c1'}, {kind:'scenery', id:'l1'}, {kind:'book', id:other.books[0].id}], created:1}, {id:'r2', type:'document', title:'Mapa', fileName:'mapa.txt', size:4, mime:'text/plain', links:[], created:2}];
    await idb.put('r2', new Blob(['mapa'], {type:'text/plain'})); const mine = projActive(); const oid = projAdd(sanitize(other)); projSwitch(mine); await W(30); eq(projActive(), mine); eq(state.characters.length, 0);
    const rui = newCharacter('Rui'); commit(); setTab('characters'); $('#view-page .imp-btn').click(); await W(30); const m = topModal(); ok(m.textContent.includes('Fonte'), 'diz de que projeto');
    const items = k => [...m.querySelectorAll('.imp-group[data-kind="' + k + '"] .imp-item')]; eq(items('characters').map(x => [x.querySelector('.imp-name').textContent, x.querySelector('input').checked, x.classList.contains('dup')]), [['Ana', true, false], ['Rui', false, true]], 'aberto a partir das Personagens: vêm escolhidas as que ainda não existem');
    eq(items('sceneries').map(x => x.querySelector('input').checked), [false]); ok(items('characters').every(x => tipFor(x)) && tipFor(m.querySelector('.imp-all')));
    items('sceneries')[0].querySelector('input').click(); m.querySelector('.imp-group[data-kind="refs"] .imp-all').click(); await W(20); eq(topModal().querySelector('.imp-go').textContent, 'Importar 4 elementos');
    topModal().querySelector('.imp-go').click(); await W(120); eq(modals().length, 0); eq(state.characters.map(c => c.name).sort(), ['Ana', 'Rui']); const ana = state.characters.find(c => c.name === 'Ana'); eq([ana.gender, ana.age, ana.description], ['F', '30', 'Alta']); ok(ana.id !== 'c1', 'identificador novo');
    const far = state.sceneries.find(x => x.name === 'Farol'); eq(far.chars.slice().sort(), [ana.id, rui.id].sort(), 'a Localização liga-se à Personagem importada e à que já cá estava com o mesmo nome');
    const idea = state.refs.find(r => r.title === 'Ideia'), map = state.refs.find(r => r.title === 'Mapa'); eq(idea.links, [{kind:'character', id:ana.id}, {kind:'scenery', id:far.id}], 'as ligações a Tomos do outro projeto não vêm');
    const blob = await idb.get(map.id); ok(blob && (await blob.text()) === 'mapa', 'o ficheiro vem com a Referência'); ok(map.id !== 'r2');
    ok([...document.querySelectorAll('.toast')].some(t => /Importado: 1 Personagem, 1 Localização, 2 Referências/.test(t.textContent))); undo(); eq(state.sceneries.length, 0, 'um só Anular desfaz a importação');
    const src = JSON.parse(lsGet(projKey(oid))); eq(src.characters.length, 2, 'o outro projeto não muda'); for (const t of ['sceneries', 'refs']){ setTab(t); ok($('#view-page .imp-btn'), t + ' também tem Importar'); } });
  await T('S04 Materiais de Apoio: nome original entre parênteses; F1 procura neles; a ficha pode ficar ao lado', async () => { fx();
    const e = supportIndex.get('Analepse'); eq(e.it.o, 'Flashback'); eq(supportIndex.get('Jornada do Herói').it.o, 'The Hero’s Journey'); eq(supportIndex.get('Fluxo de consciência').it.o, 'Stream of consciousness'); ok(!supportIndex.get('Ironia').it.o, 'só onde o nome vem de uma expressão estrangeira');
    for (const n in SUPPORT_ORIGINAL.pt) ok(supportIndex.has(n), 'ficha em falta: ' + n);
    openSupportFicha('Jornada do Herói'); eq(topModal().querySelector('h2').textContent, 'Jornada do Herói (The Hero’s Journey)'); ok(topModal().querySelector('h2 .sup-orig')); closeAllModals();
    setTab('support'); filters.supSec = 'metodos'; renderAll(); ok([...document.querySelectorAll('#view-page .card h3')].some(x => x.textContent === 'Método do Floco de Neve (Snowflake Method)'));
    setInput($('#view-page .sup-search'), 'snowflake'); eq(document.querySelector('#view-page .card h3').textContent, 'Método do Floco de Neve (Snowflake Method)', 'procura-se também pelo nome original'); setTab('board');
    key('F1'); await W(20); const inp = topModal().querySelector('.find-inp'); ok(inp && inp.placeholder.includes('Materiais de Apoio'), 'F1 abre a pesquisa nos Materiais de Apoio'); ok(topModal().querySelectorAll('.find-item').length >= 10, 'sem texto, as secções');
    setInput(inp, 'hero journey'); eq(topModal().querySelector('.find-item .find-l').textContent, 'Jornada do Herói (The Hero’s Journey)'); eq([...topModal().querySelectorAll('.find-group')].map(x => x.textContent), ['Materiais de Apoio']);
    key('Enter', {}, inp); await W(30); eq(topModal().querySelector('h2').textContent, 'Jornada do Herói (The Hero’s Journey)'); ok(topModal().querySelector('.dock-btn'), 'a ficha de apoio também pode ficar ao lado'); closeAllModals(); });
  await T('S05 Plano: cartões «a seguir»; Agenda no calendário; prazo em atraso assinalado na Cena', async () => { const f = fx(); setStage(f.a1.id, 'write', true); const g = newGoal(); g.title = 'Ler o diário'; g.due = '2030-01-05'; setSceneDue(f.b1.id, 'write', '2020-01-01'); commit();
    setTab('plan'); filters.planView = 'overview'; renderAll(); const nx = k => $('#view-page .next-card[data-next="' + k + '"]'); ok(nx('write') && nx('review') && nx('due') && nx('goal'), 'quatro cartões'); ok([nx('write'), nx('due')].every(x => tipFor(x)));
    eq(nx('write').querySelector('b').textContent, 'b1'); eq(nx('review').querySelector('b').textContent, 'a1'); ok(nx('due').classList.contains('late') && nx('due').textContent.includes('Prazo em atraso')); eq(nx('goal').querySelector('b').textContent, 'Ler o diário');
    nx('write').click(); await W(20); eq(topModal().querySelector('.title-inp').value, 'b1', 'o cartão abre a Cena'); closeAllModals(); setTab('board');
    const lm = sceneEl(f.b1.id).querySelector('.late-mark'); ok(lm && tipFor(lm).text.includes('Prazo de escrita em atraso'), 'marca no cartão'); ok(!sceneEl(f.a1.id).querySelector('.late-mark')); hover(sceneEl(f.b1.id).querySelector('.scene-title')); ok(tipFor(sceneEl(f.b1.id).querySelector('.scene-title')).text.includes('em atraso'));
    setStage(f.b1.id, 'write', true); ok(!sceneEl(f.b1.id).querySelector('.late-mark'), 'escrita a Cena, a marca sai');
    setTab('plan'); filters.planView = 'calendar'; filters.calMonth = '2030-01'; filters.calMode = null; renderAll(); ok($('#view-page .cal-grid') && !$('#view-page .agenda'), 'no PC, o mês por omissão'); const seg = $('#view-page .cal-mode'); ok(seg && [...seg.querySelectorAll('button')].every(b => tipFor(b)));
    seg.querySelector('[data-mode="agenda"]').click(); await W(20); ok($('#view-page .agenda') && !$('#view-page .cal-grid')); eq([...document.querySelectorAll('#view-page .ag-day')].map(d => d.dataset.day), ['2030-01-05']); ok($('#view-page .ag-day').textContent.includes('Ler o diário'));
    await phone(390, 800, async (w, d) => { w.eval("filters.planView = 'calendar'; filters.calMode = null; activeTab = 'plan'; renderAll();"); await W(40); ok(d.querySelector('#view-page .agenda') && !d.querySelector('#view-page .cal-grid'), 'no telemóvel, a Agenda por omissão'); ok(d.querySelector('#view-page').scrollWidth <= 391); }); });
  await T('S06 fichas em duas colunas na janela larga (não no painel nem em janelas estreitas); Início com «Continuar» e a silhueta', async () => { const f = fx(); openSceneFicha(f.a1.id); const box = topModal(), cols = box.querySelector('.f-cols');
    ok(cols && box.classList.contains('two-col'), 'campos e secções em dois grupos'); eq(cols.children.length, 2); ok(cols.children[0].querySelector('.title-inp') && !cols.children[0].querySelector('.sec') && cols.children[1].querySelector('.sec'), 'campos à esquerda, secções à direita');
    ok(box.querySelector(':scope > .ficha > .modal-foot'), 'os botões ficam por baixo das duas'); const two = getComputedStyle(cols).display === 'grid'; eq(two, innerWidth >= 1180, 'duas colunas só a partir de 1180 px');
    if (two){ const a = cols.children[0].getBoundingClientRect(), b = cols.children[1].getBoundingClientRect(); ok(b.left >= a.right && Math.abs(a.top - b.top) < 2, 'lado a lado'); ok(box.getBoundingClientRect().width > 900); ok(box.classList.contains('ft-wide'), 'as setas continuam de fora'); }
    box.querySelector('.steps3 button[data-st="1"]').click(); await W(20); ok(topModal().querySelector('.f-cols'), 'depois de redesenhar, continua em colunas'); closeAllModals();
    for (const open of [() => openBookFicha(f.B1.id), () => openArcFicha(f.A.id)]){ open(); ok(topModal().querySelector('.f-cols'), 'as outras fichas também'); closeAllModals(); }
    await phone(800, 900, async (w, d) => { w.eval("closeAllModals(); openSceneFicha(Object.keys(state.scenes)[0])"); await W(60); const c = d.querySelector('.f-cols'); ok(c && w.getComputedStyle(c).display !== 'grid', 'numa janela estreita, uma coluna'); ok(d.querySelector('.modal').getBoundingClientRect().width <= 800); });
    flushSave(); const th = projThumb(projActive()); eq(th.querySelectorAll('svg path:not(.lt-book)').length, 2, 'silhueta: uma linha por Arco Narrativo'); eq(th.querySelectorAll('circle').length, 6, 'e um ponto por Cena'); eq(th.querySelectorAll('.lt-book').length, 1, 'com a separação dos Tomos'); ok(!th.textContent, 'sem texto'); });
  /* ---- Localizações principais e secundárias; a visita com um livro de dimensão real e «Explorar o projeto» ---- */
  await T('T01 Localizações principais e secundárias: marcar, filtrar, estrela nas fichas e sugestão quando é recorrente', async () => { const f = fx(); const casa = newScenery('Casa'), cafe = newScenery('Café'); f.a1.sceneries.push(casa.id); f.a2.sceneries.push(casa.id); f.a1.sceneries.push(cafe.id); commit();
    ok(!locSuggest(casa), 'duas Cenas ainda não chegam'); setTab('sceneries'); ok(!$('#view-page .loc-sug')); eq([...document.querySelectorAll('#view-page .card .badge')].map(b => b.textContent), ['Localização Secundária', 'Localização Secundária']);
    openSceneFicha(f.a3.id); btn('+ Associar Localização').click(); await W(20); await pickAC(topModal().querySelector('input'), 'Cas', 'Casa'); await W(30); const nd = document.querySelector('.toast.loc-nudge'); ok(nd && nd.textContent.includes('«Casa» já aparece em 3 Cenas'), 'ao associar à terceira Cena, sugere logo'); ok([...nd.querySelectorAll('button')].every(b => tipFor(b)));
    nd.remove(); closeAllModals(); ok(locSuggest(casa)); setTab('sceneries'); const sg = $('#view-page .loc-sug'); ok(sg && sg.dataset.loc === casa.id && [...sg.querySelectorAll('.btn')].every(b => tipFor(b)), 'sugestão por cima da lista'); ok([...document.querySelectorAll('#view-page .card .badge')].some(b => b.textContent === 'Sugestão: principal'));
    openSceneryFicha(casa.id); ok(topModal().querySelector('.loc-sug'), 'e na ficha'); const tg = () => topModal().querySelector('.main-tog'); eq(tg().textContent.replace('☆', ''), 'Localização Secundária'); ok(topModal().textContent.includes('Aparece em 3 Cenas.'));
    topModal().querySelector('.loc-sug [data-sug="yes"]').click(); await W(20); ok(casa.main === true && !topModal().querySelector('.loc-sug')); eq(tg().getAttribute('aria-pressed'), 'true'); eq(tg().textContent.replace('★', ''), 'Localização Principal'); closeAllModals();
    openSceneFicha(f.a1.id); const chips = [...topModal().querySelectorAll('.field')].find(x => x.querySelector('label').textContent === 'Localizações').querySelectorAll('.chip.click'); ok(chips[0].querySelector('.loc-star') && !chips[1].querySelector('.loc-star'), 'estrela na Localização Principal'); closeAllModals();
    setTab('sceneries'); const names = () => [...document.querySelectorAll('#view-page .card h3')].map(x => x.textContent), seg = k => $('#view-page .loc-seg [data-role="' + k + '"]'); ok([seg('all'), seg('main'), seg('side')].every(b => tipFor(b)));
    seg('main').click(); eq(names(), ['Casa']); seg('side').click(); eq(names(), ['Café']); seg('all').click(); eq(names(), ['Café', 'Casa']);
    openSceneryFicha(casa.id); tg().click(); await W(20); ok(!casa.main && casa.noMain === true && !topModal().querySelector('.loc-sug'), 'desmarcada à mão, não volta a sugerir'); closeAllModals();
    const g = newScenery('Gare'); [f.a1, f.a2, f.a3].forEach(s => s.sceneries.push(g.id)); commit(); setTab('sceneries'); $('#view-page .loc-sug [data-sug="no"]').click(); await W(20); ok(g.noMain === true && !$('#view-page .loc-sug'), '«Não, é secundária» encerra o assunto');
    const d = sanitize(JSON.parse(JSON.stringify(state))); eq(d.sceneries.map(x => [x.name, !!x.main, !!x.noMain]), [['Casa', false, true], ['Café', false, false], ['Gare', false, true]], 'guarda-se com o projeto'); ok(!('main' in d.sceneries[1]), 'sem nada a mais onde não há marca'); });
  await T('T02 projeto da visita: um livro com dimensão real — Tomos, Capítulos, Cenas, Personagens e Localizações', async () => { const d = sanitize(demoProject());
    ok(d.books.length >= 1 && d.books.length <= 3, 'Tomos'); const chs = d.books.flatMap(b => b.chapters); ok(chs.length >= 12 && chs.length <= 24, 'Capítulos: ' + chs.length); ok(chs.every(c => c.scenes.length >= 3 && c.scenes.length <= 5), 'de 3 a 5 Cenas por Capítulo');
    eq(Object.keys(d.scenes).length, chs.reduce((n, c) => n + c.scenes.length, 0), 'todas as Cenas estão num Capítulo'); ok(d.characters.length >= 20 && d.characters.length <= 30, 'Personagens: ' + d.characters.length);
    const mains = new Set(d.books.flatMap(b => b.mainChars)); ok(mains.size >= 2 && mains.size <= 3, 'Personagens Principais: ' + mains.size); ok(d.sceneries.length >= 15 && d.sceneries.length <= 20, 'Localizações: ' + d.sceneries.length);
    const lm = d.sceneries.filter(x => x.main).length; ok(lm >= 2 && lm <= 3, 'Localizações Principais: ' + lm); const used = id => Object.values(d.scenes).filter(s => s.sceneries.includes(id)).length;
    ok(d.sceneries.filter(x => x.main).every(x => used(x.id) >= 5), 'as principais são as mais usadas'); ok(d.sceneries.filter(x => !x.main && used(x.id) <= 2).length >= 8, 'a maior parte das secundárias aparece uma ou duas vezes');
    ok(Object.values(d.scenes).every(s => d.arcs.some(a => a.id === s.arcId) && s.chars.every(c => d.characters.some(x => x.id === c)) && s.sceneries.every(l => d.sceneries.some(x => x.id === l))), 'sem ligações partidas');
    state = d; commit(); settle(); layoutInvariants(); ok(state.sceneries.some(locSuggest), 'o exemplo mostra uma sugestão de Localização Principal'); eq(frontiers().length, 2, 'com escrita e revisão em curso');
    for (const k of ['basic', 'deep']){ startTour(k); for (let i = 0; i < Tour.steps.length; i++){ Tour.i = i; showTourStep(); const st = Tour.steps[i]; if (st.sel && !/tip|ghost|ctx-menu|createFab|narrList|dualBtn/.test(st.sel)) ok(document.querySelector(st.sel), k + ': o passo «' + st.title + '» não encontra ' + st.sel); } endTour(); }
    const tt = TOUR_STEPS.map(s => s.title); for (const t of ['Estado de cada Cena', 'Filtros e vistas', 'Pesquisa e atalhos', 'Separador Tomos e Capítulos']) ok(tt.includes(t), 'falta na visita: ' + t);
    const dt = TOUR_DEEP.map(s => s.title); for (const t of ['Ficha ao lado e em duas colunas', 'Localizações principais e secundárias', 'Importar de outro projeto']) ok(dt.includes(t), 'falta na visita detalhada: ' + t); });
  await T('T03 visita: «Explorar o projeto» abre o livro de demonstração como projeto verdadeiro e deixa a visita em pausa', async () => { const f = fx(); flushSave(); const mine = projActive(), n0 = Projects.idx.open.length; Tour.exploreId = null;
    startTour(); Tour.i = 6; showTourStep(); const total = Tour.steps.length; const ex = $('#tourPop .tour-explore'); ok(ex, 'botão em cada passo'); ex.click(); await W(40);
    ok(!Tour.active && !tourMode, 'a visita sai da frente'); eq(Projects.idx.open.length, n0 + 1); ok(projActive() !== mine && Object.keys(state.scenes).length === 42, 'o livro de demonstração é agora um projeto aberto'); ok(LS_KEY && $('#tourPop').hidden);
    const pill = $('#tourResume'); ok(pill && pill.textContent.includes('passo 7 de ' + total), 'a visita fica à espera: ' + pill.textContent); ok([...pill.querySelectorAll('button')].every(b => tipFor(b)));
    const s1 = sceneEl('s1'); s1.querySelector('.scene-st').click(); await W(20); ok(!isDone(state.scenes.s1, 'write'), 'o estado da Cena muda'); const b0 = state.books.length; addBook(); eq(state.books.length, b0 + 1, 'pode mexer-se em tudo'); const exId = projActive();
    btn('Continuar a visita', pill).click(); await W(40); ok(Tour.active && Tour.i === 6, 'retoma no mesmo passo'); ok(!$('#tourResume')); endTour(); await W(20); eq(projActive(), mine, 'no fim, volta ao seu projeto'); eq(state.scenes[f.a1.id].title, 'a1');
    ok(Projects.idx.open.includes(exId), 'o exemplo continua aberto'); startTour(); $('#tourPop .tour-explore').click(); await W(40); eq(projActive(), exId, 'explorar outra vez volta ao mesmo exemplo, sem criar outro'); eq(Projects.idx.open.length, n0 + 1); eq(state.books.length, b0 + 1);
    btn('Terminar visita', $('#tourResume')).click(); ok(!$('#tourResume') && !Tour.active); Tour.exploreId = null; });
  await T('T04 contraste dos elementos novos, tal como aparecem, em paletas claras e escuras', async () => { fx(); setTab('board');
    const cv = document.createElement('canvas'); cv.width = cv.height = 1; const g = cv.getContext('2d', {willReadFrequently:true});
    const paint = (base, css) => { g.fillStyle = 'rgb(' + base.map(x => Math.round(x * 255)).join(',') + ')'; g.fillRect(0, 0, 1, 1); g.fillStyle = '#000'; g.fillStyle = css; g.fillRect(0, 0, 1, 1); const d = g.getImageData(0, 0, 1, 1).data; return [d[0] / 255, d[1] / 255, d[2] / 255]; };
    const bgOf = el => { const chain = []; for (let x = el; x; x = x.parentElement) chain.unshift(x); let c = paint([1, 1, 1], getComputedStyle(document.body).backgroundColor);
      for (const x of chain){ const b = getComputedStyle(x).backgroundColor; if (b && b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent') c = paint(c, b); } return c; };
    const box = h('div', {id:'qaContrast', style:{position:'fixed', left:'0', top:'0', width:'900px', zIndex:'9999', background:'var(--bg)'}}); document.body.append(box);
    const card = (...k) => h('div', {class:'card static'}, ...k), modal = (...k) => h('div', {class:'modal still'}, ...k);
    const S = [
      ['«a seguir»: título', () => h('button', {class:'next-card'}, h('span', {class:'kicker'}, 'K'), h('b', null, 'Título'), h('span', {class:'muted small'}, 'sub')), '.next-card b'],
      ['«a seguir»: etiqueta', null, '.next-card .kicker'], ['«a seguir»: lugar', null, '.next-card .muted'],
      ['«a seguir» em atraso', () => h('button', {class:'next-card late'}, h('span', {class:'kicker'}, 'K'), h('b', null, 'T')), '.next-card.late .kicker'],
      ['etiqueta de filtro', () => h('span', {class:'chip f-chip'}, 'Personagem: Ana'), '.f-chip'],
      ['sugestão de Localização', () => h('div', {class:'loc-sug'}, h('span', {class:'loc-sug-t'}, 'Texto')), '.loc-sug-t'],
      ['prazo em atraso', () => card(h('button', {class:'due-chip late'}, '12 mar')), '.due-chip.late'],
      ['prazo', () => card(h('button', {class:'due-chip'}, '12 mar')), '.due-chip:not(.late)'],
      ['«+ prazo»', () => card(h('button', {class:'due-add', style:{opacity:'1'}}, '+ prazo')), '.due-add'],
      ['etiqueta «Sugestão»', () => card(h('span', {class:'badge sug'}, 'Sugestão')), '.badge.sug'],
      ['etiqueta principal', () => card(h('span', {class:'badge main'}, 'Principal')), '.badge.main'],
      ['vista escolhida', () => h('div', {class:'view-seg'}, h('button', {'aria-pressed':'true'}, 'Quadro'), h('button', {'aria-pressed':'false', class:'vs-off'}, 'Lista')), '.view-seg [aria-pressed="true"]'],
      ['vista por escolher', null, '.view-seg .vs-off'],
      ['estado escolhido', () => modal(h('div', {class:'steps3'}, h('button', {'aria-pressed':'true'}, 'Escrita'), h('button', {'aria-pressed':'false', class:'s3-off'}, 'Revista'))), '.steps3 [aria-pressed="true"]'],
      ['estado por escolher', null, '.steps3 .s3-off'],
      ['botão Filtrar ativo', () => h('button', {class:'bar-btn on'}, 'Filtrar'), '.bar-btn.on'],
      ['botão Filtrar', () => h('button', {class:'bar-btn'}, 'Filtrar'), '.bar-btn:not(.on)'],
      ['pesquisa no topo', () => h('button', {class:'search-pill', style:{background:'var(--surface2)'}}, h('span', {class:'sp-l'}, 'Pesquisar')), '.search-pill .sp-l'],
      ['resultado escolhido', () => modal(h('button', {class:'find-item active'}, h('span', {class:'find-l'}, 'Cena'), h('span', {class:'find-s muted small'}, 'sub'))), '.find-item.active .find-l'],
      ['resultado: pormenor', null, '.find-item.active .find-s'],
      ['dica', () => h('div', {class:'coach'}, h('span', {class:'coach-t'}, 'Dica')), '.coach-t'],
      ['legenda da fita', () => modal(h('div', {class:'scn-fita'}, h('div', {class:'ft-trk narr'}, h('div', {class:'ft-cap'}, 'Ordem Narrativa')))), '.ft-cap'],
      ['nome original', () => modal(h('h2', null, 'Nome ', h('span', {class:'sup-orig'}, '(Original)'))), '.sup-orig'],
      ['número do Capítulo', () => card(h('span', {class:'el-lead'}, '3')), '.el-lead'],
      ['hoje na Agenda', () => card(h('div', {class:'ag-day today'}, h('div', {class:'ag-date'}, h('b', null, '24'), h('span', null, 'seg')))), '.ag-day.today b'],
      ['dia na Agenda', null, '.ag-day.today .ag-date span'],
      ['hoje no calendário', () => h('div', {class:'cal-day today'}, h('div', {class:'cal-top'}, h('span', {class:'cal-num'}, '24'))), '.cal-day.today .cal-num'],
      ['visita em pausa', () => h('div', {class:'tr-qa', style:{background:'var(--surface2)'}}, h('span', {class:'tr-t'}, 'Visita em pausa')), '.tr-qa .tr-t'],
      ['já existe (importar)', () => modal(h('label', {class:'imp-item dup'}, h('span', {class:'imp-name'}, 'Ana'))), '.imp-item.dup .imp-name'],
      ['Arco recolhido', () => h('div', {id:'gutter', style:{position:'relative', width:'200px'}}, h('div', {class:'lane-label off', style:{position:'relative', height:'30px'}}, h('span', {class:'lane-name'}, 'Arco'))), '.lane-label.off .lane-name'],
      ['marca de atraso', () => h('span', {class:'late-mark'}, h('span', {class:'qa-t'}, '!')), '.late-mark .qa-t'],
      ['barra Anular', () => h('div', {class:'toast snack', style:{position:'static'}}, h('span', {class:'snack-t'}, 'Feito'), h('button', {class:'snack-undo'}, 'Anular')), '.snack-undo']];
    let last = null; for (const s of S){ if (s[1]){ last = s[1](); box.append(last); } }
    const bad = [], seen = new Set(); let n = 0;
    for (const mode of ['dark', 'light']) for (let hue = 0; hue < 360; hue += 45){ lsSet(LS_THEME, mode); state.project.palette = {h:hue, mode}; applyPalette(); await W(0);
      for (const [name, , sel] of S){ const el = box.querySelector(sel); if (!el){ bad.push('em falta: ' + name); continue; } n++;
        const fg = paint(bgOf(el), getComputedStyle(el).color), x = contrast(fg, bgOf(el)), min = 4.5;
        if (x < min && !seen.has(name)){ seen.add(name); bad.push(name + ' (' + mode + ' ' + hue + '°): ' + x.toFixed(2)); } } }
    box.remove(); lsSet(LS_THEME, 'dark'); state.project.palette = {h:220, mode:'dark'}; applyPalette(); ok(n > 500, 'medições: ' + n); eq(bad, []); });
  await T('T05 guardas: segundo ecrã, visita e escrita — o painel, os atalhos e as dicas não aparecem onde não devem', async () => { const f = fx();
    Dual.role = 'second'; try { ok(!dockable(), 'no segundo ecrã não há ficha ao lado'); key('/'); key('?'); key('n'); eq(modals().length, 0, 'no segundo ecrã, as teclas não abrem nada'); } finally { Dual.role = 'main'; }
    startTour(); key('/'); key('F1'); key('3'); ok(!document.querySelector('.find-modal') && activeTab === 'board', 'durante a visita, os atalhos estão desligados'); ok(!$('#boardBar').hidden, 'a barra do quadro mostra-se, para ser explicada'); ok(!dockable()); endTour();
    openSceneFicha(f.a1.id); const ti = topModal().querySelector('.title-inp'); key('2', {}, ti); key('/', {}, ti); eq(activeTab, 'board'); ok(!document.querySelector('.find-modal'), 'a escrever num campo, as teclas são texto'); key('F1', {}, ti); ok(document.querySelector('.find-modal'), 'F1 funciona mesmo a escrever'); closeAllModals();
    setTipsOn(false); Coach.seen = {}; Coach.last = 0; coachCheck(); ok(!document.querySelector('.coach'), 'quem desligou os explicadores não recebe dicas'); setTipsOn(true); Coach.last = Infinity;
    for (let i = 0; i < 3; i++) snack('x' + i); eq(document.querySelectorAll('.toast.snack').length, 1, 'uma barra de cada vez'); histInit(); snack('sem histórico'); ok(!snackEl().querySelector('.snack-undo'), 'sem nada para anular, não oferece Anular'); });
  await T('T06 ida e volta em ficheiro e normalização: Localizações principais, estado, prazos e fases não se perdem; nada a mais é guardado', async () => { const f = fx();
    const l1 = newScenery('Casa'), l2 = newScenery('Café'); setLocMain(l1, true); l2.noMain = true; f.a1.sceneries.push(l1.id); setStage(f.a1.id, 'write', true); setSceneDue(f.a2.id, 'review', '2031-01-02'); setPhase('write', 'start', '2031-01-01'); commit();
    let blob = null; const oc = URL.createObjectURL, ac = HTMLAnchorElement.prototype.click; URL.createObjectURL = b => { blob = b; return 'blob:qa'; }; HTMLAnchorElement.prototype.click = function(){};
    try { await exportProject(); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ac; }
    const text = await blob.text(), d = sanitize(JSON.parse(text).data || JSON.parse(text)); const L = id => d.sceneries.find(x => x.id === id);
    eq([L(l1.id).main, L(l1.id).noMain, L(l2.id).main, L(l2.id).noMain], [true, undefined, undefined, true]); ok(isDone(d.scenes[f.a1.id], 'write'));
    eq(d.scenes[f.a2.id].prog.review.due, '2031-01-02'); eq(d.plan.write.start, '2031-01-01'); ok(!/"(hidden|f|zoom|dens|calMode|scnRole|planView)":/.test(text), 'filtros, vistas e ampliação não vão para o ficheiro');
    eq(JSON.stringify(sanitize(JSON.parse(JSON.stringify(state)))), JSON.stringify(state), 'normalizar o que se cria durante o uso não muda nada (condição da sincronização)');
    setLocMain(l2, true); eq([l2.main, l2.noMain], [true, undefined], 'marcar como principal limpa o «não sugerir»'); });
  await T('U01 quadro: premir e arrastar com o rato num espaço vazio desloca-o para o lado; um clique continua a ser um clique', async () => { fx(); state = sanitize(demoProject()); commit(); renderAll(); setTab('board'); await W(30);
    const sc = $('#board-scroll'); sc.scrollLeft = 0; sc.scrollTop = 0; ok(sc.scrollWidth > sc.clientWidth + 300, 'o quadro é mais largo do que a janela'); const n0 = Object.keys(state.scenes).length;
    const sr = sc.getBoundingClientRect(), at = (x, y) => document.elementFromPoint(x, y); let x0, y0, empty;
    for (let y = Math.min(sr.bottom, innerHeight) - 90; y > sr.top + 120 && !empty; y -= 23) for (let x = sr.left + B.GUT * Z() + 40; x < Math.min(sr.right, innerWidth) - 120; x += 37){ const e = at(x, y); if (e && $('#board').contains(e) && !e.closest('.scene, .ch-head, .book-head, button, input')){ x0 = x; y0 = y; empty = e; break; } }
    ok(empty, 'há espaço vazio no quadro');
    const P = (type, x, y, b, el) => (el || at(x, y) || document.body).dispatchEvent(new PointerEvent(type, {bubbles:true, cancelable:true, pointerType:'mouse', isPrimary:true, pointerId:1, button:type === 'pointermove' ? -1 : 0, buttons:b, clientX:x, clientY:y}));
    P('pointerdown', x0, y0, 1, empty); P('pointermove', x0 - 3, y0, 1); eq(sc.scrollLeft, 0, 'um tremor não desloca'); ok(!document.body.classList.contains('panning'));
    for (let i = 1; i <= 10; i++) P('pointermove', x0 - i * 30, y0, 1); eq(sc.scrollLeft, 300, 'o quadro segue o rato'); ok(document.body.classList.contains('panning'), 'com a mão fechada'); eq(getComputedStyle(sc).cursor, 'grabbing');
    P('pointerup', x0 - 300, y0, 0, window); empty.click(); await W(20); ok(!document.body.classList.contains('panning')); eq(Object.keys(state.scenes).length, n0, 'largar não cria uma Cena'); eq(modals().length, 0, 'nem abre nada');
    P('pointerdown', x0, y0, 1, empty); P('pointermove', x0 + 100, y0, 1); eq(sc.scrollLeft, 200, 'e para o outro lado'); P('pointermove', x0 + 100, y0, 0); ok(!document.body.classList.contains('panning'), 'botão largado fora da janela: acaba');
    P('pointermove', x0 + 200, y0, 0); eq(sc.scrollLeft, 200); P('pointerup', x0, y0, 0, window); await W(10);
    sc.scrollLeft = 0; await W(10); const s1 = sceneEl('s1'), b = s1.getBoundingClientRect();
    P('pointerdown', b.left + 20, b.top + 10, 1, s1); P('pointermove', b.left + 20, b.top + 10, 1); eq(sc.scrollLeft, 0, 'numa Cena, premir não desloca o quadro'); P('pointerup', b.left + 20, b.top + 10, 0, window); cancelDrags(); await W(10);
    P('pointerdown', x0, y0, 1, empty); P('pointerup', x0, y0, 0, window); ok(!document.body.classList.contains('panning'), 'clique sem arrastar: nada a deslocar'); eq(sc.scrollLeft, 0);
    tourMode = true; try { P('pointerdown', x0, y0, 1, empty); P('pointermove', x0 - 100, y0, 1); eq(sc.scrollLeft, 0, 'na visita, não'); P('pointerup', x0, y0, 0, window); } finally { tourMode = false; }
    ok(TOUR_STEPS.some(x => /prima e arraste um espaço vazio/.test(x.text)), 'a visita ensina o gesto'); fx(); });
  await T('U02 ficha da Cena: com o dedo, deslizar para o lado passa à Cena seguinte ou à anterior na Ordem Narrativa', async () => { fx(); state = demoProjectMini(); commit(); renderAll(); closeAllModals(); openSceneFicha('s2'); await W(20);
    const box = topModal(), back = box.closest('.modal-back'), title = () => box.querySelector('.ficha input').value;
    const P = (type, x, y, el, o) => el.dispatchEvent(new PointerEvent(type, Object.assign({bubbles:true, cancelable:true, pointerType:'touch', isPrimary:true, pointerId:5, clientX:x, clientY:y}, o || {})));
    const swipe = async (dx, dy, o) => { const el = box.querySelector((o && o.sel) || '.ficha textarea'); P('pointerdown', 300, 300, el, o); const n = 8; for (let i = 1; i <= n; i++){ P('pointermove', 300 + dx * i / n, 300 + (dy || 0) * i / n, el, o); await W(o && o.slow ? 60 : 8); } P('pointerup', 300 + dx, 300 + (dy || 0), el, o); await W(10); };
    eq(getComputedStyle(box).touchAction, 'pan-y pinch-zoom', 'o gesto para o lado é da ficha; para cima e para baixo continua a deslocar');
    await swipe(-200); eq(title(), 'Luz apagada', 'para a esquerda: a Cena seguinte do livro'); ok(back.querySelector('.slide-ghost'), 'com a mesma passagem deslizante'); eq(box.style.transform, '', 'a caixa não fica deslocada'); slideStop(back);
    await swipe(200); eq(title(), 'A casa da avó', 'para a direita: a anterior'); slideStop(back);
    await swipe(200); eq(title(), 'Inês desembarca na ilha'); slideStop(back);
    { const el = box.querySelector('.ficha textarea'); P('pointerdown', 300, 300, el); for (let i = 1; i <= 6; i++) P('pointermove', 300 + i * 40, 300, el); ok(Math.abs(parseFloat(box.style.transform.replace(/[^\d.-]/g, ''))) < 80, 'no início do livro, a caixa resiste: ' + box.style.transform); P('pointerup', 540, 300, el); await W(10); eq(title(), 'Inês desembarca na ilha', 'e volta ao sítio'); eq(box.style.transform, ''); }
    await swipe(-40, 0, {slow:true}); eq(title(), 'Inês desembarca na ilha', 'um gesto curto e lento não muda de Cena');
    await swipe(-60, 220); eq(title(), 'Inês desembarca na ilha', 'na vertical é deslocar a ficha, não mudar de Cena');
    await swipe(-200, 0, {pointerType:'mouse'}); eq(title(), 'Inês desembarca na ilha', 'com o rato, arrastar é selecionar texto');
    await swipe(-200, 0, {sel:'.scn-fita'}); eq(title(), 'Inês desembarca na ilha', 'a fita tem os seus próprios toques');
    await swipe(-200); slideStop(back); eq(title(), 'A casa da avó'); await swipe(-200); slideStop(back); eq(title(), 'Luz apagada', 'só pela Ordem Narrativa: numa bifurcação do Arco, segue o livro');
    { const el = box.querySelector('.ficha textarea'); P('pointerdown', 300, 300, el); for (let i = 1; i <= 6; i++) P('pointermove', 300 - i * 40, 300, el); P('pointerup', 60, 300, el); let clicked = 0; const nb = box.querySelector('.ficha .steps3 button'); nb.addEventListener('click', () => clicked++); nb.click(); eq(clicked, 0, 'o fim do gesto não conta como toque num botão'); slideStop(back); await W(420); nb.click(); eq(clicked, 1, 'logo a seguir, os toques voltam a contar'); }
    Tour.active = true; try { const t0 = title(); await swipe(-200); eq(title(), t0, 'na visita, não'); } finally { Tour.active = false; }
    ok(TOUR_STEPS.some(x => /deslize o dedo para o lado/.test(x.text)), 'a visita ensina o gesto'); closeAllModals(); fx(); });
  await T('U03 página inicial: o botão das cores muda a paleta, que passa a ser a dos projetos novos; também nas boas-vindas', async () => {
    const th0 = lsGet(LS_THEME), pal0 = lsGet(LS_PAL), back = (k, v) => v == null ? localStorage.removeItem(k) : lsSet(k, v);
    try {
      closeProject(); await W(20); if (modals().length){ await W(20); const b = btn('Fechar sem guardar', topModal()); b && b.click(); await W(40); } ok(projNone(), 'página inicial');
      const b = $('#palBtn'); ok(getComputedStyle(b).display !== 'none', 'à vista ao lado da língua'); ok(tipFor(b), 'com explicador'); eq(b.getAttribute('aria-label'), 'Cores');
      b.click(); await W(10); const menu = $('.pal-menu'); ok(menu, 'abre a lista das paletas'); eq(menu.querySelectorAll('.pal-item .pal-mini').length, PRESET_PALETTES.length, 'cada uma com a sua amostra');
      [...menu.querySelectorAll('.ctx-item')].find(i => i.textContent.includes('Pergaminho')).click(); await W(10);
      eq([state.project.palette.h, lsGet(LS_THEME), document.documentElement.dataset.mode, lsGet(LS_PAL)], [40, 'light', 'light', '40']); eq(LS_KEY, null, 'nada é gravado sem projeto');
      eq(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(), paletteVars({h:40, mode:'light'})['--bg'], 'a página inicial muda de cores');
      b.click(); await W(10); ok($('.pal-menu .pal-item.on') && $('.pal-menu .pal-item.on').textContent.includes('Pergaminho'), 'a escolhida fica assinalada');
      const auto = [...$('.pal-menu').querySelectorAll('.ctx-item')].find(i => i.textContent.includes('seguir o sistema')); ok(auto, 'e há como voltar ao tema do sistema'); auto.click(); await W(10); eq(themePref(), 'auto');
      $('#landing .land-card').click(); await W(30); ok(!projNone()); eq(state.project.palette.h, 40, 'o projeto novo fica com as cores escolhidas'); eq(getComputedStyle(b).display, 'none', 'com um projeto aberto, as cores mudam-se nas Definições');
      lsSet(LS_THEME, 'dark'); localStorage.removeItem(LS_PRIV); welcomeIfNeeded(); await W(30); const picks = [...topModal().querySelectorAll('.pal-pick')]; eq(picks.length, PRESET_PALETTES.length, 'as paletas também nas boas-vindas');
      const fl = picks.find(p => p.title === 'Floresta'); fl.click(); await W(10); eq([state.project.palette.h, lsGet(LS_PAL)], [150, '150']); ok(fl.classList.contains('on')); eq(picks.filter(p => p.getAttribute('aria-checked') === 'true'), [fl], 'só uma assinalada');
      btn('Começar').click(); await W(20); eq(modals().length, 0);
      ok(TOUR_DEEP.some(x => /botão das cores/.test(x.text)), 'a visita detalhada fala do botão');
    } finally { back(LS_THEME, th0); back(LS_PAL, pal0); lsSet(LS_PRIV, '1'); state.project.palette = {h:220, mode:'dark'}; applyPalette(); closeAllModals(); fx(); } });
  /* ----- 1.0.7: eliminar pede sempre confirmação; carrossel entre Cenas; paletas na página inicial (casos-limite) ----- */
  /* a pergunta tem de existir mesmo — sem o atalho de «answer», que aceita a barra «Anular» no lugar dela */
  const delAsk = async (fire, alive, what, o) => { o = o || {}; fire(); await W(30); const m = topModal(), okB = m && m.querySelector('.modal-foot .btn.primary');
    ok(m && btn('Cancelar', m) && okB && okB.textContent === 'Eliminar', what + ': não perguntou'); if (!m || !okB) return;
    if (o.txt) ok(m.textContent.includes(o.txt), what + ': o texto devia dizer «' + o.txt + '»: ' + m.textContent);
    btn('Cancelar', m).click(); await W(30); ok(alive(), what + ': Cancelar eliminou');
    fire(); await W(30); ok(topModal() && btn('Cancelar', topModal()), what + ': pergunta outra vez'); key('Escape'); await W(30); ok(alive(), what + ': Esc eliminou'); ok(!(topModal() && btn('Cancelar', topModal())), what + ': Esc fecha a pergunta');
    if (o.keep) return; fire(); await W(30); topModal().querySelector('.modal-foot .btn.primary').click(); await W(40); ok(!alive(), what + ': confirmado, não eliminou'); };
  await T('AA01 eliminar: todas as fichas pedem confirmação, e Cancelar ou Esc deixam tudo como estava (e a ficha aberta)', async () => { const f = fx();
    const ficha = async (open, label, alive, what, txt) => { closeAllModals(); open(); await W(30); const box = topModal();
      await delAsk(() => btn(label, box).click(), alive, what, {txt, keep:true}); ok(modals().length === 1 && topModal() === box, what + ': a ficha continua aberta');
      btn(label, box).click(); await W(30); topModal().querySelector('.modal-foot .btn.primary').click(); await W(40); ok(!alive(), what + ': confirmado, eliminou'); ok(!modals().includes(box), what + ': e a ficha fecha'); };
    await ficha(() => openSceneFicha(f.a2.id), 'Eliminar Cena', () => !!state.scenes[f.a2.id], 'Cena', 'Eliminar a Cena «a2»?');
    const c = newCharacter('Rui'); commit(); await ficha(() => openCharFicha(c.id), 'Eliminar Personagem', () => !!charById(c.id), 'Personagem', '«Rui»');
    const sc = newScenery('Farol'); commit(); await ficha(() => openSceneryFicha(sc.id), 'Eliminar Localização', () => state.sceneries.some(x => x.id === sc.id), 'Localização', '«Farol»');
    const ar = newArc('Vazio'); commit(); await ficha(() => openArcFicha(ar.id), 'Eliminar Arco Narrativo', () => !!arcById(ar.id), 'Arco Narrativo', 'Eliminar o Arco Narrativo «Vazio»?');
    const n = newNote(); n.title = 'Ideia'; commit(); await ficha(() => openRefFicha(n.id), 'Eliminar', () => state.refs.some(r => r.id === n.id), 'Nota', 'Eliminar a Nota «Ideia»?');
    const lk = {id:uid('r'), type:'link', title:'Mapa', url:'https://example.org', text:'', links:[], created:Date.now()}; state.refs.push(lk); commit();
    await ficha(() => openRefFicha(lk.id), 'Eliminar', () => state.refs.some(r => r.id === lk.id), 'Referência', 'Eliminar a Referência «Mapa»?');
    const g = newGoal(); g.title = 'Visitar o cais'; commit(); await ficha(() => openGoalFicha(g.id), 'Eliminar objetivo', () => state.goals.some(x => x.id === g.id), 'objetivo', 'Eliminar o objetivo «Visitar o cais»?');
    await ficha(() => openBookFicha(f.B2.id), 'Eliminar Tomo', () => !!bookById(f.B2.id), 'Tomo', '«Tomo 2»');
    closeAllModals(); fx(); });
  await T('AA02 eliminar: os menus do quadro e da Lista também perguntam — Cena, Capítulo (mesmo vazio) e Tomo', async () => { const f = fx(); closeAllModals(); setTab('board'); renderAll(); await W(30); lastPtr = 'mouse'; ok(sceneEl(f.a1.id) && chHead(f.c2.id) && bkHead(f.B2.id), 'o quadro está à vista: ' + JSON.stringify({tab:activeTab, list:!!document.querySelector('.nl-frontier, .nlist')}));
    const ctx = (el, w) => { ok(el, 'sem elemento no quadro: ' + w); if (!el) return; const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('contextmenu', {bubbles:true, cancelable:true, clientX:r.left + 12, clientY:r.top + 10, button:2})); };
    const item = label => { const it = [...document.querySelectorAll('.ctx-item')].find(x => x.textContent === label); ok(it, 'sem «' + label + '» no menu: ' + menuLabels()); suppressUntil = 0; it && it.click(); };
    await delAsk(() => { ctx(sceneEl(f.a1.id), 'a1'); item('Eliminar Cena'); }, () => !!state.scenes[f.a1.id], 'Cena (quadro)', {txt:'Eliminar a Cena «a1»?'});
    ok(snackEl() && snackEl().querySelector('.snack-undo'), 'depois de eliminar, a barra oferece Anular'); snackEl().querySelector('.snack-undo').click(); await W(30); ok(state.scenes[f.a1.id], 'Anular repõe a Cena'); renderAll(); await W(20);
    await delAsk(() => { ctx(chHead(f.c2.id), 'c2'); item('Eliminar Capítulo'); }, () => !!findChapter(f.c2.id), 'Capítulo (quadro)', {txt:'e a sua Cena?'});
    const c0 = {id:uid('c'), name:'Oco', scenes:[]}; bookById(f.B1.id).chapters.push(c0); commit(); renderAll(); await W(20); // depois de Anular, o estado é outro objeto
    await delAsk(() => { ctx(chHead(c0.id), 'c0'); item('Eliminar Capítulo'); }, () => !!findChapter(c0.id), 'Capítulo vazio (quadro)', {txt:'Eliminar o Capítulo «Oco»?'});
    await delAsk(() => { ctx(bkHead(f.B2.id), 'B2'); item('Eliminar Tomo'); }, () => !!bookById(f.B2.id), 'Tomo (quadro)', {txt:'«Tomo 2»', keep:true});
    await delAsk(() => { sceneListMenu(f.a2.id, 200, 200); item('Eliminar Cena'); }, () => !!state.scenes[f.a2.id], 'Cena (Lista)', {keep:true});
    const fake = h('button'); document.body.append(fake);
    await delAsk(() => { chapterListMenu(f.c1.id, fake); item('Eliminar Capítulo'); }, () => !!findChapter(f.c1.id), 'Capítulo (Lista)', {keep:true});
    await delAsk(() => { bookListMenu(f.B1.id, fake); item('Eliminar Tomo'); }, () => !!bookById(f.B1.id), 'Tomo (Lista)', {keep:true}); fake.remove();
    // em inglês, a pergunta também vem traduzida (e com os mesmos marcadores)
    const box = {}; new Function('I18N', await (await fetch('js/lang-en.js')).text())(box); eq(box.en['Eliminar a Cena «{nome}»?'], 'Delete the Scene “{nome}”?');
    closeAllModals(); fx(); });
  await T('AA03 carrossel entre Cenas: para trás, na ficha ao lado do quadro e com o dedo — as duas andam juntas e a que sai acaba fora da vista quando a outra chega', async () => {
    state = demoProjectMini(); commit(); renderAll(); closeAllModals();
    const probe = async (dir, what) => { const box = topModal(), back = box.closest('.modal-back'), s = back._slide; ok(s, what + ': sem passagem deslizante'); if (!s) return;
      const end = s.anims[1].effect.getComputedTiming().duration, br = back.getBoundingClientRect(), vl = Math.max(br.left, 0), vr = Math.min(br.right, innerWidth), gaps = [];
      for (const t of [0, .25, .5, .75]){ s.anims.forEach(a => { a.pause(); a.currentTime = end * t; }); gaps.push(box.getBoundingClientRect().left - s.g.getBoundingClientRect().left); }
      ok(Math.max(...gaps) - Math.min(...gaps) < 1.5, what + ': a distância entre as duas não muda: ' + JSON.stringify(gaps.map(Math.round)));
      ok(dir === 'next' ? gaps[0] > 0 : gaps[0] < 0, what + ': a nova vem do lado certo');
      s.anims.forEach(a => a.currentTime = end - 1); const gr = s.g.getBoundingClientRect();
      ok(dir === 'next' ? gr.right <= vl + 2 : gr.left >= vr - 2, what + ': no fim, a que sai está fora da área visível: ' + JSON.stringify([gr.left, gr.right, vl, vr]));
      s.anims.forEach(a => a.currentTime = end * .5); const gm = s.g.getBoundingClientRect(); ok(gm.right > vl + 2 && gm.left < vr - 2, what + ': a meio, ainda se vê');
      s.anims.forEach(a => a.finish()); await W(20); ok(!back.querySelector('.slide-ghost'), what + ': a cópia sai no fim'); };
    openSceneFicha('s3'); await W(30); topModal().querySelector('[data-nav="narr-prev"]').click(); await W(10); await probe('prev', 'para trás');
    topModal().querySelector('[data-nav="narr-next"]').click(); await W(10); await probe('next', 'para a frente');
    // com o dedo: a nova continua de onde o dedo largou a anterior, sem salto
    { const box = topModal(), el = box.querySelector('.ficha textarea'), P = (type, x) => el.dispatchEvent(new PointerEvent(type, {bubbles:true, cancelable:true, pointerType:'touch', isPrimary:true, pointerId:7, clientX:x, clientY:300}));
      P('pointerdown', 400); for (let i = 1; i <= 8; i++){ P('pointermove', 400 - i * 25); await W(8); } await W(30); const x0 = box.getBoundingClientRect().left; ok(x0 < box.closest('.modal-back').getBoundingClientRect().left + 200, 'a caixa segue o dedo'); P('pointerup', 200); await W(5);
      const s = box.closest('.modal-back')._slide; ok(s, 'o gesto passou de Cena'); if (s){ s.anims.forEach(a => { a.pause(); a.currentTime = 0; }); ok(Math.abs(s.g.getBoundingClientRect().left - x0) < 3, 'a que sai parte de onde o dedo a deixou, sem salto: ' + [s.g.getBoundingClientRect().left, x0]); }
      await probe('next', 'com o dedo'); }
    ok(innerWidth < 1100 || dockable(), 'numa janela larga, a ficha pode ir para o lado: ' + innerWidth);
    if (dockable()){ closeAllModals(); setDockPref(true); try { openSceneFicha('s2'); await W(40); ok($('.modal-back.docked'), 'ficha ao lado');
        topModal().querySelector('[data-nav="narr-next"]').click(); await W(10); await probe('next', 'ao lado do quadro');
        topModal().querySelector('[data-nav="narr-prev"]').click(); await W(10); await probe('prev', 'ao lado do quadro, para trás'); } finally { closeAllModals(); setDockPref(false); } }
    // movimento reduzido: troca logo, sem cópia
    document.body.classList.add('reduce-motion'); try { openSceneFicha('s2'); await W(20); topModal().querySelector('[data-nav="narr-next"]').click(); await W(10); ok(!document.querySelector('.slide-ghost'), 'com animações reduzidas, não desliza'); } finally { document.body.classList.remove('reduce-motion'); applyA11y(); }
    closeAllModals(); fx(); });
  await T('AA04 paletas: teclado no menu das cores, modelos e exemplo com a paleta escolhida, e as Definições lembram-na para a página inicial', async () => {
    const th0 = lsGet(LS_THEME), pal0 = lsGet(LS_PAL), back = (k, v) => v == null ? localStorage.removeItem(k) : lsSet(k, v);
    try {
      lsSet(LS_THEME, 'dark'); lsSet(LS_PAL, '345'); closeProject(); await W(20); if (modals().length){ const b = btn('Fechar sem guardar', topModal()); b && b.click(); await W(40); }
      ok(projNone()); eq(state.project.palette.h, 345, 'a página inicial abre com a paleta lembrada'); eq(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(), paletteVars({h:345, mode:'dark'})['--bg']);
      const pb = $('#palBtn'); pb.focus(); pb.click(); await W(10); const its = [...document.querySelectorAll('.pal-menu .ctx-item')];
      eq(document.activeElement, its[0], 'o foco vai para a primeira paleta'); eq(pb.getAttribute('aria-expanded'), 'true');
      ok($('.pal-menu .pal-item.on') && $('.pal-menu .pal-item.on').textContent.includes('Vinho'), 'a lembrada vem assinalada');
      key('ArrowDown', {}, document.querySelector('.pal-menu')); eq(document.activeElement, its[1], 'setas percorrem as paletas');
      key('Escape', {}, document.querySelector('.pal-menu')); await W(10); ok(!$('.pal-menu'), 'Esc fecha'); eq(pb.getAttribute('aria-expanded'), 'false'); eq(document.activeElement, pb, 'e o foco volta ao botão');
      pb.click(); await W(10); [...document.querySelectorAll('.pal-menu .ctx-item')].find(i => i.textContent.includes('Âmbar')).click(); await W(10); eq(lsGet(LS_PAL), '35');
      templateDialog(); await W(20); topModal().querySelector('.tpl-item').click(); await W(40); ok(!projNone()); eq(state.project.palette.h, 35, 'um modelo fica com a paleta escolhida');
      setTab('settings'); await W(20); [...document.querySelectorAll('.pal')].find(p => p.textContent.includes('Menta')).click(); await W(10); eq(lsGet(LS_PAL), '165', 'escolher nas Definições também fica para a página inicial');
      closeProject(); await W(20); if (modals().length){ const b = btn('Fechar sem guardar', topModal()); b && b.click(); await W(40); } ok(projNone()); eq(state.project.palette.h, 165, 'e a página inicial passa a abrir com ela');
      startExample(); await W(40); eq(state.project.palette.h, 165, 'o exemplo também');
      ok(getComputedStyle($('#palBtn')).display === 'none' && getComputedStyle($('#langBtn')).display === 'none', 'com projeto aberto, os dois botões saem da barra');
    } finally { back(LS_THEME, th0); back(LS_PAL, pal0); state.project.palette = {h:220, mode:'dark'}; applyPalette(); closeAllModals(); setTab('board'); fx(); } });
  await T('AA05 página inicial no telemóvel: cores, língua e ajuda cabem na barra, com toque de tamanho certo; o menu das cores cabe no ecrã', async () => {
    await phone(360, 740, async (w, d) => { w.eval('Projects.idx.active = null; projActivate(null)'); await W(80);
      ok(d.body.classList.contains('no-project'), 'página inicial'); const bs = ['#palBtn', '#langBtn', '#tourBtn'].map(s => d.querySelector(s)), rs = bs.map(b => b.getBoundingClientRect());
      rs.forEach((r, i) => ok(r.width >= 32 && r.height >= 32 && r.right <= 360 && r.left >= 0, 'à vista e com tamanho para o dedo: ' + bs[i].id + ' ' + JSON.stringify([r.left, r.right, r.width])));
      ok(rs[0].right <= rs[1].left + 1 && rs[1].right <= rs[2].left + 1, 'sem se sobreporem'); const tb = d.querySelector('#topbar'); ok(tb.scrollWidth <= tb.clientWidth + 1, 'a barra não transborda');
      bs[0].click(); await W(30); const m = d.querySelector('.pal-menu'); ok(m, 'o menu abre'); const mr = m.getBoundingClientRect(); ok(mr.left >= 0 && mr.right <= 360 && mr.bottom <= 740, 'e cabe no ecrã: ' + JSON.stringify([mr.left, mr.right, mr.bottom]));
      w.closeMenu(); }); });
  /* ----- telemóvel: dois dedos no quadro, cabeçalho do Tomo condensado ao deitado, Tomo e Capítulo presos à esquerda, claro/escuro do aparelho ----- */
  const keepLS = async (keys, fn) => { const old = keys.map(k => lsGet(k)); try { await fn(); } finally { keys.forEach((k, i) => old[i] == null ? localStorage.removeItem(k) : lsSet(k, old[i])); } };
  const bigBook = () => { state = sanitize(demoProject()); commit(); flushSave(); };
  await T('AB01 telemóvel: dois dedos a aproximar reduzem o quadro e a afastar ampliam; o ponto entre os dedos fica no sítio; fica lembrado; no PC, nada muda', async () => {
    await keepLS([LS_MZOOM], async () => { localStorage.removeItem(LS_MZOOM); bigBook();
      await phone(740, 360, async (w, d) => { const E = x => w.eval(x), sc = d.querySelector('#board-scroll');
        eq(E('navMode()'), 'compact'); eq(E('narrView()'), 'board', 'deitado, o quadro'); eq(E('Z()'), 1); eq(w.getComputedStyle(sc).touchAction, 'pan-x pan-y', 'o navegador não amplia a página por cima do quadro');
        sc.scrollLeft = 900; await W(30); const r = sc.getBoundingClientRect(), cx = r.left + 320, cy = r.top + 140;
        const T = (id, x, y) => new w.Touch({identifier:id, target:sc, clientX:x, clientY:y}), ev = (type, ts) => { const e = new w.TouchEvent(type, {touches:ts, targetTouches:ts, changedTouches:ts, bubbles:true, cancelable:true}); sc.dispatchEvent(e); return e.defaultPrevented; };
        const touch = typeof w.Touch === 'function' && typeof w.TouchEvent === 'function'; // o Firefox de PC pode não ter eventos de toque: aí, a ampliação chama-se diretamente
        const at = () => (sc.scrollLeft + 320) / E('Z()'), pinch = async (d0, d1) => { if (!touch){ E('zoomAt(Z() * ' + d1 / d0 + ', ' + cx + ', ' + cy + '); lsSet(LS_MZOOM, String(ViewPref.mzoom)); Pinch.until = performance.now() + 350'); await W(20); return; } ok(ev('touchstart', [T(1, cx - d0 / 2, cy), T(2, cx + d0 / 2, cy)]), 'o gesto é do quadro');
          for (let i = 1; i <= 8; i++){ const dd = d0 + (d1 - d0) * i / 8; ev('touchmove', [T(1, cx - dd / 2, cy), T(2, cx + dd / 2, cy)]); await W(20); } await W(30); ev('touchend', []); await W(20); };
        const X0 = at(); await pinch(200, 100); ok(Math.abs(E('Z()') - .5) < .02, 'aproximar os dedos para metade: metade do tamanho, ' + E('Z()')); ok(Math.abs(at() - X0) < 6, 'o ponto entre os dedos fica no sítio: ' + [X0, at()]);
        eq(E('lsGet(LS_MZOOM)'), String(E('ViewPref.mzoom')), 'fica lembrado neste aparelho'); ok(d.querySelector('#board').style.zoom, 'o quadro está reduzido');
        await pinch(60, 600); eq(E('Z()'), 1.6, 'afastar muito: até 160 %, não mais'); await pinch(400, 10); eq(E('Z()'), .3, 'aproximar muito: até 30 %, não menos');
        // um toque logo a seguir ao gesto não abre a Cena por baixo do dedo
        const s = d.querySelector('.scene'); s.click(); await W(20); eq(E('openModals.length'), 0, 'o dedo que sai do gesto não abre fichas');
        await W(400); E("setTab('settings')"); await W(20); E("setTab('board')"); await W(30); eq(E('Z()'), .3, 'mudar de área e voltar mantém a ampliação');
        E('startTour()'); await W(60); eq(E('Z()'), 1, 'na visita, o quadro tem sempre o tamanho normal'); E('endTour()'); await W(30); });
      await phone(740, 360, async (w) => eq(w.eval('Z()'), .3, 'ao reabrir, a ampliação lembrada')); });
    // no PC, dois dedos (num ecrã tátil) não mudam a ampliação do quadro pelo telemóvel
    fx(); setTab('board'); await W(20); const z0 = Z(), sc = $('#board-scroll'), r = sc.getBoundingClientRect(); if (typeof Touch === 'function' && typeof TouchEvent === 'function'){
    const T = (id, x) => new Touch({identifier:id, target:sc, clientX:x, clientY:r.top + 100}); sc.dispatchEvent(new TouchEvent('touchstart', {touches:[T(1, r.left + 200), T(2, r.left + 400)], bubbles:true, cancelable:true}));
    sc.dispatchEvent(new TouchEvent('touchmove', {touches:[T(1, r.left + 280), T(2, r.left + 320)], bubbles:true, cancelable:true})); await W(40); sc.dispatchEvent(new TouchEvent('touchend', {touches:[], bubbles:true})); }
    eq(Z(), z0, 'no PC, a ampliação é a dos botões − e +'); eq(getComputedStyle(sc).touchAction === 'pan-x pan-y', false); fx(); });
  await T('AB02 telemóvel deitado: «TOMO n» e o nome do Tomo numa só linha, e o quadro ganha altura; ao alto e no PC, como antes', async () => { bigBook();
    const look = d => { const hd = d.querySelector('.book-head'), k = hd.querySelector('.book-kicker').getBoundingClientRect(), n = hd.querySelector('.book-name').getBoundingClientRect(), ch = d.querySelector('.ch-head').getBoundingClientRect();
      return {h:hd.getBoundingClientRect().height, line:Math.abs((k.top + k.bottom) / 2 - (n.top + n.bottom) / 2) < 4 && n.left > k.right, layer:d.querySelector('#headLayer').getBoundingClientRect().height, chTop:Math.round(ch.top - hd.getBoundingClientRect().top), cut:n.width < 40}; };
    await phone(740, 360, async (w, d) => { const o = look(d); eq([o.h, o.line, o.layer, o.chTop], [30, true, 64, 30], 'deitado, numa linha: ' + JSON.stringify(o)); ok(!o.cut, 'o nome tem espaço');
      const a = d.querySelector('.book-actions').getBoundingClientRect(), hd = d.querySelector('.book-head').getBoundingClientRect(); ok(a.top >= hd.top - 1 && a.bottom <= hd.bottom + 1, 'os botões ⓘ e + cabem na linha');
      eq(w.eval('HEAD_H'), 64); const s = d.querySelector('.scene').getBoundingClientRect(); ok(s.top - d.querySelector('#board-scroll').getBoundingClientRect().top < 64 + 40, 'as Cenas começam logo abaixo');
      const tight = w.eval("state.books.every(b => { const e = document.querySelector('.book-head[data-book=\"' + b.id + '\"] .book-name'); return e.scrollWidth <= e.clientWidth + 1; })"); ok(tight, 'nenhum nome de Tomo fica cortado'); });
    await phone(390, 800, async (w, d) => { w.eval("Narr.view = 'board'; renderAll()"); await W(60); const o = look(d); eq([o.h, o.line, o.layer], [54, false, 88], 'ao alto, em duas linhas: ' + JSON.stringify(o)); });
    setTab('board'); await W(20); const o = look(document); eq([o.h, o.line, o.layer], [54, false, 88], 'no PC, como antes'); ok(!document.body.classList.contains('head-slim')); fx(); });
  await T('AB03 telemóvel: o número e o nome do Tomo e do Capítulo acompanham a câmara, encostados à coluna dos Arcos, sem passar do fim deles', async () => { bigBook();
    const chk = async (w, d, what) => { const go = async v => { sc.scrollLeft = v; sc.dispatchEvent(new w.Event('scroll')); await W(60); }; /* a janela de teste pode não desenhar: o evento de deslocação é enviado à mão */ const sc = d.querySelector('#board-scroll'), gut = () => d.querySelector('#gutter').getBoundingClientRect().right;
      const heads = [...d.querySelectorAll('#headLayer .ch-head')], big = heads.reduce((a, b) => parseFloat(b.style.width) > parseFloat(a.style.width) ? b : a), x = parseFloat(big.style.left), wd = parseFloat(big.style.width), z = w.eval('Z()');
      await go((x + wd / 2) * z - (gut() - sc.getBoundingClientRect().left));
      const num = big.querySelector('.ch-num').getBoundingClientRect(); ok(Math.abs(num.left - gut()) < 24 * z + 4, what + ': o número do Capítulo fica encostado à coluna dos Arcos: ' + [num.left, gut()]); ok(big.classList.contains('stuck'), what + ': assinalado');
      const bk = [...d.querySelectorAll('#headLayer .book-head')].find(b => { const l = parseFloat(b.style.left); return l <= x && l + parseFloat(b.style.width) >= x + wd; }), kk = bk.querySelector('.book-kicker').getBoundingClientRect();
      ok(kk.left >= gut() - 2 && kk.left < gut() + 40 * z, what + ': e «TOMO n» também: ' + [kk.left, gut()]); ok(bk.querySelector('.book-name').getBoundingClientRect().width > 30 * z, what + ': com o nome à vista');
      await go((x + wd - 20) * z - (gut() - sc.getBoundingClientRect().left)); const n2 = big.querySelector('.ch-num').getBoundingClientRect(), hr = big.getBoundingClientRect();
      ok(n2.right < hr.right - 20 * z, what + ': no fim do Capítulo, o número não sai dele: ' + [n2.right, hr.right]);
      await go(0); eq(d.querySelectorAll('#headLayer .stuck').length, 0, what + ': no início, tudo no lugar de sempre'); };
    await phone(740, 360, async (w, d) => { await chk(w, d, 'deitado');
      const sc = d.querySelector('#board-scroll'), r = sc.getBoundingClientRect(), T = (id, x) => new w.Touch({identifier:id, target:sc, clientX:x, clientY:r.top + 140}), ev = (t, ts) => sc.dispatchEvent(new w.TouchEvent(t, {touches:ts, changedTouches:ts, bubbles:true, cancelable:true}));
      if (typeof w.TouchEvent === 'function' && typeof w.Touch === 'function'){ ev('touchstart', [T(1, r.left + 250), T(2, r.left + 450)]); for (let i = 1; i <= 6; i++){ ev('touchmove', [T(1, r.left + 250 + i * 12), T(2, r.left + 450 - i * 12)]); await W(20); } ev('touchend', []); }
      else w.eval('zoomAt(.64, ' + (r.left + 350) + ', ' + (r.top + 140) + ')'); await W(30); ok(w.eval('Z()') < .8, 'reduzido: ' + w.eval('Z()'));
      await chk(w, d, 'reduzido com dois dedos');
      w.eval("lsSet(LS_MZOOM, '1')"); });
    await phone(390, 800, async (w, d) => { w.eval("Narr.view = 'board'; renderAll()"); await W(60); await chk(w, d, 'ao alto'); });
    setTab('board'); await W(20); $('#board-scroll').scrollLeft = 1500; await W(60); eq(document.querySelectorAll('#headLayer .stuck').length, 0, 'no PC, os cabeçalhos ficam onde estão'); $('#board-scroll').scrollLeft = 0; fx(); });
  await T('AB04 telemóvel: claro ou escuro segue sempre o aparelho, mesmo que no PC se tenha escolhido outro; paletas sem repetidas e sem prender o modo', async () => {
    await keepLS([LS_THEME, LS_PAL], async () => { lsSet(LS_THEME, matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark'); fx(); flushSave();
      await phone(390, 800, async (w, d) => { const E = x => w.eval(x), os = w.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        eq(E('themePref()'), 'auto'); eq(d.documentElement.dataset.mode, os, 'segue o aparelho, não o que ficou escolhido no PC');
        E("setTab('settings')"); await W(40); ok(d.querySelector('.theme-auto') && !d.querySelector('.theme-seg'), 'nas Definições, diz que segue o aparelho, sem o seletor');
        const pals = [...d.querySelectorAll('.pal')].map(p => p.textContent); ok(pals.length >= 7, 'paletas: ' + pals); eq(new Set(E("palChoices(PRESET_PALETTES).map(p => p.h)")).size, E("palChoices(PRESET_PALETTES).length"), 'sem duas da mesma cor');
        eq(E("palChoices(PRESET_PALETTES).every(p => p.mode === effectiveMode())"), true, 'todas no modo do aparelho'); ok(pals.some(p => p.includes(os === 'dark' ? 'Meia-noite' : 'Papel')), 'a de 220° com o nome do modo certo');
        const before = E('lsGet(LS_THEME)'); [...d.querySelectorAll('.pal')].find(p => p.textContent.includes('Floresta')).click(); await W(20);
        eq([E('state.project.palette.h'), E('lsGet(LS_THEME)'), d.documentElement.dataset.mode], [150, before, os], 'escolher uma paleta muda a cor e não prende o claro ou o escuro');
        ok(d.querySelector('.pal.on') && d.querySelector('.pal.on').textContent.includes('Floresta'), 'fica assinalada');
        const mq = E("matchMedia('(prefers-color-scheme: dark)')"); ok(mq, 'o aparelho avisa quando muda de modo'); E("setTab('board')"); });
      eq(themePref(), lsGet(LS_THEME), 'no PC, o modo escolhido continua a valer'); });
    state.project.palette = {h:220, mode:'dark'}; applyPalette(); fx(); });
  await T('AC01 telemóvel: em «Elementos», Tomos e Capítulos em separadores próprios, com os mesmos filtros; no PC, juntos como antes', async () => { bigBook();
    const nCh = state.books.reduce((n, b) => n + b.chapters.length, 0), nB = state.books.length, arc = state.arcs[state.arcs.length - 1];
    await phone(390, 800, async (w, d) => { const E = x => w.eval(x), q = s => d.querySelector(s), qa = s => [...d.querySelectorAll(s)];
      E("ListUI.layout = 'cards'");
      q('#bnav .nav-item[data-tab="elements"]').click(); await W(30); eq(E('activeTab'), 'books');
      eq(qa('.el-tabs button').map(b => b.textContent), ['Tomos', 'Capítulos', 'Arcos Narrativos', 'Personagens', 'Localizações'], 'cinco separadores');
      qa('.el-tabs button').forEach(b => ok(E('tipFor')(b), 'explicador: ' + b.textContent)); ok(/separador ao lado/.test(E('tipFor')(qa('.el-tabs button')[0]).text), 'o explicador dos Tomos diz onde estão os Capítulos');
      eq(q('#view-page h1').textContent, 'Tomos'); eq(qa('#view-page .list-box').length, 1, 'só a lista dos Tomos'); ok(!q('#view-page .list-sub'), 'sem os Capítulos por baixo');
      eq(qa('#view-page .list-box .card').length, nB, 'todos os Tomos'); ok(!q('#view-page .ch-card'));
      qa('.el-tabs button')[1].click(); await W(30); eq(E('activeTab'), 'chapters'); eq(q('#bnav [aria-current="page"]').dataset.tab, 'elements', 'continua em Elementos');
      ok(q('.el-tabs button.on').textContent === 'Capítulos' && q('.el-tabs button.on').getAttribute('aria-selected') === 'true', 'o separador assinalado');
      eq(q('#view-page h1').textContent, 'Capítulos'); eq(qa('#view-page .ch-card').length, nCh, 'todos os Capítulos, de todos os Tomos');
      eq(qa('#view-page .ch-card .kicker').slice(0, 2).map(k => k.textContent), ['Tomo 1 · Capítulo 1', 'Tomo 1 · Capítulo 2'], 'pela ordem do livro');
      ok(qa('#view-page .page-head .btn').some(b => b.textContent === '+ Novo Capítulo'), 'com «+ Novo Capítulo»'); ok(qa('#view-page .page-head input').length >= 3, 'filtros por Personagem e Arco Narrativo, e procura');
      // filtro do Arco Narrativo: vale para os dois separadores
      E("filters.booksArc = '" + arc.id + "'; renderAll()"); await W(30); const nf = qa('#view-page .ch-card').length; ok(nf > 0 && nf < nCh, 'o filtro do Arco reduz os Capítulos: ' + nf);
      qa('.el-tabs button')[0].click(); await W(30); ok(qa('#view-page .list-box .card').length <= nB, 'e os Tomos'); E('filters.booksArc = null; renderAll()'); qa('.el-tabs button')[1].click(); await W(30);
      // procura própria
      const inp = q('#view-page .page-head input[type="search"], #view-page .page-head .list-q'); ok(inp, 'caixa de procura');
      if (inp){ const name = E('state.books[0].chapters[1].name'); inp.value = name; inp.dispatchEvent(new w.Event('input', {bubbles:true})); await W(30); ok(qa('#view-page .ch-card').length >= 1 && qa('#view-page .ch-card h3').every(h => h.textContent.toLowerCase().includes(name.toLowerCase().slice(0, 4))), 'procura pelo nome');
        qa('.el-tabs button')[0].click(); await W(30); eq(qa('#view-page .list-box .card').length, nB, 'a procura dos Capítulos não esconde Tomos'); qa('.el-tabs button')[1].click(); await W(30); inp.value = ''; E("ListUI.q.chapters = ''; renderAll()"); await W(20); }
      // tocar num Capítulo leva ao quadro
      const c2 = qa('#view-page .ch-card')[1]; c2.click(); await W(60); eq(E('activeTab'), 'board', 'tocar num Capítulo vai ao quadro');
      q('#bnav .nav-item[data-tab="elements"]').click(); await W(30); eq(E('activeTab'), 'chapters', 'Elementos volta ao último separador');
      qa('.el-tabs button')[4].click(); await W(80); { const et = q('.el-tabs'), b = q('.el-tabs button.on').getBoundingClientRect(), r = et.getBoundingClientRect(); ok(b.left >= r.left - 1 && b.right <= r.right + 1, 'o separador escolhido fica à vista, mesmo o último: ' + [b.left, b.right, r.left, r.right, et.scrollLeft, et.scrollWidth, et.clientWidth, q('.el-tabs button.on').textContent]); }
      qa('.el-tabs button')[1].click(); await W(30);
      ok(E("TOUR_STEPS.some(s => s.sel === '.el-tabs' && s.when())"), 'a visita mostra os separadores no telemóvel');
      // alargar a janela (ou rodar para um ecrã largo): no PC, os Capítulos voltam a estar por baixo dos Tomos
      w.frameElement.style.width = '1280px'; w.frameElement.style.height = '800px'; await W(300); if (E('activeTab') === 'chapters') E('renderAll()'); /* a janela de teste pode não desenhar, e o aviso da mudança de tamanho só chega com o desenho */
      eq(E('navMode()'), 'rail'); eq(E('activeTab'), 'books', 'no PC não há separador dos Capítulos'); ok(q('#view-page .list-sub') && qa('#view-page .ch-card').length === nCh, 'os Capítulos por baixo dos Tomos'); });
    setTab('chapters'); await W(20); eq(activeTab, 'books', 'no PC, pedir os Capítulos mostra a página dos Tomos'); eq($('#view-page h1').textContent, 'Tomos e Capítulos'); ok($('#view-page .list-sub'));
    ok(!TOUR_STEPS.find(s => s.sel === '.el-tabs').when(), 'no PC, a visita mostra a página como antes'); setTab('board'); fx(); });
  reset(); try { await Promise.race([idb.clear(), W(5000)]); } catch (e) {}
  const failed = R.filter(r => !r.ok);
  return { total:R.length, passed:R.length - failed.length, failed, uncaught:errs, perf };
})();
