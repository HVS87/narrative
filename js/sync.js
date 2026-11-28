'use strict';
const RESTORE = 'reposição'; // marca guardada nas cópias de segurança: não se traduz (é comparada)
/* ===== Sincronização entre dispositivos (telemóvel ↔ PC) =====
   Os dispositivos ligam-se um ao outro por WebRTC, com os dados cifrados no caminho. O serviço público do PeerJS põe-nos em
   contacto e, quando a rede não permite a ligação direta, retransmite os dados (cifrados). Emparelha-se uma vez, com um
   código de 6 caracteres; daí em diante, sempre que a ferramenta está aberta nos dois, cada alteração passa para o outro.
   Cada ligação prova conhecer a chave secreta trocada no emparelhamento, por isso ninguém mais se consegue ligar.
   Se os dois foram alterados desde a última sincronização, pergunta-se qual versão manter; a outra fica guardada como cópia
   no dispositivo onde estava. Só uma janela por dispositivo sincroniza (as outras chegam-lhe pelo armazenamento local).
   Sincroniza-se o projeto ativo; cada mensagem diz qual é. Se os dois dispositivos tiverem projetos diferentes abertos,
   a sincronização espera, e as Definições oferecem mudar para o mesmo projeto (ou recebê-lo do outro dispositivo). */
const LS_SYNC = 'narrativa.sync', LS_BACKUP = 'narrativa.backup', LS_CHANGED = 'narrativa.changed'; // hora da última alteração feita neste dispositivo
const changedAt = () => Number(lsGet(LS_CHANGED)) || 0;
const SYNC_PREFIX = 'narrativa-v1-';
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem O/0 nem I/1, que se confundem
const ID_RE = /^[0-9a-f]{20}$/;
const FILE_MAX = 512 * 1024 * 1024; // um ficheiro maior do que isto não é aceite de outro dispositivo

const randBytes = n => crypto.getRandomValues(new Uint8Array(n));
const hex = n => [...randBytes(n)].map(x => x.toString(16).padStart(2, '0')).join('');
const randCode = () => [...randBytes(6)].map(x => CODE_ABC[x % CODE_ABC.length]).join('');
const b64 = u8 => btoa(String.fromCharCode(...u8));
const unb64 = s => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));
/* a mesma representação do projeto nos dois dispositivos, qualquer que seja a ordem das propriedades */
const stable = v => Array.isArray(v) ? '[' + v.map(stable).join(',') + ']'
  : v && typeof v === 'object' ? '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}'
  : JSON.stringify(v === undefined ? null : v);
