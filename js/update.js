'use strict';
/* ===== Atualizações automáticas =====
   A ferramenta é a mesma em todo o lado: no browser, instalada pelo browser (Android, iPhone, iPad, PC) e dentro do programa
   para PC, que a abre a partir do site. Não há instalador para correr de novo: com «Procurar sempre atualizações ao iniciar»
   (ligada por omissão), procura a versão publicada no site ao abrir, de 30 em 30 minutos e ao voltar a ela; desligada, só
   quando se carrega em «Procurar atualizações»; quando há uma mais recente, descarrega-a e — com «Instalar atualizações automaticamente» ligado — aplica-a
   num momento em que não se esteja a fazer nada (projeto gravado, sem janelas abertas, nada a ser escrito ou arrastado).
   Com a opção desligada, aparece «Atualizar» na barra de topo e é o utilizador quem escolhe o momento. */
const LS_UPD = 'narrativa.update', SS_UPDATED = 'narrativa.updated';
const UPD_EVERY = 30 * 60000, UPD_IDLE = 4000;
const Upd = { cur:(self.APP_RELEASE || {}).version || '0', date:(self.APP_RELEASE || {}).date || '', remote:null, notes:'',
  state:'idle', ready:false, lastInput:0, waitI:null, cardEl:null, reload:() => location.reload(), hidden:() => document.hidden };

/* compara «1.10.0» com «1.9.2», número a número */
function verCmp(a, b){
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++){ const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; }
  return 0;
}
function parseRelease(t){
  const m = /APP_RELEASE\s*=\s*(\{[\s\S]*\})\s*;?\s*$/.exec(String(t).trim());
  if (!m) return null;
  try { const o = JSON.parse(m[1]); return o && /^\d+(\.\d+){0,3}$/.test(o.version) ? o : null; } catch(e){ return null; }
}
function updCfg(){
  let c = null; try { c = JSON.parse(lsGet(LS_UPD)); } catch(e){}
  c = c && typeof c === 'object' ? c : {};
  return { auto:c.auto !== false, onStart:c.onStart !== false, tried:typeof c.tried === 'string' ? c.tried : null, triedAt:Number(c.triedAt) || 0, checkedAt:Number(c.checkedAt) || 0 };
}
const updSet = o => lsSet(LS_UPD, JSON.stringify(Object.assign(updCfg(), o)));
/* uma atualização já tentada há menos de uma hora, que não chegou (o site ainda a estava a publicar, por exemplo): não se recarrega outra vez */
const updBlocked = () => { const c = updCfg(); return c.tried === Upd.remote && Date.now() - c.triedAt < 3600000; };

async function updCheck(manual){
  if (!/^https?:$/.test(location.protocol) || Dual.role === 'second') return;
  if (navigator.onLine === false){ if (manual) toast(_('Sem ligação à internet. A procura de atualizações retoma quando a ligação voltar.')); return; }
  if (manual || updCfg().onStart) shellCheck(); // o próprio programa para PC, onde se pode atualizar sozinho
  if (Upd.state === 'checking') return;
  Upd.state = 'checking'; updUI();
  let rel = null;
  try { const r = await fetch('js/version.js?t=' + Date.now(), {cache:'no-store'}); if (r.ok) rel = parseRelease(await r.text()); } catch(e){}
  if (!rel){ Upd.state = 'error'; updUI(); if (manual) toast(_('Não foi possível procurar atualizações. Confirme que tem internet.')); return; }
  updSet({checkedAt:Date.now()});
  if (verCmp(rel.version, Upd.cur) <= 0){ Upd.state = 'current'; Upd.remote = null; updUI(); if (manual) toast(_('Está a usar a versão mais recente ({a}).', {a:Upd.cur})); return; }
  Upd.remote = rel.version; const nt = rel.notes; Upd.notes = String(typeof nt === 'string' ? nt : nt && (nt[LANG] || nt.en) || '').slice(0, 300);
  Upd.state = 'available'; updUI();
  await updPrepare();
  if (manual && !updCfg().auto) toast(_('Há uma versão nova ({a}). Clique em «Atualizar» quando quiser.', {a:Upd.remote}));
}
/* descarrega a versão nova para o dispositivo antes de a aplicar (assim também fica disponível sem internet) */
async function updPrepare(){
  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg){
      await reg.update();
      const sw = reg.installing || reg.waiting;
      if (sw && sw.state !== 'activated') await new Promise(res => { const t = setTimeout(res, 20000); sw.addEventListener('statechange', () => { if (sw.state === 'activated' || sw.state === 'redundant'){ clearTimeout(t); res(); } }); });
    }
  } catch(e){}
  Upd.ready = true; Upd.state = 'ready'; updUI();
  if (updCfg().auto && !updBlocked()) updWhenSafe();
}
/* sem nada a meio: nenhuma janela aberta, nada a ser escrito, arrastado ou ligado, sem visita, e uns segundos sem tocar em nada */
function updSafe(){
  const a = document.activeElement;
  return !drag && !linkDrag && !pickLink && !openModals.length && !Tour.active && !document.querySelector('.ctx-menu')
    && !(typeof syncBusy === 'function' && syncBusy()) // nunca a meio de uma troca de dados com outro dispositivo
    && !(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) && !(a && a.isContentEditable)
    && (Upd.hidden() || Date.now() - Upd.lastInput > UPD_IDLE);
}
function updWhenSafe(){
  clearInterval(Upd.waitI);
  const go = () => { if (Upd.state === 'ready' && updSafe()){ clearInterval(Upd.waitI); updApply(); } };
  Upd.waitI = setInterval(go, 1500); go();
}
function updApply(){
  if (!Upd.remote) return;
  clearInterval(Upd.waitI);
  updSet({tried:Upd.remote, triedAt:Date.now()});
  if (saveT) flushSave(); // nada fica por gravar
  ssSet(SS_UPDATED, Upd.remote);
  Upd.state = 'applying'; updUI();
  Upd.reload();
}

