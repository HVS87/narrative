'use strict';
/* ===== Dispositivo: orientação, ecrãs táteis, guardar como app e duplo ecrã ===== */

/* ---------- orientação e tamanho do ecrã ----------
   A orientação vem do próprio ecrã (não da forma da janela, que encolhe quando o teclado abre). */
const LS_ORIENT = 'narrativa.orientHint';
const Device = { portrait:false, compact:false, hintOff:lsGet(LS_ORIENT) === '0' };
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function isPortrait(){
  const o = screen.orientation && screen.orientation.type;
  return o && coarse() ? o.startsWith('portrait') : matchMedia('(orientation: portrait)').matches;
}
function syncDevice(){
  const root = document.documentElement, w = innerWidth;
  const portrait = isPortrait(), compact = w < 700, gut = compact || innerHeight < 520 ? 104 : 170; // ecrã estreito ou baixo (telemóvel deitado)
  const turned = portrait !== Device.portrait;
  Device.portrait = portrait; Device.compact = compact;
  root.dataset.orient = portrait ? 'portrait' : 'landscape';
  root.style.setProperty('--gut', gut + 'px');
  if (gut !== B.GUT){ B.GUT = gut; if (state && activeTab === 'board' && !drag) renderBoard(); } // a coluna dos Story Arcs estreita nos ecrãs pequenos
  if (state) syncDualUI();
  if (turned && state){ closeMenu(); document.querySelectorAll('.ac-list').forEach(l => l.remove()); if (activeTab === 'board') fitBoard(); if (typeof placeTour === 'function') placeTour(); }
  orientHint();
}
/* Num telemóvel ao alto, o quadro mostra pouco: sugere-se rodar o dispositivo (uma vez; pode ser dispensado). */
function orientHint(){
  const el = $('#orientHint'); if (!el) return;
  const show = !!state && !(typeof projNone === 'function' && projNone()) && !Device.hintOff && coarse() && Device.portrait && innerWidth < 600 && activeTab === 'board' && !(typeof Tour !== 'undefined' && Tour.active) && (typeof narrView !== 'function' || narrView() === 'board');
  if (show && !el.firstChild) add(el, h('span', {class:'ic', 'aria-hidden':'true'}, '⟳'), h('span', {class:'grow'}, _('Na horizontal vê-se mais do quadro. Rode o dispositivo.')),
    h('button', {class:'icon-btn', 'aria-label':_('Não voltar a mostrar'), onclick:() => { Device.hintOff = true; lsSet(LS_ORIENT, '0'); orientHint(); }}, '✕'));
  el.hidden = !show;
}
syncDevice();
window.addEventListener('resize', syncDevice);
window.addEventListener('orientationchange', syncDevice);
if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', syncDevice);

/* ---------- guardar como app ---------- */
function syncInstallBtn(){
  const b = $('#installBtn'); if (!b) return;
  b.hidden = isInstalledApp() || Install.done || !(Install.prompt || isIOS());
}
function installHelp(){
  const step = (n, t) => h('div', {class:'step'}, h('span', {class:'ch-num'}, n), h('span', null, t));
  const body = h('div', {class:'modal-body'},
    h('p', {style:{marginTop:0}}, _('Instalada como app, a ferramenta fica com ícone próprio no ecrã principal, abre em ecrã inteiro e funciona sem ligação à internet.')),
    step(1, _('Toque no botão Partilhar do browser (o quadrado com uma seta para cima).')),
    step(2, _('Escolha «Adicionar ao ecrã principal».')),
    step(3, _('Confirme em «Adicionar».')),
    h('p', {class:'muted small'}, _('No iPhone e no iPad, a app guardada tem os seus próprios dados. Para levar o projeto consigo, use primeiro «Guardar Projeto» aqui e depois «Abrir Projeto» na app — ou ligue os dois em «Sincronizar dispositivos».')),
    h('div', {class:'modal-foot'}, h('button', {class:'btn primary', onclick:() => m.close()}, _('Fechar'))));
  const m = openModal({title:_('Instalar como app'), body});
}
function saveAsApp(){ if (Install.prompt) installApp(); else installHelp(); }