async function projHash(s){ const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stable(s))); return [...new Uint8Array(d)].slice(0, 12).map(x => x.toString(16).padStart(2, '0')).join(''); }
async function hmac(secret, msg){
  const k = await crypto.subtle.importKey('raw', unb64(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  return b64(new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg))));
}
/* projeto em branco — tal como sai de «Novo Projeto», sem nada mudado — : nada a perder ao ser substituído */
function isBlankProject(s){
  const b = s.books;
  return s.project.name === _('Novo Projeto') && !Object.keys(s.scenes).length && !s.characters.length && !s.refs.length && !s.sceneries.length && !s.arcs.length
    && b.length === 1 && b[0].name === _('Tomo 1') && !b[0].narrator && !b[0].color && b[0].chapters.length === 1 && b[0].chapters[0].name === _('Novo Capítulo')
    && !(s.goals || []).length && !s.plan && !b[0].due && !b[0].chapters[0].due; // objetivos e prazos também são trabalho
}
const syncCur = () => Tour.active ? Tour.saved.state : state; // durante a visita, o projeto verdadeiro está guardado à parte
/* o projeto que se sincroniza (o ativo) e a última versão que os dois dispositivos tiveram em comum desse projeto */
const myPid = () => Projects.idx.active || null;
const lastOf = pr => (myPid() && pr.lasts[myPid()]) || null;
const setLast = (pr, hh) => { if (myPid()) pr.lasts[myPid()] = hh; };
const projSummary = s => [_n(s.books.length, '{n} Tomo', '{n} Tomos'), _n(Object.keys(s.scenes).length, '{n} Cena', '{n} Cenas'), _n(s.characters.length, '{n} Personagem', '{n} Personagens')].join(', ');
const hhmm = (t, sec) => t ? new Date(t).toLocaleString(LOCALE, Object.assign({day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'}, sec ? {second:'2-digit'} : null)) : '—';

function defaultDeviceName(){
  const ua = navigator.userAgent;
  if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? _('Telemóvel Android') : _('Tablet Android');
  if (/Windows/.test(ua)) return _('PC Windows');
  if (/Macintosh/.test(ua)) return _('Mac');
  return _('Computador');
}
function syncLoadCfg(){
  let c = null; try { c = JSON.parse(lsGet(LS_SYNC)); } catch(e){}
  if (!c || typeof c !== 'object') c = {};
  const isNew = !ID_RE.test(c.id || '');
  if (isNew) c.id = hex(10);
  c.name = typeof c.name === 'string' && c.name.trim() ? c.name.slice(0, 60) : defaultDeviceName();
  c.pairs = (Array.isArray(c.pairs) ? c.pairs : []).filter(p => p && ID_RE.test(p.id) && p.id !== c.id && typeof p.secret === 'string')
    .map(p => { const lasts = {};
      if (p.lasts && typeof p.lasts === 'object') for (const k in p.lasts) if (typeof p.lasts[k] === 'string') lasts[k] = p.lasts[k];
      if (typeof p.last === 'string' && Projects.idx.open[0] && !lasts[Projects.idx.open[0]]) lasts[Projects.idx.open[0]] = p.last; // configuração da versão de um só projeto
      return {id:p.id, name:String(p.name || _('Dispositivo')).slice(0, 60), secret:p.secret, lasts, at:Number(p.at) || 0}; });
  Object.defineProperty(c, 'isNew', {value:isNew, enumerable:false});
  return c;
}

/* boot: identifica esta abertura da ferramenta; uma ligação nova com outro «boot» quer dizer que o outro dispositivo foi reaberto */
const Sync = { boot:hex(8), cfg:null, peer:null, links:new Map(), status:'off', libP:null, sendT:null, retryI:null, sentReset:null, cardEl:null,
  starting:false, owner:false };
const syncSave = () => lsSet(LS_SYNC, JSON.stringify(Sync.cfg));
/* carregada já, e não só no arranque: a página das Definições pode ser desenhada antes (ao reabrir nesse separador) */
Sync.cfg = syncLoadCfg();
const linkOf = id => { const L = Sync.links.get(id); return L && L.authed ? L : null; };

/* Outra janela deste dispositivo mudou a configuração (emparelhou ou desligou um dispositivo, mudou o nome).
   Junta-se ao que esta janela tem, sem trocar os objetos que as ligações abertas estão a usar. */
function syncReloadCfg(){
  const fresh = syncLoadCfg(); if (fresh.id !== Sync.cfg.id) return;
  const c = Sync.cfg; c.name = fresh.name;
  const keep = [];
  for (const fp of fresh.pairs){
    const p = c.pairs.find(x => x.id === fp.id);
    if (!p){ keep.push(fp); continue; }
    p.name = fp.name; p.secret = fp.secret; p.at = Math.max(p.at, fp.at); if (!Sync.owner) p.lasts = fp.lasts; // quem sincroniza é que sabe o «last»
    keep.push(p);
  }
  for (const p of c.pairs) if (!keep.includes(p)) syncDropLink(p.id, true); // desligado noutra janela: avisa o outro dispositivo
  c.pairs = keep; syncUI();
  if (Sync.peer) syncConnectAll(); else if (c.pairs.length) syncStart();
}

/* a biblioteca só é carregada quando é precisa (vem com a aplicação e fica disponível sem internet) */
function syncLib(){
  if (window.peerjs) return Promise.resolve(window.peerjs.Peer);
  return Sync.libP || (Sync.libP = new Promise((res, rej) => {
    const s = h('script', {src:'js/vendor/peerjs.min.js'});
    s.onload = () => window.peerjs ? res(window.peerjs.Peer) : rej(new Error('biblioteca'));
    s.onerror = () => { Sync.libP = null; s.remove(); rej(new Error('biblioteca')); };
    document.head.append(s);
  }));
}

/* ---------- estado e indicador ---------- */
const SYNC_TXT = {
  off:_('Sem dispositivos ligados.'),
  connecting:_('A ligar ao serviço de sincronização…'),
  ready:_('À espera de que a ferramenta seja aberta no outro dispositivo.'),
  linked:_('Ligado: as alterações passam para o outro dispositivo à medida que as faz.'),
  conflict:_('Há versões diferentes por resolver.'),
  other:_('Os dispositivos ligados têm outro projeto aberto: a sincronização espera até estarem no mesmo projeto.'),
  offline:_('Sem ligação à internet. A sincronização retoma quando a ligação voltar.'),
  elsewhere:_('A sincronização está a decorrer noutra janela desta ferramenta.'),
  error:_('O serviço de sincronização não respondeu. A ferramenta volta a tentar dentro de momentos.'),
  unsupported:_('Este browser não permite ligações diretas entre dispositivos.') };
function syncState(){
  if (!Sync.cfg.pairs.length) return 'off';
  const ls = [...Sync.links.values()].filter(L => L.authed);
  return ls.some(L => L.unresolved) ? 'conflict' : ls.some(L => L.other) && !ls.some(L => L.synced && !L.other) ? 'other' : ls.length ? 'linked' : Sync.status;
}
function syncStatus(s){ if (s) Sync.status = s; syncUI(); }
function syncUI(){
  const b = $('#syncBtn'); if (!b || !Sync.cfg) return;
  const st = syncState();
  b.hidden = !Sync.cfg.pairs.length || Dual.role === 'second';
  b.dataset.state = st; b.classList.toggle('on', st === 'linked');
  b.setAttribute('aria-label', _('Sincronização: ') + SYNC_TXT[st]);
  syncRefreshCard();
}

/* ---------- ligação principal (entre dispositivos já emparelhados) ---------- */
/* Só uma janela por dispositivo pode sincronizar: a que tiver a «chave» (Web Locks). As outras esperam por ela, sem gastar rede. */
function syncClaim(){
  if (Sync.owner) return Promise.resolve(true);
  if (!navigator.locks || !navigator.locks.request) return Promise.resolve(Sync.owner = true);
  return new Promise(res => {
    let got = false;
    navigator.locks.request('narrativa-sync', () => { got = true; Sync.owner = true; res(true); return new Promise(() => {}); }) // mantém-na até a janela fechar
      .catch(() => { if (!got){ Sync.owner = true; res(true); } });
    setTimeout(() => { if (!got) syncStatus('elsewhere'); }, 250);
  });
}
async function syncStart(){
  if (Sync.peer || Sync.starting || !Sync.cfg.pairs.length || Dual.role === 'second') return;
  Sync.starting = true;
  try {
    await syncClaim();
    if (Sync.peer || !Sync.cfg.pairs.length) return;
    let Peer; try { Peer = await syncLib(); } catch(e){ return syncStatus(navigator.onLine === false ? 'offline' : 'error'); }
    syncStatus('connecting');
    const p = new Peer(SYNC_PREFIX + Sync.cfg.id, {debug:0});
    Sync.peer = p;
    p.on('open', () => { if (Sync.peer === p){ syncStatus('ready'); syncConnectAll(); } });
    p.on('connection', conn => syncAccept(conn));
    p.on('disconnected', () => { if (Sync.peer === p && !p.destroyed){ syncStatus(navigator.onLine === false ? 'offline' : 'connecting'); setTimeout(() => { if (Sync.peer === p && !p.destroyed && p.disconnected) try { p.reconnect(); } catch(e){} }, 4000); } });
    p.on('error', err => {
      const t = err && err.type;
      if (t === 'peer-unavailable'){
        // o outro dispositivo não está aberto: a tentativa é descartada já (senão ficava a bloquear a ligação que ele fizer ao abrir)
        for (const [id, L] of Sync.links) if (!L.authed && String(err.message || '').includes(SYNC_PREFIX + id)){ L.dropped = true; try { L.conn.close(); } catch(e){} Sync.links.delete(id); }
        return;
      }
      if (t === 'browser-incompatible'){ syncStop(); return syncStatus('unsupported'); }
      // «unavailable-id»: o serviço ainda guarda a sessão anterior desta janela (ao recarregar); volta-se a tentar no próximo ciclo
      if (t === 'unavailable-id'){ syncStop(); return syncStatus('connecting'); }
      if (Sync.peer === p) syncStatus(navigator.onLine === false ? 'offline' : 'error');
    });
    if (!Sync.retryI) Sync.retryI = setInterval(syncTick, 10000);
  } finally { Sync.starting = false; }
}
function syncStop(){
  const p = Sync.peer; Sync.peer = null;
  [...Sync.links.values()].forEach(L => { L.dropped = true; try { L.conn.close(); } catch(e){} }); Sync.links.clear();
  if (p) try { p.destroy(); } catch(e){}
}
/* de 10 em 10 segundos (e ao voltar à ferramenta): volta a ligar ao serviço e tenta chegar aos dispositivos que faltam */
function syncTick(){
  if (Dual.role === 'second' || !Sync.cfg.pairs.length) return;
  if (!Sync.peer){ if (Sync.status !== 'unsupported') syncStart(); return; }
  if (Sync.peer.disconnected && !Sync.peer.destroyed){ try { Sync.peer.reconnect(); } catch(e){} return; }
  const now = Date.now();
  for (const [id, L] of Sync.links) if (!L.authed && now - L.t0 > 15000){ L.dropped = true; try { L.conn.close(); } catch(e){} Sync.links.delete(id); }
  if (!document.hidden) syncConnectAll();
}
function syncConnectAll(){
  const p = Sync.peer; if (!p || p.disconnected || p.destroyed) return;
  for (const pr of Sync.cfg.pairs) if (!Sync.links.has(pr.id))
    syncWire(p.connect(SYNC_PREFIX + pr.id, {metadata:{from:Sync.cfg.id, boot:Sync.boot, v:1}, serialization:'binary', reliable:true}), pr, true);
}
function syncAccept(conn){
  const m = conn.metadata || {}, pr = Sync.cfg.pairs.find(x => x.id === m.from);
  if (!pr || conn.peer !== SYNC_PREFIX + m.from){ conn.on('open', () => conn.close()); return; } // desconhecido: recusa
  syncWire(conn, pr, false);
}
function syncWire(conn, pr, outgoing){
  const initiator = outgoing ? Sync.cfg.id : pr.id, boot = outgoing ? null : String((conn.metadata || {}).boot || '');
  const L = {conn, pr, initiator, boot, authed:false, nonce:hex(16), t0:Date.now(), synced:false, unresolved:null, conflict:null, chose:null, winner:null,
    asked:new Set(), q:Promise.resolve(), dropped:false};
  const cur = Sync.links.get(pr.id);
  if (cur && cur.conn !== conn){
    if (cur.authed && cur.boot !== boot){
      // o outro dispositivo foi reaberto e a ligação antiga ainda não deu por isso:
      // a nova fica à espera e, se provar conhecer a chave, substitui a antiga (ver «proof»)
      setTimeout(() => { if (!L.authed){ L.dropped = true; try { conn.close(); } catch(e){} } }, 20000);
    } else if (cur.initiator < initiator){ conn.on('open', () => conn.close()); return null; } // ligaram-se os dois ao mesmo tempo: fica a do identificador menor
    else { cur.dropped = true; try { cur.conn.close(); } catch(e){} Sync.links.set(pr.id, L); }
  } else Sync.links.set(pr.id, L);
  conn.on('open', () => conn.send({t:'hi', nonce:L.nonce, boot:Sync.boot, ver:Upd.cur})); // a versão: as anteriores ignoram-na
  // as mensagens são tratadas uma de cada vez, pela ordem em que chegam
  conn.on('data', d => { Sync.lastMsg = Date.now(); L.q = L.q.then(() => syncOnData(L, d)).catch(e => console.error(e)); });
  conn.on('close', () => syncClosed(L));
  conn.on('error', () => syncClosed(L));
  return L;
}
function syncClosed(L){
  if (Sync.links.get(L.pr.id) === L) Sync.links.delete(L.pr.id);
  if (L.conflict) L.conflict.close();
  if (L.authed && !L.dropped) toast(_('«{nome}» desligou-se. As alterações continuam guardadas neste dispositivo.', {nome:L.pr.name}));
  L.authed = false; L.dropped = true; syncUI();
}
function syncDropLink(id, tell){
  const L = Sync.links.get(id); if (!L) return;
  if (tell && L.authed) try { L.conn.send({t:'unpair'}); } catch(e){}
  L.dropped = true; Sync.links.delete(id); if (L.conflict) L.conflict.close();
  setTimeout(() => { try { L.conn.close(); } catch(e){} }, 300);
}

/* a versão do outro dispositivo (para a mostrar e para procurar logo uma atualização se a dele for mais recente).
   Versões diferentes sincronizam como sempre: o projeto vai inteiro e passa pela mesma reparação de qualquer ficheiro. */
function syncPeerVersion(L, v){
  if (typeof v !== 'string' || !/^\d+(\.\d+){0,3}$/.test(v)) return;
  L.ver = v; if (L.pr.ver !== v){ L.pr.ver = v; syncSave(); syncUI(); }
  if (typeof updCheck === 'function' && verCmp(v, Upd.cur) > 0 && updCfg().onStart && Upd.state !== 'ready') updCheck(false);
}
/* a meio de uma troca de dados (envio por fazer, mensagens a chegar, versões por escolher ou um projeto a receber):
   a ferramenta não se atualiza (recarrega) nesse momento */
const syncBusy = () => !!Sync.sendT || Date.now() - (Sync.lastMsg || 0) < 5000 || [...Sync.links.values()].some(L => L.conflict || L.want);

/* ---------- mensagens ---------- */
async function syncOnData(L, d){
  if (!d || typeof d !== 'object' || L.dropped) return;
  const pr = L.pr;
  if (d.t === 'hi' && typeof d.nonce === 'string'){ if (typeof d.boot === 'string') L.boot = d.boot; syncPeerVersion(L, d.ver); L.conn.send({t:'proof', mac:await hmac(pr.secret, d.nonce + '|' + Sync.cfg.id)}); return; }
  if (d.t === 'proof'){
    if (typeof d.mac !== 'string' || d.mac !== await hmac(pr.secret, L.nonce + '|' + pr.id)){ L.dropped = true; L.conn.close(); return; } // não conhece a chave
    const old = Sync.links.get(pr.id);
    if (old && old !== L){ old.dropped = true; if (old.conflict) old.conflict.close(); try { old.conn.close(); } catch(e){} }
    Sync.links.set(pr.id, L);
    L.authed = true; pr.at = Date.now(); syncSave(); syncUI(); return syncSendHead(L);
  }
  if (!L.authed) return; // nada passa antes de o outro provar quem é
  if (d.t === 'head') return syncOnHead(L, d);
  if (d.t === 'full') return syncOnFull(L, d);
  if (d.t === 'want' && typeof d.pid === 'string'){ if (d.pid === myPid()) syncSendFull(L, {want:true}); return; }
  if (d.t === 'ack' && typeof d.hash === 'string'){ if (d.pid && d.pid !== myPid()) return; setLast(pr, d.hash); pr.at = Date.now(); L.synced = true; L.unresolved = null; L.chose = L.winner = null; syncSave(); syncUI(); return; }
  if (d.t === 'choose' && typeof d.keep === 'string') return syncOnChoose(L, d.keep);
  if (d.t === 'need' && Array.isArray(d.ids)) return syncSendFiles(L, d.ids);
  if (d.t === 'file') return syncOnFile(L, d);
  if (d.t === 'name' && typeof d.name === 'string'){ pr.name = d.name.trim().slice(0, 60) || pr.name; syncSave(); syncUI(); return; }
  if (d.t === 'unpair'){ const nm = pr.name; syncForget(pr.id, false); toast(_('«{a}» deixou de sincronizar com este dispositivo.', {a:nm})); }
}
async function syncSendHead(L){
  const s = syncCur();
  L.conn.send({t:'head', pid:myPid(), pname:myPid() ? s.project.name : '', hash:await projHash(s), last:lastOf(L.pr), blank:isBlankProject(s), at:changedAt(), name:Sync.cfg.name, sum:projSummary(s)});
}
async function syncOnHead(L, d){
  const pr = L.pr;
  if (typeof d.name === 'string' && d.name.trim() && d.name !== pr.name){ pr.name = d.name.trim().slice(0, 60); syncSave(); }
  if (typeof d.hash !== 'string') return;
  // projetos diferentes abertos (ou nenhum): espera-se; as Definições oferecem ficar no mesmo projeto
  // sem «pid» (um dispositivo com a versão anterior, de um só projeto): conta como o mesmo projeto; «null» = nenhum projeto aberto
  const theirPid = typeof d.pid === 'string' ? d.pid : d.pid === null ? null : LEGACY_ID; // a versão anterior só conhece o projeto que tinha
  if (theirPid !== myPid() || !myPid()){ L.other = {pid:theirPid, name:String(d.pname || _('Projeto')).slice(0, 200)}; L.synced = false; syncUI(); return; }
  L.other = null;
  const pid0 = myPid(), s = syncCur(), mine = await projHash(s), base = lastOf(pr);
  if (myPid() !== pid0) return; // mudou de projeto entretanto: a conversa recomeça (syncProjectChanged)
  if (mine === d.hash){ setLast(pr, mine); pr.at = Date.now(); L.synced = true; syncSave(); syncUI(); toast(_('Sincronizado com «{nome}».', {nome:pr.name})); return syncAskFiles(L); }
  // Mudou o meu desde a última vez? E o do outro? (um projeto em branco conta como «sem alterações»;
  // se o outro já tinha recebido exatamente esta versão, a minha também não mudou)
  const iChanged = mine !== base && mine !== d.last && !isBlankProject(s), theyChanged = d.hash !== base && !d.blank;
  if (iChanged && !theyChanged) return syncSendFull(L);
  if (theyChanged && !iChanged) return; // é o outro que envia
  if (!iChanged && !theyChanged){ if (Sync.cfg.id < pr.id) syncSendFull(L); return; } // dois projetos em branco: só um envia
  syncConflict(L, d);
}
async function syncSendFull(L, o){
  o = o || {}; if (!myPid()) return;
  const data = JSON.parse(JSON.stringify(syncCur())), hash = await projHash(data);
  L.conn.send({t:'full', pid:myPid(), pname:data.project.name, want:!!o.want, data, hash, base:lastOf(L.pr), forced:!!o.forced, live:!!o.live, reset:!!o.reset, at:changedAt(), sum:projSummary(data)});
}
async function syncOnFull(L, d){
  const pr = L.pr; let fresh;
  if (typeof d.hash !== 'string') return;
  try { fresh = sanitize(JSON.parse(JSON.stringify(d.data))); } catch(e){ return; }
  let adopted = false; // projeto criado agora, vazio, só para receber este: nada a perguntar nem a guardar
  const dpid = typeof d.pid === 'string' ? d.pid : LEGACY_ID; // a versão anterior só conhece o projeto que tinha
  if (tourMode && dpid !== myPid()) return;
  if (dpid !== myPid()){
    // um projeto que não é o ativo: só entra se tiver sido pedido aqui («Abrir … neste dispositivo»)
    if (!d.want || L.want !== dpid || !PID_RE.test(dpid)) return;
    L.want = null; adopted = projAdopt(dpid, fresh.project.name) === 'new';
    if (myPid() !== dpid) return;
  }
  if (!myPid()) return;
  const pid0 = myPid();
  L.other = null;
  // a escolha feita nos dois ao mesmo tempo é decidida pelo dispositivo de identificador menor: a outra versão é ignorada
  if (d.forced && L.winner === Sync.cfg.id) return;
  const mine = syncCur(), myHash = await projHash(mine);
  if (myPid() !== pid0) return; // mudou de projeto entretanto
  if (myHash === d.hash){ setLast(pr, d.hash); L.synced = true; L.unresolved = null; syncSave(); syncUI(); L.conn.send({t:'ack', pid:myPid(), hash:d.hash}); return; }
  // alterações dos dois lados ao mesmo tempo: pergunta-se, em vez de perder umas ou outras
  if (!adopted && !d.forced && myHash !== lastOf(pr) && myHash !== d.base && !isBlankProject(mine)) return syncConflict(L, d);
  // antes de substituir um projeto com conteúdo (fora das alterações ao vivo), guarda-se uma cópia; sem espaço, não se substitui
  if (!adopted && !d.live && !isBlankProject(mine) && !syncBackup(mine, pr.name)){
    L.synced = false; toast(_('Não há espaço neste dispositivo para guardar uma cópia de segurança, por isso a versão de «{nome}» não foi aplicada. Guarde o projeto num ficheiro e liberte espaço.', {nome:pr.name})); return;
  }
  if (d.reset){ markReset(); Sync.sentReset = lsGet(LS_RESET); }
  const json = JSON.stringify(fresh);
  try { localStorage.setItem(LS_KEY, json); } catch(e){ toast(_('Não foi possível guardar o projeto recebido: ') + e.message); return; }
  applyExternal(fresh, !!d.reset || adopted); projTouched(json); // um projeto acabado de receber começa sem nada para anular
  setLast(pr, d.hash); pr.at = Date.now(); L.synced = true; L.unresolved = null; L.chose = L.winner = null; syncSave();
  if (L.conflict) L.conflict.close();
  syncUI(); L.conn.send({t:'ack', pid:myPid(), hash:d.hash});
  if (!d.live) toast(_('Projeto atualizado a partir de «{nome}».', {nome:pr.name}));
  syncAskFiles(L);
  syncRelay(L, !!d.reset); // e segue para os outros dispositivos ligados a este
}
/* uma alteração feita aqui (nesta janela ou noutra janela deste dispositivo) segue para os dispositivos ligados */
function syncLocalChanged(){
  if (!Sync.cfg || tourMode || !myPid()) return;
  lsSet(LS_CHANGED, String(Date.now()));
  if (!Sync.peer) return; // só a janela que sincroniza envia
  clearTimeout(Sync.sendT);
  Sync.sendT = setTimeout(() => {
    Sync.sendT = null; // enviado: deixa de haver um envio por fazer
    const rs = lsGet(LS_RESET), reset = rs !== Sync.sentReset; Sync.sentReset = rs; // projeto importado ou novo: os outros recomeçam o histórico
    syncRelay(null, reset);
  }, 500);
}
async function syncRelay(from, reset){
  if (!myPid()) return;
  const hash = await projHash(syncCur());
  for (const L of Sync.links.values()) if (L !== from && L.authed && L.synced && !L.other && !L.unresolved && hash !== lastOf(L.pr)) syncSendFull(L, {live:true, reset});
}
/* este dispositivo mudou de projeto (ou abriu / fechou um): recomeça a conversa com cada dispositivo ligado */
function syncProjectChanged(){
  clearTimeout(Sync.sendT); Sync.sendT = null;
  for (const L of Sync.links.values()) if (L.authed){ L.synced = false; L.unresolved = null; L.chose = L.winner = null; L.other = null; if (L.conflict) L.conflict.close(); syncSendHead(L); }
  syncUI();
}
/* receber de outro dispositivo um projeto que aqui não está aberto */
function syncWant(L){
  if (!L || !L.other || !L.other.pid) return;
  L.want = L.other.pid; L.conn.send({t:'want', pid:L.other.pid}); toast(_('A receber «{nome}» de «{nome1}»…', {nome:L.other.name, nome1:L.pr.name}));
}
/* fica com o projeto «pid» ativo: muda para ele se já estiver aberto ou nos recentes; senão, cria-o em branco para o receber */
function projAdopt(pid, name){
  const I = Projects.idx; if (tourMode) return null;
  if (I.open.includes(pid)) return projSwitch(pid);
  if (I.recent.includes(pid)) return projReopen(pid);
  const p = blankProject(); p.project.name = name || _('Projeto'); return projAdd(p, {id:pid}) ? 'new' : null;
}

/* ---------- ficheiros das Referências ---------- */
async function syncAskFiles(L){
  const need = [];
  for (const r of syncCur().refs) if (r.fileName){ try { if (!(await idb.get(r.id))) need.push(r.id); } catch(e){} }
  need.slice(0, 500).forEach(id => L.asked.add(id));
  if (need.length) L.conn.send({t:'need', ids:need.slice(0, 500)});
}
async function syncSendFiles(L, ids){
  for (const id of new Set(ids.slice(0, 500))){
    if (typeof id !== 'string' || !syncCur().refs.some(r => r.id === id)) continue;
    try { const b = await idb.get(id); if (b && b.size <= FILE_MAX) L.conn.send({t:'file', id, buf:await b.arrayBuffer()}); } catch(e){}
  }
}
async function syncOnFile(L, d){
  // só se aceitam ficheiros pedidos por este dispositivo, de Referências que existem, e com tamanho razoável
  if (typeof d.id !== 'string' || !L.asked.has(d.id) || !d.buf) return;
  const buf = d.buf instanceof ArrayBuffer ? d.buf : ArrayBuffer.isView(d.buf) ? d.buf : null;
  const r = syncCur().refs.find(x => x.id === d.id);
  if (!buf || !r || buf.byteLength > FILE_MAX) return;
  L.asked.delete(d.id);
  // o tipo vem da Referência (o mesmo que decide se o ficheiro se pode abrir no browser), nunca da mensagem
  try { await idb.put(d.id, new Blob([buf], {type:r.mime || ''})); } catch(e){ return; }
  const top = openModals[openModals.length - 1]; if (top && top.entity && top.entity.kind === 'ref' && top.entity.id === d.id && top.redraw) top.redraw();
}

/* ---------- conflito e cópia de segurança ---------- */
/* devolve false quando não há espaço para a cópia */
function syncBackup(s, from){ try { localStorage.setItem(LS_BACKUP, JSON.stringify({at:Date.now(), from, pid:myPid(), data:s})); return true; } catch(e){ return false; } }
/* a cópia de segurança só se mostra no projeto a que pertence */
function syncReadBackup(){ let b = null; try { b = JSON.parse(lsGet(LS_BACKUP)); } catch(e){} return b && b.data && (!b.pid || b.pid === myPid()) ? b : null; }
function syncConflict(L, theirs){
  L.unresolved = {sum:theirs.sum || '—', at:theirs.at || 0}; syncUI();
  syncConflictDialog(L);
}
function syncConflictDialog(L){
  if (L.conflict || !L.unresolved) return;
  const pr = L.pr, th = L.unresolved;
  let picked = false;
  const pick = keepMine => { picked = true; const keep = keepMine ? Sync.cfg.id : pr.id; L.chose = keep; if (!L.winner) L.winner = keep;
    L.conn.send({t:'choose', keep}); m.close(); if (keepMine && L.winner === Sync.cfg.id) syncSendFull(L, {forced:true}); };
  const box = (title, sum, at) => h('div', {class:'card static sync-opt'}, h('div', {class:'kicker'}, title), h('div', null, sum), h('div', {class:'muted small'}, _('Última alteração: ') + hhmm(at, true)));
  const body = h('div', {class:'modal-body'},
    h('p', {style:{marginTop:0}}, _('Este dispositivo e «{nome}» foram os dois alterados desde a última sincronização. Qual das versões quer manter nos dois?', {nome:pr.name})),
    h('div', {class:'sync-opts'}, box(_('Neste dispositivo'), projSummary(syncCur()), changedAt()), box(_('Em «{nome}»', {nome:pr.name}), th.sum, th.at)),
    h('p', {class:'muted small'}, _('A versão que não escolher fica guardada como cópia de segurança no dispositivo onde estava, e pode ser reposta lá em Definições do Projeto › Sincronizar dispositivos. Se fechar esta janela sem escolher, a sincronização fica em pausa até escolher.')),
    h('div', {class:'modal-foot'}, h('button', {class:'btn', onclick:() => pick(false)}, _('Manter a de «{nome}»', {nome:pr.name})), h('button', {class:'btn primary', onclick:() => pick(true)}, _('Manter a deste dispositivo'))));
  const m = openModal({title:_('Versões diferentes'), body, onClose:() => { L.conflict = null; if (!picked) syncUI(); }});
  m.keep = true; L.conflict = m;
}
/* o outro dispositivo escolheu; se os dois escolheram ao mesmo tempo, vale a escolha do identificador menor */
function syncOnChoose(L, theirs){
  const winner = L.chose && Sync.cfg.id < L.pr.id ? L.chose : theirs;
  const iSent = L.chose === Sync.cfg.id && L.winner === Sync.cfg.id;
  L.winner = winner; L.unresolved = L.unresolved || {sum:'—', at:0};
  if (L.conflict) L.conflict.close();
  if (winner === Sync.cfg.id && !iSent) syncSendFull(L, {forced:true});
  syncUI();
}
async function syncRestoreBackup(){
  const b = syncReadBackup(); if (!b || projNone()) return;
  const what = b.from === RESTORE ? _('antes da última reposição') : _('antes de ser substituída pela de «{nome}»', {nome:b.from});
  if (!await confirmDialog(`Repor a versão do projeto guardada a ${hhmm(b.at)}, ${what}? A versão atual passa a ser a cópia de segurança, e a reposta segue para os dispositivos ligados.`, {title:_('Repor cópia de segurança'), ok:_('Repor'), keep:true})) return;
  let fresh; try { fresh = sanitize(JSON.parse(JSON.stringify(b.data))); } catch(e){ return toast(_('A cópia de segurança está danificada.')); }
  if (Tour.active) endTour();
  if (!syncBackup(state, RESTORE)) return toast(_('Não há espaço para guardar a versão atual como cópia de segurança. Guarde o projeto num ficheiro e liberte espaço.'));
  state = fresh; applyPalette(); commit(); toast(_('Versão anterior reposta.'));
}

/* ---------- emparelhar ---------- */
function syncAddPair(p){
  Sync.cfg.pairs = Sync.cfg.pairs.filter(x => x.id !== p.id); Sync.cfg.pairs.push({id:p.id, name:p.name, secret:p.secret, lasts:{}, at:0});
  syncSave(); syncUI();
  if (Sync.peer && !Sync.peer.disconnected) syncConnectAll(); else syncStart();
}
function syncForget(id, tell){
  syncDropLink(id, tell);
  Sync.cfg.pairs = Sync.cfg.pairs.filter(x => x.id !== id); syncSave();
  if (!Sync.cfg.pairs.length){ setTimeout(() => { if (!Sync.cfg.pairs.length) syncStop(); }, 400); Sync.status = 'off'; }
  syncUI();
}
/* este dispositivo mostra um código; o outro escreve-o */
async function syncPairShow(){
  if (tourMode) return;
  let Peer; try { Peer = await syncLib(); } catch(e){ return toast(_('Não foi possível preparar o emparelhamento. Confirme que tem internet.')); }
  const code = randCode(), st = h('p', {class:'muted', role:'status'}, _('A preparar o código…'));
  const body = h('div', {class:'modal-body'},
    h('p', {style:{marginTop:0}}, _('No outro dispositivo, abra o Narrative e vá a Definições do Projeto › Sincronizar dispositivos › «Introduzir código». Escreva:')),
    h('div', {class:'pair-code', 'aria-label':_('Código ') + code.split('').join(' ')}, code.slice(0, 3), h('span', null, code.slice(3))), st,
    h('p', {class:'muted small'}, _('O código serve só para esta ligação e deixa de valer ao fechar esta janela (ou ao fim de 10 minutos). Os dois dispositivos precisam de internet.')),
    h('div', {class:'modal-foot'}, h('button', {class:'btn', onclick:() => m.close()}, _('Cancelar'))));
  let done = false, closed = false;
  const pp = new Peer(SYNC_PREFIX + 'pair-' + code, {debug:0});
  const tm = setTimeout(() => m.close(), 10 * 60000);
  const m = openModal({title:_('Ligar um dispositivo'), body, onClose:() => { closed = true; clearTimeout(tm); setTimeout(() => { try { pp.destroy(); } catch(e){} }, 800); }});
  m.keep = true; m.pairCode = code;
  pp.on('open', () => { if (!done) st.textContent = _('À espera do outro dispositivo…'); });
  pp.on('error', err => { if (!done) st.textContent = err && err.type === 'unavailable-id' ? _('Este código já está em uso. Feche e volte a tentar.') : _('Sem ligação ao serviço de sincronização. Confirme que tem internet.'); });
  pp.on('connection', conn => conn.on('data', async d => {
    if (!d) return;
    if (d.t === 'ok' && done && d.id === done.id){ syncAddPair(done); toast(_('«{nome}» ligado. A sincronizar…', {nome:done.name})); setTimeout(() => m.close(), 400); return; }
    if (done || d.t !== 'pair' || !ID_RE.test(d.id || '')) return;
    if (d.id === Sync.cfg.id){ conn.send({t:'self'}); return; } // o código foi escrito neste mesmo dispositivo
    const name = String(d.name || _('Dispositivo')).trim().slice(0, 60) || _('Dispositivo');
    st.textContent = _('«{nome}» quer ligar-se.', {nome:name});
    const ok = await confirmDialog(_('Ligar «{nome}» a este dispositivo? A partir de agora, sempre que a ferramenta estiver aberta nos dois, o projeto passa a ser o mesmo nos dois.', {nome:name}), {title:_('Ligar dispositivo'), ok:_('Ligar'), keep:true});
    if (closed || done){ return; }
    if (!ok){ conn.send({t:'refused'}); setTimeout(() => m.close(), 400); return; }
    // só fica emparelhado quando o outro confirmar que guardou a ligação (assim nunca fica de um lado só)
    done = {id:d.id, name, secret:b64(randBytes(32))};
    st.textContent = _('A concluir a ligação a «{nome}»…', {nome:name});
    conn.send({t:'paired', id:Sync.cfg.id, name:Sync.cfg.name, secret:done.secret});
  }));
}
/* este dispositivo escreve o código mostrado no outro */
async function syncPairEnter(){
  if (tourMode) return;
  const raw = await promptDialog(_('Ligar a outro dispositivo'), _('Código mostrado no outro dispositivo'), '');
  if (!raw) return;
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 6 || [...code].some(ch => !CODE_ABC.includes(ch))) return toast(_('Código inválido: tem 6 letras e algarismos (sem O, 0, I nem 1). Confirme-o no outro dispositivo.'));
  if (openModals.some(x => x.pairCode === code)) return toast(_('Esse código é o que este dispositivo está a mostrar. Escreva-o no outro dispositivo.'));
  let Peer; try { Peer = await syncLib(); } catch(e){ return toast(_('Não foi possível preparar o emparelhamento. Confirme que tem internet.')); }
  const st = h('p', {class:'muted', role:'status'}, _('A ligar…'));
  const body = h('div', {class:'modal-body'}, st, h('div', {class:'modal-foot'}, h('button', {class:'btn', onclick:() => m.close()}, _('Cancelar'))));
  let fin = false;
  const pp = new Peer({debug:0});
  const end = (msg, ok) => { if (fin) return; fin = true; clearTimeout(tm); if (msg) toast(msg); setTimeout(() => m.close(), ok ? 300 : 0); };
  let tm = setTimeout(() => end(_('O outro dispositivo não respondeu. Confirme o código e que ele ainda o está a mostrar.')), 60000);
  const m = openModal({title:_('Ligar a outro dispositivo'), body, onClose:() => { fin = true; clearTimeout(tm); setTimeout(() => { try { pp.destroy(); } catch(e){} }, 800); }});
  m.keep = true;
  pp.on('error', err => end(err && err.type === 'peer-unavailable' ? _('Código não encontrado. Confirme o código e que o outro dispositivo ainda o está a mostrar.') : _('Sem ligação ao serviço de sincronização. Confirme que tem internet.')));
  pp.on('open', () => {
    const conn = pp.connect(SYNC_PREFIX + 'pair-' + code, {serialization:'binary', reliable:true});
    conn.on('open', () => {
      clearTimeout(tm); // a partir daqui espera-se pela pessoa do outro lado, o tempo que for preciso
      st.textContent = _('Confirme a ligação no outro dispositivo.'); conn.send({t:'pair', id:Sync.cfg.id, name:Sync.cfg.name});
    });
    conn.on('data', d => {
      if (!d || fin) return;
      if (d.t === 'refused') return end(_('O outro dispositivo recusou a ligação.'));
      if (d.t === 'self') return end(_('Esse código está a ser mostrado neste mesmo dispositivo (noutra janela). Escreva-o no outro dispositivo.'));
      if (d.t === 'paired' && ID_RE.test(d.id || '') && d.id !== Sync.cfg.id && typeof d.secret === 'string'){
        const name = String(d.name || _('Dispositivo')).trim().slice(0, 60) || _('Dispositivo');
        syncAddPair({id:d.id, name, secret:d.secret}); conn.send({t:'ok', id:Sync.cfg.id});
        end(_('Ligado a «{nome}». A sincronizar…', {nome:name}), true);
      }
    });
  });
}

/* ---------- Definições ---------- */
function syncOtherButton(L){
  const pid = L.other.pid, I = Projects.idx; if (!pid) return null;
  if (I.open.includes(pid) || I.recent.includes(pid)) return h('button', {class:'btn small primary', onclick:() => projAdopt(pid)}, _('Mudar para «{nome}»', {nome:L.other.name}));
  return h('button', {class:'btn small primary', onclick:() => syncWant(L)}, _('Abrir «{nome}» neste dispositivo', {nome:L.other.name}));
}
function syncCard(){
  const c = Sync.cfg, el = h('div', {class:'card static sync-card'}), st = syncState();
  const bk = syncReadBackup();
  add(el, h('h3', null, _('Sincronizar dispositivos')),
    h('p', {class:'muted small'}, _('Ligue o telemóvel ao PC (ou dois dispositivos quaisquer) para terem sempre o mesmo projeto. Funciona com a ferramenta aberta nos dois e com internet; as alterações passam de um para o outro à medida que as faz. Os dados viajam cifrados: o serviço público PeerJS põe os dispositivos em contacto e, quando a rede não permite a ligação direta, retransmite os dados sem os conseguir ler.')),
    field(_('Nome deste dispositivo'), h('input', {class:'inp', value:c.name, maxLength:60, onchange:e => { c.name = e.target.value.trim().slice(0, 60) || defaultDeviceName(); e.target.value = c.name; syncSave();
      for (const L of Sync.links.values()) if (L.authed) L.conn.send({t:'name', name:c.name}); }})),
    c.pairs.length ? h('div', {class:'sync-list'}, c.pairs.map(p => { const L = linkOf(p.id);
      return h('div', {class:'list-row'}, h('span', {class:'sync-dot' + (L ? ' on' : ''), 'aria-hidden':'true'}),
        h('span', {class:'sync-name'}, p.name),
        p.ver && verCmp(p.ver, Upd.cur) !== 0 ? h('span', {class:'muted small sync-ver', title:_('Versões diferentes sincronizam na mesma; a mais antiga atualiza-se sozinha quando procurar atualizações.')}, _('versão {a}', {a:p.ver})) : null, // o outro dispositivo está noutra versão
        h('span', {class:'muted small'}, L && L.other ? (L.other.pid ? _('Ligado, no projeto «{nome}»', {nome:L.other.name}) : _('Ligado, sem nenhum projeto aberto')) : L && L.unresolved ? _('Versões diferentes por resolver') : L ? _('Ligado agora') : p.at ? _('Última ligação: ') + hhmm(p.at) : _('Ainda não sincronizou')),
        L && L.unresolved && !L.conflict ? h('button', {class:'btn small primary', onclick:() => syncConflictDialog(L)}, _('Escolher a versão')) : null,
        L && L.other ? syncOtherButton(L) : null,
        h('button', {class:'btn small', onclick:async () => { if (await confirmDialog(_('Deixar de sincronizar com «{nome}»? O projeto fica como está nos dois dispositivos.', {nome:p.name}), {title:_('Deixar de sincronizar'), ok:_('Deixar de sincronizar'), keep:true})) syncForget(p.id, true); }}, _('Deixar de sincronizar'))); }))
      : null,
    h('p', {class:'small sync-state', role:'status'}, SYNC_TXT[st]),
    h('div', {class:'chips'}, h('button', {class:'btn primary', onclick:syncPairShow}, _('Mostrar código para ligar')), h('button', {class:'btn', onclick:syncPairEnter}, _('Introduzir código'))),
    bk && bk.data ? h('p', {class:'small', style:{marginTop:'12px'}}, h('button', {class:'btn small', onclick:syncRestoreBackup}, _('Repor a cópia de segurança')),
      h('span', {class:'muted'}, ' ' + (bk.from === RESTORE ? _('Versão de {hora}, guardada antes da última reposição.', {hora:hhmm(bk.at)}) : _('Versão de {hora}, guardada antes de ser substituída pela de «{nome}».', {hora:hhmm(bk.at), nome:bk.from})))) : null);
  Sync.cardEl = el;
  return el;
}
/* atualiza o cartão das Definições sem o redesenhar enquanto se escreve nele */
function syncRefreshCard(){
  const el = Sync.cardEl; if (!el || !el.isConnected) return;
  if (el.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
  el.replaceWith(syncCard());
}

/* ---------- arranque ---------- */
function initSync(){
  if (Sync.cfg.isNew) syncSave(); // só se grava a configuração quando é criada (não por cima da de outra janela)
  Sync.sentReset = lsGet(LS_RESET);
  $('#syncBtn').addEventListener('click', () => { setTab('settings'); setTimeout(() => { const c = $('.sync-card'); c && c.scrollIntoView({behavior:'smooth', block:'start'}); }, 30); });
  syncUI();
  if (Sync.cfg.pairs.length) syncStart();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncTick(); });
  window.addEventListener('online', () => syncTick());
  window.addEventListener('offline', () => { if (Sync.peer) syncStatus('offline'); });
}
window.addEventListener('DOMContentLoaded', initSync);