/* ---------- o programa para PC ----------
   Só existe dentro do programa para PC (preload.js): procura, descarrega e instala ao fechar uma versão nova do próprio
   programa, onde isso é possível sem voltar a instalar (instalador do Windows, AppImage do Linux). */
const desk = () => (typeof window !== 'undefined' && window.narrativaDesktop && window.narrativaDesktop.shell) || null;
function shellCheck(){ const d = desk(); if (!d || navigator.onLine === false) return; d.check().then(st => { Upd.shell = st; updUI(); }, () => {}); }
function shellRow(){
  const d = desk(); if (!d) return null;
  const st = Upd.shell || {state:'idle'}, v = window.narrativaDesktop.version || '?', old = verCmp(v, Upd.cur) < 0;
  const txt = {checking:_('A procurar uma versão nova do programa…'), current:_('O programa está atualizado.'), downloading:_('A descarregar a versão {a} do programa…', {a:st.version || ''}),
    ready:_('A versão {a} do programa está pronta: é instalada quando fechar a aplicação, sem perder nada.', {a:st.version || ''}),
    error:_('Não foi possível procurar uma versão nova do programa. A ferramenta continua a atualizar-se pelo site.'),
    unsupported:old ? _('Neste formato (versão portátil, macOS ou .tar.gz), o programa não se substitui sozinho; a ferramenta continua a atualizar-se pelo site. Para atualizar também o programa, descarregue a versão nova na página das versões.') : '', idle:''}[st.state] || '';
  return h('div', {class:'upd-shell'}, h('p', {class:'small'}, h('b', null, _('Programa para PC: ')), v, txt ? h('span', {class:'muted'}, ' · ' + txt) : null),
    st.state === 'ready' ? h('button', {class:'btn small primary', onclick:() => d.install()}, _('Reiniciar e atualizar o programa')) : null,
    st.state === 'unsupported' && old ? h('a', {class:'btn small', href:'https://github.com/HVS87/narrative/releases/latest', target:'_blank', rel:'noopener'}, _('Página das versões')) : null);
}

/* ---------- interface ---------- */
const UPD_TXT = {
  idle:'', checking:_('A procurar atualizações…'), current:_('Está a usar a versão mais recente.'),
  error:_('Não foi possível procurar atualizações. A ferramenta volta a tentar mais tarde.'),
  available:_('Há uma versão nova. A descarregar…'), applying:_('A atualizar…') };
