'use strict';
/* ===== Língua, acessibilidade e privacidade =====
   Preferências deste dispositivo (não do projeto): ficam no armazenamento local e valem para todos os projetos. */

/* ----- privacidade: o aviso aparece na primeira abertura e fica sempre no fim das Definições ----- */
const LS_PRIV = 'narrativa.privacySeen';
const onPhoneOrTablet = () => /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
const privacyText = () => onPhoneOrTablet()
  ? _('Esta é uma ferramenta gratuita e sem fins lucrativos. Todos os dados são unicamente gravados no seu aparelho; esta aplicação não recolhe nenhuns dados nem analytics.')
  : _('Esta é uma ferramenta gratuita e sem fins lucrativos. Todos os dados são unicamente gravados no seu computador; esta aplicação não recolhe nenhuns dados nem analytics.');
const privacyDetail = () => _('Não há contas, publicidade, cookies de terceiros nem estatísticas de utilização. Se ligar dois dispositivos em «Sincronizar dispositivos», o projeto passa encriptado diretamente de um para o outro, e o serviço que os põe em contacto não o consegue ler.');
function privacyCard(){
  return h('div', {class:'card static privacy-card', role:'note'}, h('h3', null, svgIcon('shield'), _('Privacidade')),
    h('p', {class:'privacy-main'}, privacyText()), h('p', {class:'muted small'}, privacyDetail()));
}

/* ----- língua ----- */
function langPicker(){
  return h('div', {class:'seg lang-seg', role:'radiogroup', 'aria-label':_('Língua')}, Object.keys(LANGS).map(k =>
    h('button', {class:k === LANG ? 'on' : '', role:'radio', lang:LOCALES[k], 'aria-checked':String(k === LANG), onclick:() => setLang(k)}, LANGS[k])));
}
function langCard(){
  return h('div', {class:'card static lang-card'}, h('h3', null, _('Língua')),
    h('p', {class:'muted small'}, _('Na primeira vez, a ferramenta usa a língua do sistema operativo; a que escolher aqui fica lembrada neste dispositivo. Os Materiais de Apoio são próprios de cada língua. Mudar de língua não altera os seus projetos.')),
    langPicker());
}

/* no ecrã inicial (sem projetos abertos), um botão com as iniciais da língua, ao lado do «?», abre as outras */
function langMenu(btn){
  if (wasOpen(btn)) return;
  topMenu(btn, Object.keys(LANGS).filter(k => k !== LANG).map(k => ({label:k.toUpperCase() + ' · ' + LANGS[k], action:() => setLang(k)})), 'lang-menu');
}
function initLangBtn(){
  const b = $('#langBtn'); if (!b) return;
  b.textContent = LANG.toUpperCase(); b.setAttribute('aria-label', _('Língua') + ': ' + LANGS[LANG]); b.title = _('Mudar de língua');
  b.addEventListener('click', e => langMenu(e.currentTarget));
}