/* ---------- duplo ecrã ----------
   Uma segunda janela (noutro ecrã) passa a mostrar as fichas abertas na janela principal, que fica só com o quadro.
   As duas janelas partilham o projeto (evento «storage») e trocam mensagens por um BroadcastChannel. */
const SS_FOLLOW = 'narrativa.follow';
const ssGet = k => { try { return sessionStorage.getItem(k); } catch(e){ return null; } };
const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch(e){} };
const Dual = {
  role:/(^|[#&])segundo\b/.test(location.hash) ? 'second' : 'main',
  follow:ssGet(SS_FOLLOW) !== '0', seen:0, was:false, sel:null, bypass:false, ch:null, showing:'null', rt:null, ot:null,
  alive(){ return this.role === 'main' && Date.now() - this.seen < 4000; },
  post(m){ try { this.ch && this.ch.postMessage(m); } catch(e){} },
  /* janela principal: a ficha abre no outro ecrã, se lá houver uma janela a seguir esta */
  redirect(kind, id, isNew){
    if (this.bypass || tourMode || !this.alive()) return false;
    if (saveT) flushSave(); // a outra janela tem de conhecer o que acabou de ser criado
    const m = {t:'open', kind, id}; if (isNew === true) m.isNew = true; // uma ficha acabada de criar abre com o nome selecionado
    this.post(m); this.sel = {kind, id}; this.mark(true); return true;
  },
  local(fn){ const b = this.bypass; this.bypass = true; try { return fn(); } finally { this.bypass = b; } },
  /* segunda janela: diz à principal que ficha está à vista */
  report(){
    if (this.role !== 'second') return;
    clearTimeout(this.rt); this.rt = setTimeout(() => {
      const top = [...openModals].reverse().find(m => m.entity), en = top ? top.entity : null, k = JSON.stringify(en);
      if (k !== this.showing){ this.showing = k; this.post({t:'showing', en}); } }, 40);
  },
  /* janela principal: assinala no quadro o que está aberto no outro ecrã */
  mark(scroll){
    document.querySelectorAll('.sel2').forEach(x => x.classList.remove('sel2'));
    const s = this.sel; if (!s || this.role !== 'main' || activeTab !== 'board') return;
    const el = s.kind === 'scene' ? els['s:' + s.id] && els['s:' + s.id][0] : s.kind === 'book' ? els['b:' + s.id] && els['b:' + s.id][0]
      : s.kind === 'arc' ? [...document.querySelectorAll('.lane-label')].find(x => x.dataset.arc === s.id) : null;
    if (!el) return; el.classList.add('sel2');
    const c = scroll && s.kind === 'scene' && target['s:' + s.id]; if (!c) return;
    const sc = $('#board-scroll'), z = Z(), vx = c.x * z - sc.scrollLeft, vy = c.y * z - sc.scrollTop, to = {behavior:'smooth'};
    if (vx < (B.GUT + 8) * z || vx + B.SW * z > sc.clientWidth - 8) to.left = (c.x - B.GUT / 2 + B.SW / 2) * z - sc.clientWidth / 2;
    if (vy < 0 || vy + B.SH * z > sc.clientHeight - HEAD_H * z) to.top = (c.y + HEAD_H / 2 + B.SH / 2) * z - sc.clientHeight / 2;
    if ('left' in to || 'top' in to) sc.scrollTo(to);
  }
};
const anyExists = en => !!en && (en.kind === 'ref' ? !!refById(en.id) : en.kind === 'support' ? supportIndex.has(en.id) : !!entityLabel(en.kind, en.id));
function openAny(en){
  if (!anyExists(en)) return false;
  if (en.kind === 'ref') openRefFicha(en.id); else if (en.kind === 'support') openSupportFicha(en.id);
  else if (en.kind === 'character') openCharFicha(en.id, en.isNew); else if (en.kind === 'scenery') openSceneryFicha(en.id, en.isNew); else if (en.kind === 'goal') openGoalFicha(en.id, en.isNew);
  else openEntity(en.kind, en.id);
  return true;
}
/* Todas as fichas passam por aqui: regista-se o que cada janela mostra e, havendo segundo ecrã, é lá que abrem. */
[['scene', 'openSceneFicha'], ['book', 'openBookFicha'], ['arc', 'openArcFicha'], ['character', 'openCharFicha'], ['scenery', 'openSceneryFicha'], ['ref', 'openRefFicha'], ['support', 'openSupportFicha'], ['goal', 'openGoalFicha']].forEach(([kind, fn]) => {
  const orig = window[fn];
  window[fn] = function(id, ...rest){
    if (Dual.redirect(kind, id, rest[0])) return;
    dockBefore(); // com «ficha ao lado», a ficha do painel dá lugar à que se abre a partir do quadro
    const n = openModals.length, r = orig(id, ...rest);
    if (openModals.length > n){ const m = openModals[openModals.length - 1]; m.entity = {kind, id}; dockAfter(m); }
    Dual.report(); return r;
  };
});
/* Repõe, sem animação, as fichas que estavam abertas antes de uma sincronização (as que ainda existirem). */
function reopenFichas(list){
  quietModals = true;
  try { Dual.local(() => list.forEach(x => { if (openAny(x.entity)){ const m = openModals[openModals.length - 1]; m.back.scrollTop = x.scroll; } })); }
  finally { quietModals = false; }
}
function dualOn(msg){
  const m = msg.data; if (!m || !state) return;
  if (Dual.role === 'main'){
    if (m.t === 'here'){ Dual.seen = Date.now(); syncDualUI(); }
    else if (m.t === 'bye'){ Dual.seen = 0; syncDualUI(); }
    else if (m.t === 'showing' && Dual.alive()){ Dual.sel = m.en; Dual.mark(true); }
  } else {
    if (m.t === 'release') setFollow(false);
    else if (m.t === 'follow') setFollow(true);
    else if (m.t === 'open' && Dual.follow && !Tour.active){
      // a mensagem pode chegar antes do projeto atualizado: espera por ele um instante; só então substitui o que estava aberto
      clearTimeout(Dual.ot); let n = 0;
      const go = () => { if (anyExists(m)){ closeAllModals(); openAny(m); } else if (n++ < 8) Dual.ot = setTimeout(go, 120); }; go();
    }
  }
}
function setFollow(on){
  Dual.follow = !!on; ssSet(SS_FOLLOW, on ? '1' : '0');
  Dual.post({t:on ? 'here' : 'bye'}); syncDualUI();
}
function syncDualUI(){
  const b = $('#dualBtn'), bar = $('#dualBar'); if (!b || !bar) return;
  const can = !!Dual.ch;
  if (Dual.role === 'second'){
    b.hidden = true; bar.hidden = !can; bar.innerHTML = '';
    add(bar, h('span', {class:'badge main'}, _('2.º ecrã')),
      h('span', {class:'grow'}, Dual.follow ? _('As fichas que abrir na outra janela aparecem aqui.') : _('Esta janela está independente da outra.')),
      h('button', {class:'btn small', onclick:() => setFollow(!Dual.follow)}, Dual.follow ? _('Parar de seguir') : _('Seguir a outra janela')));
    document.body.style.setProperty('--dual-top', Math.round(bar.getBoundingClientRect().bottom) + 'px'); // as fichas abrem por baixo desta barra
    return;
  }
  bar.hidden = true;
  const alive = Dual.alive();
  b.hidden = !can || coarse(); // num telemóvel ou tablet não há segunda janela para pôr ao lado
  b.classList.toggle('on', alive); b.setAttribute('aria-pressed', alive ? 'true' : 'false');
  if (alive !== Dual.was){ Dual.was = alive; if (!alive){ Dual.sel = null; Dual.mark(); } }
}
function dualClick(){
  if (Dual.alive()){ Dual.post({t:'release'}); Dual.seen = 0; syncDualUI(); return toast(_('As fichas voltam a abrir nesta janela.')); }
  const w = Math.min(1100, screen.availWidth || 1100), hh = screen.availHeight || 800;
  const win = window.open(location.href.split('#')[0] + '#segundo', 'narrativa-segundo', `popup,width=${w},height=${hh}`);
  if (!win) return toast(_('O browser bloqueou a nova janela. Autorize as janelas pop-up deste site e tente outra vez.'));
  // uma segunda janela que já existia (e tinha deixado de seguir) volta a seguir esta
  for (const ms of [300, 1500]) setTimeout(() => Dual.post({t:'follow'}), ms);
  try { win.focus(); } catch(e){}
  toast(screen.isExtended ? _('Segunda janela aberta: as fichas passam a aparecer lá.') : _('Segunda janela aberta. Arraste-a para o outro ecrã: as fichas passam a aparecer lá.'));
  placeOnOtherScreen(win);
}
/* Chrome e Edge sabem onde está o outro ecrã (com autorização): a janela vai para lá sozinha. */
async function placeOnOtherScreen(win){
  if (!screen.isExtended || !('getScreenDetails' in window)) return;
  try { const sd = await window.getScreenDetails(); const o = sd.screens.find(s => s !== sd.currentScreen); if (!o) return;
    win.moveTo(o.availLeft, o.availTop); win.resizeTo(o.availWidth, o.availHeight); } catch(e){}
}
function initDual(){
  if ('BroadcastChannel' in window){ try { Dual.ch = new BroadcastChannel('narrativa-dual'); Dual.ch.onmessage = dualOn; } catch(e){ Dual.ch = null; } }
  document.body.classList.toggle('second', Dual.role === 'second');
  if (Dual.role === 'second'){
    // uma janela escondida, ou a fazer a visita guiada, não pode receber fichas: avisa a principal
    const beat = () => { if (Dual.follow) Dual.post({t:document.hidden || Tour.active ? 'bye' : 'here'}); };
    beat(); setInterval(beat, 1200); document.addEventListener('visibilitychange', beat);
    window.addEventListener('pagehide', () => Dual.post({t:'bye'}));
  } else setInterval(syncDualUI, 1500);
  syncDualUI();
}
window.addEventListener('DOMContentLoaded', () => {
  $('#installBtn').addEventListener('click', saveAsApp); $('#dualBtn').addEventListener('click', dualClick);
  syncInstallBtn(); initDual(); setSaveUI('ok'); syncDevice();
});

/* ----- botão Criar flutuante (telemóvel, com a barra de baixo) -----
   Um botão no canto, como o «+» dos calendários no telemóvel: abre a folha Criar, com a Note em primeiro lugar.
   No PC e no tablet, o botão Criar está no topo da barra lateral. */
function fabUI(){
  const b = $('#createFab'); if (!b) return;
  b.hidden = (typeof navMode === 'function' && navMode() !== 'bottom') || (projNone() && !Tour.active) || tourMode || openModals.length > 0 || Dual.role === 'second' || activeTab === 'settings' || activeTab === 'support';
  document.body.classList.toggle('fab-on', !b.hidden); // os avisos sobem para não ficarem por cima do botão
}
function quickNote(){
  if (tourMode || projNone()) return;
  const r = newNote([]); commit(); openRefFicha(r.id);
  const t = document.querySelector('.modal input'); if (t){ t.focus(); t.select(); }
}
window.addEventListener('DOMContentLoaded', () => { const b = $('#createFab'); if (b) b.addEventListener('click', () => createSheet()); fabUI();
  try { matchMedia('(pointer:coarse)').addEventListener('change', fabUI); } catch(e){} window.addEventListener('resize', fabUI); });
