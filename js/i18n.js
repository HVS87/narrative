'use strict';
/* ===== Línguas: português, inglês, espanhol e francês =====
   Na primeira vez, a língua vem do sistema operativo (navigator.languages); depois, fica a que escolher nas Definições.
   Os textos da interface escrevem-se em português dentro de _('…'): o português é a chave e o dicionário de cada outra
   língua (js/lang-xx.js) diz como se escreve lá. Só se carregam os textos e os Materiais de Apoio da língua ativa;
   mudar de língua recarrega a página (o projeto fica gravado). */
const LS_LANG = 'narrativa.lang';
const LANGS = { pt:'Português', en:'English', es:'Español', fr:'Français' };
const LOCALES = { pt:'pt-PT', en:'en-GB', es:'es-ES', fr:'fr-FR' };
function detectLang(){
  const list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || '']);
  for (const l of list){ const c = String(l || '').slice(0, 2).toLowerCase(); if (LANGS[c]) return c; }
  return 'en';
}
let LANG = (() => { try { const v = localStorage.getItem(LS_LANG); if (LANGS[v]) return v; } catch(e){} return detectLang(); })();
/* datas e números: a variante regional do sistema quando é da mesma língua (en-US, es-MX, fr-CA…) */
const LOCALE = (() => { const n = (navigator.language || '').replace('_', '-'); return n.slice(0, 2).toLowerCase() === LANG && /^[a-z]{2}-[A-Za-z]{2}$/.test(n) ? n : LOCALES[LANG]; })();
const I18N = {};
/* _('Texto em português', {nome:'…'}): o texto na língua ativa; {nome} é substituído pelo valor */
function _(s, vars){
  const d = I18N[LANG], tr = d && Object.prototype.hasOwnProperty.call(d, s) ? d[s] : s;
  return vars ? String(tr).replace(/\{(\w+)\}/g, (m, k) => vars[k] != null ? vars[k] : m) : tr;
}
/* o mesmo texto português com sentidos diferentes noutra língua: _x('estado', 'Escrita') procura primeiro «estado|Escrita» */
const _x = (ctx, s, vars) => { const d = I18N[LANG]; return d && Object.prototype.hasOwnProperty.call(d, ctx + '|' + s) ? _(ctx + '|' + s, vars) : _(s, vars); };
/* plural: _n(n, '{n} Cena', '{n} Cenas') — as duas formas passam pela tradução */
const _n = (n, one, many, vars) => _(n === 1 ? one : many, Object.assign({n}, vars || {}));
function setLang(l){
  if (!LANGS[l] || l === LANG) return;
  try { localStorage.setItem(LS_LANG, l); } catch(e){}
  if (typeof flushSave === 'function' && typeof saveT !== 'undefined' && saveT) flushSave();
  if (typeof Projects !== 'undefined') Projects.leaving = true; // recarregar não é sair: não pergunta nada
  location.reload();
}
document.documentElement.lang = LOCALES[LANG];
/* os ficheiros da língua ativa: a tradução da interface e os Materiais de Apoio */
const SUPPORT_FILES = {
  pt:['js/apoio-pt-0.js', 'js/apoio-a.js', 'js/apoio-b.js', 'js/apoio-c.js', 'js/apoio-d.js', 'js/apoio-e.js', 'js/apoio-f.js', 'js/apoio-g.js', 'js/apoio-h.js', 'js/apoio-i.js'],
  en:['js/apoio-en-1.js', 'js/apoio-en-2.js', 'js/apoio-en-3.js'],
  es:['js/apoio-es-1.js', 'js/apoio-es-2.js', 'js/apoio-es-3.js'],
  fr:['js/apoio-fr-1.js', 'js/apoio-fr-2.js', 'js/apoio-fr-3.js'] };
const writeScripts = list => list.forEach(src => document.write('<script src="' + src + '"><\/script>'));
if (LANG !== 'pt') writeScripts(['js/lang-' + LANG + '.js']);
/* textos fixos do index.html (rótulos de botões, títulos): o português está lá e é traduzido ao arrancar */
function translateStatic(root){
  if (LANG === 'pt') return;
  (root || document).querySelectorAll('[aria-label]').forEach(el => el.setAttribute('aria-label', _(el.getAttribute('aria-label'))));
  (root || document).querySelectorAll('[data-t]').forEach(el => { el.textContent = _(el.textContent); });
}
document.addEventListener('DOMContentLoaded', () => translateStatic(), {once:true});