/* ----- acessibilidade ----- */
const LS_A11Y = 'narrativa.a11y';
const A11Y_DEF = { size:'m', motion:'auto', contrast:false, links:false };
const a11y = () => { try { return Object.assign({}, A11Y_DEF, JSON.parse(lsGet(LS_A11Y) || '{}')); } catch(e){ return Object.assign({}, A11Y_DEF); } };
function applyA11y(){
  const o = a11y(), b = document.body; if (!b) return;
  b.dataset.fs = ['m', 'l', 'xl'].includes(o.size) ? o.size : 'm';
  b.classList.toggle('reduce-motion', o.motion === 'reduce' || (o.motion === 'auto' && matchMedia('(prefers-reduced-motion: reduce)').matches));
  b.classList.toggle('hc', !!o.contrast || matchMedia('(prefers-contrast: more)').matches);
  b.classList.toggle('ul-links', !!o.links);
}
function setA11y(k, v){ const o = a11y(); o[k] = v; lsSet(LS_A11Y, JSON.stringify(o)); applyA11y(); if (typeof renderAll === 'function' && state) renderAll(); }
function a11yCard(){
  const o = a11y();
  const seg = (label, key, opts) => h('div', {class:'field'}, h('label', null, label),
    h('div', {class:'seg', role:'radiogroup', 'aria-label':label}, opts.map(([v, l]) =>
      h('button', {class:o[key] === v ? 'on' : '', role:'radio', 'aria-checked':String(o[key] === v), onclick:() => setA11y(key, v)}, l))));
  const sw = (key, label) => h('label', {class:'switch-wrap'}, h('input', {type:'checkbox', checked:!!o[key], onchange:e => setA11y(key, e.target.checked)}), h('span', {class:'slider'}), h('span', null, label));
  return h('div', {class:'card static a11y-card'}, h('h3', null, _('Acessibilidade')),
    h('p', {class:'muted small'}, _('Estas opções valem para este dispositivo. As cores dos Arcos Narrativos, do calendário e do progresso distinguem-se também com daltonismo, e nada depende só da cor: há sempre um nome, uma forma ou um símbolo.')),
    seg(_('Tamanho do texto'), 'size', [['m', _('Normal')], ['l', _('Grande')], ['xl', _('Muito grande')]]),
    seg(_('Animações'), 'motion', [['auto', _('Automático (segue o sistema)')], ['reduce', _('Reduzidas')], ['full', _('Normais')]]),
    sw('contrast', _('Contraste reforçado (texto secundário e contornos mais fortes)')),
    sw('links', _('Sublinhar as ligações')),
    h('div', {class:'field'}, h('label', null, _('Cores dos Arcos Narrativos')),
      h('p', {class:'muted small', style:{margin:'0 0 6px'}}, _('Os Arcos Narrativos novos já recebem cores escolhidas para se distinguirem com qualquer tipo de daltonismo. Pode aplicar a mesma sequência aos Arcos Narrativos deste projeto (pode ser anulado).')),
      h('button', {class:'btn', onclick:() => { recolorArcs(); commit(); toast(_('Cores dos Arcos Narrativos atualizadas.')); }}, _('Aplicar cores seguras para daltonismo'))),
    h('p', {class:'muted small'}, _('Atalhos: Tab percorre os botões, Enter ou Espaço ativam, Esc fecha janelas e menus, Ctrl+Z anula e Ctrl+Shift+Z refaz. Na ficha de uma Cena, ← e → passam à Cena anterior e à seguinte do livro e, com Shift, às do Arco Narrativo. O quadro também se lê em Lista, botão a botão, com leitor de ecrã.')));
}
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applyA11y);
matchMedia('(prefers-contrast: more)').addEventListener('change', applyA11y);

/* ----- boas-vindas: só na primeira abertura, com a língua detetada e o aviso de privacidade ----- */
function welcomeIfNeeded(){
  if (lsGet(LS_PRIV) || /(^|[#&])segundo\b/.test(location.hash) || (typeof Tour !== 'undefined' && Tour.active)) return;
  const done = () => { lsSet(LS_PRIV, '1'); m.close(); };
  const body = h('div', {class:'modal-body welcome'},
    h('p', {class:'privacy-main'}, privacyText()), h('p', {class:'muted small'}, privacyDetail()),
    h('div', {class:'field'}, h('label', null, _('Língua')), langPicker()),
    h('div', {class:'modal-foot'}, h('button', {class:'btn primary', onclick:done}, _('Começar'))));
  const m = openModal({title:_('Bem-vindo ao Narrative'), body, cls:'welcome-modal', onClose:() => lsSet(LS_PRIV, '1')});
  setTimeout(() => { const b = body.querySelector('.btn.primary'); b && b.focus(); }, 0);
}
window.addEventListener('DOMContentLoaded', () => { applyA11y(); initLangBtn(); setTimeout(welcomeIfNeeded, 300); });