function updStatusText(){
  if (Upd.state === 'ready') return updCfg().auto && !updBlocked()
    ? _('A versão {a} está pronta e é instalada assim que deixar de estar a meio de alguma coisa.', {a:Upd.remote})
    : _('A versão {a} está pronta. Clique em «Atualizar agora» quando quiser.', {a:Upd.remote});
  return UPD_TXT[Upd.state] || '';
}
function updUI(){
  const b = $('#updBtn');
  if (b){ const show = Upd.state === 'ready' && (!updCfg().auto || updBlocked()); b.hidden = !show; if (show) b.setAttribute('aria-label', _('Atualizar para a versão {a}', {a:Upd.remote})); }
  const el = Upd.cardEl; if (el && el.isConnected) el.replaceWith(updCard());
}
function updCard(){
  const c = updCfg();
  const el = h('div', {class:'card static upd-card'}, h('h3', null, _('Atualizações')),
    h('p', {class:'muted small'}, _('As versões novas instalam-se sem ser preciso desinstalar nem voltar a instalar, no PC (Windows, macOS, Linux), no telemóvel e no tablet (Android, iPhone, iPad). Os projetos, as preferências e a sincronização entre dispositivos ficam como estão.')),
    h('p', {class:'small'}, h('b', null, _('Versão instalada: ')), Upd.cur + (Upd.date ? ` (${new Date(Upd.date + 'T12:00').toLocaleDateString(LOCALE, {day:'numeric', month:'long', year:'numeric'})})` : ''),
      c.checkedAt ? h('span', {class:'muted'}, _(' · última procura: {a}', {a:new Date(c.checkedAt).toLocaleString(LOCALE, {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})})) : null),
    h('label', {class:'switch-wrap upd-onstart'}, h('input', {type:'checkbox', checked:c.onStart, onchange:e => { updSet({onStart:e.target.checked}); if (e.target.checked) updCheck(false); updUI(); }}),
      h('span', {class:'slider'}), h('span', null, _('Procurar sempre atualizações ao iniciar'))),
    h('p', {class:'muted small upd-hint'}, c.onStart ? _('Procura ao abrir, de 30 em 30 minutos e quando volta à ferramenta.') : _('Só procura quando carregar em «Procurar atualizações».')),
    h('label', {class:'switch-wrap'}, h('input', {type:'checkbox', checked:c.auto, onchange:e => { updSet({auto:e.target.checked}); if (e.target.checked && Upd.state === 'ready') updWhenSafe(); else clearInterval(Upd.waitI); updUI(); }}),
      h('span', {class:'slider'}), h('span', null, _('Instalar atualizações automaticamente'))),
    h('p', {class:'small upd-state', role:'status'}, updStatusText(), Upd.notes && Upd.remote ? h('span', {class:'muted'}, _(' Novidades: ') + Upd.notes) : null),
    h('div', {class:'chips'}, h('button', {class:'btn', disabled:Upd.state === 'checking' || Upd.state === 'applying', onclick:() => updCheck(true)}, _('Procurar atualizações')),
      Upd.state === 'ready' ? h('button', {class:'btn primary', onclick:updApply}, _('Atualizar agora')) : null),
    shellRow());
  Upd.cardEl = el;
  return el;
}

/* ---------- arranque ---------- */
/* as procuras automáticas (ao abrir, de 30 em 30 minutos, ao voltar e quando a internet volta): só com a opção ligada */
function updAutoCheck(){ if (updCfg().onStart) updCheck(false); }
function initUpdate(){
  const done = ssGet(SS_UPDATED);
  if (done){
    try { sessionStorage.removeItem(SS_UPDATED); } catch(e){}
    if (verCmp(Upd.cur, done) >= 0){ updSet({tried:null, triedAt:0}); setTimeout(() => toast(_('Ferramenta atualizada para a versão {a}.', {a:Upd.cur})), 600); }
  }
  ['pointerdown', 'keydown', 'wheel'].forEach(t => window.addEventListener(t, () => { Upd.lastInput = Date.now(); }, {capture:true, passive:true}));
  $('#updBtn').addEventListener('click', updApply);
  const d = desk(); if (d){ d.on(st => { Upd.shell = st; updUI(); }); d.state().then(st => { Upd.shell = st; updUI(); }, () => {}); }
  /* com «Procurar sempre atualizações ao iniciar» desligada, só se procura pelo botão das Definições */
  setTimeout(updAutoCheck, 4000);
  setInterval(updAutoCheck, UPD_EVERY);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden){ if (Upd.state === 'ready' && updCfg().auto && !updBlocked()) updWhenSafe(); return; } // quem não está a olhar não é interrompido
    if (Date.now() - updCfg().checkedAt > 10 * 60000) updAutoCheck();
  });
  window.addEventListener('online', updAutoCheck);
  updUI();
}
window.addEventListener('DOMContentLoaded', initUpdate);
