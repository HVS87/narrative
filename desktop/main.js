'use strict';
/* Narrative para computador (Windows, macOS e Linux).
   A janela abre a ferramenta publicada no site: assim recebe as atualizações automaticamente (o mecanismo de atualização
   da própria ferramenta trata disso) e funciona sem internet a partir da cópia guardada pelo service worker.
   Os projetos ficam gravados neste computador, nos dados da aplicação. */
const { app, BrowserWindow, shell, dialog, session, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_URL = process.env.NARRATIVA_URL || 'https://hvs87.github.io/narrative/';
const ORIGIN = new URL(APP_URL).origin;
const BASE = new URL(APP_URL).href;
const STATE_FILE = () => path.join(app.getPath('userData'), 'janela.json');
/* para testes automáticos: uma pasta de dados descartável, que não toca nos projetos reais.
   Fora disso, se já existir a pasta de dados da «Ferramenta Narrativa» (o nome antigo), continua a ser essa: quem já usava a aplicação mantém os projetos. */
if (process.env.NARRATIVA_USERDATA) app.setPath('userData', process.env.NARRATIVA_USERDATA);
else { const old = path.join(app.getPath('appData'), 'Ferramenta Narrativa'); if (fs.existsSync(old)) app.setPath('userData', old); }

/* os poucos textos do próprio programa, na língua do sistema */
const T = {
  pt:{quit:'Sair sem guardar', cancel:'Cancelar', msg:'Há projetos com alterações que não foram guardadas em ficheiro.', detail:'O trabalho continua gravado neste computador e volta a aparecer quando abrir a aplicação; só o ficheiro guardado (com «Guardar Projeto») não terá estas alterações.'},
  en:{quit:'Quit without saving', cancel:'Cancel', msg:'Some projects have changes that were not saved to a file.', detail:'Your work stays stored on this computer and will be there when you open the app again; only the saved file (from “Save Project”) will not have these changes.'},
  es:{quit:'Salir sin guardar', cancel:'Cancelar', msg:'Hay proyectos con cambios que no se han guardado en un archivo.', detail:'El trabajo sigue grabado en este ordenador y volverá a aparecer al abrir la aplicación; solo el archivo guardado (con «Guardar proyecto») no tendrá estos cambios.'},
  fr:{quit:'Quitter sans enregistrer', cancel:'Annuler', msg:'Des projets contiennent des modifications non enregistrées dans un fichier.', detail:'Votre travail reste enregistré sur cet ordinateur et sera là à la prochaine ouverture ; seul le fichier enregistré (avec « Enregistrer le projet ») n’aura pas ces modifications.'} };
const tr = () => T[String(app.getLocale() || '').slice(0, 2)] || T.en;

/* só uma instância: abrir outra vez traz a janela existente para a frente */
if (!app.requestSingleInstanceLock()){ app.quit(); }
app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w){ if (w.isMinimized()) w.restore(); w.focus(); } });

ipcMain.on('narrativa-desktop-version', e => { e.returnValue = app.getVersion(); });

/* ---------- atualizar o próprio programa (a «moldura» que abre a ferramenta) ----------
   A ferramenta em si atualiza-se pelo site, em todos os formatos. O programa também se atualiza sozinho onde isso é possível
   sem voltar a instalar: o instalador do Windows e o AppImage do Linux. Descarrega a versão nova da release do GitHub (a mesma
   página de onde foi instalado) e instala-a ao fechar, na mesma pasta: os projetos, as preferências e a sincronização ficam
   nos dados da aplicação, que não são tocados. A versão portátil do Windows, o macOS (sem assinatura da Apple) e o .tar.gz
   não se podem substituir a si próprios: aí continua a valer só a atualização da ferramenta pelo site.
   Quem decide quando procurar é a ferramenta (a opção «Procurar sempre atualizações ao iniciar» e o botão das Definições). */
let updater = null;
const shellCan = () => !!updater && app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR && !process.env.NARRATIVA_NO_SHELL_UPDATE
  && (process.platform === 'win32' || (process.platform === 'linux' && !!process.env.APPIMAGE));
const Shell = { state:shellCan() ? 'idle' : 'unsupported', version:null, error:null };
function shellSend(){ for (const w of BrowserWindow.getAllWindows()) try { w.webContents.send('narrativa-shell-update', {...Shell}); } catch(e){} }
function shellSet(o){ Object.assign(Shell, o); shellSend(); }
function shellInit(){
  try { ({ autoUpdater:updater } = require('electron-updater')); } catch(e){ updater = null; }
  Shell.state = shellCan() ? 'idle' : 'unsupported'; if (!shellCan()) return;
  updater.autoDownload = true; updater.autoInstallOnAppQuit = true; updater.allowDowngrade = false; updater.logger = null;
  updater.on('checking-for-update', () => shellSet({state:'checking', error:null}));
  updater.on('update-not-available', () => shellSet({state:'current'}));
  updater.on('update-available', i => shellSet({state:'downloading', version:i && i.version}));
  updater.on('update-downloaded', i => shellSet({state:'ready', version:i && i.version}));
  updater.on('error', e => shellSet({state:'error', error:String(e && e.message || e).slice(0, 200)}));
}
ipcMain.handle('narrativa-shell-check', async () => {
  if (!shellCan()) return {...Shell};
  if (Shell.state === 'checking' || Shell.state === 'downloading' || Shell.state === 'ready') return {...Shell};
  try { await updater.checkForUpdates(); } catch(e){ shellSet({state:'error', error:String(e && e.message || e).slice(0, 200)}); }
  return {...Shell};
});
ipcMain.handle('narrativa-shell-state', () => ({...Shell}));
// «Reiniciar e atualizar»: fecha (a ferramenta já gravou tudo e pergunta se houver algo por guardar em ficheiro) e instala
ipcMain.handle('narrativa-shell-install', () => { if (Shell.state !== 'ready') return false; setImmediate(() => { try { session.defaultSession.flushStorageData(); } catch(e){} updater.quitAndInstall(true, true); }); return true; });

const inApp = url => { try { const u = new URL(url); return u.origin === ORIGIN && u.href.startsWith(BASE); } catch(e){ return false; } };

function readState(){ try { return JSON.parse(fs.readFileSync(STATE_FILE(), 'utf8')); } catch(e){ return null; } }
function saveState(w){ try { if (!w.isDestroyed()) fs.writeFileSync(STATE_FILE(), JSON.stringify({bounds:w.getNormalBounds(), max:w.isMaximized()})); } catch(e){} }

function wire(w, main){
  // ligações para fora da ferramenta abrem no browser; a segunda janela da própria ferramenta (dois ecrãs) abre aqui
  w.webContents.setWindowOpenHandler(({url}) => {
    if (inApp(url)) return {action:'allow', overrideBrowserWindowOptions:{autoHideMenuBar:true, backgroundColor:'#161b2a', icon:path.join(__dirname, 'icon.png'),
      webPreferences:{preload:path.join(__dirname, 'preload.js'), contextIsolation:true, sandbox:true}}};
    if (/^https?:|^mailto:/i.test(url)) shell.openExternal(url);
    return {action:'deny'};
  });
  w.webContents.on('will-navigate', (e, url) => { if (!inApp(url) && !url.startsWith('file:')){ e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); } });
  // a ferramenta pergunta antes de sair quando há projetos por guardar em ficheiro: aqui a pergunta é uma janela do Windows
  w.webContents.on('will-prevent-unload', e => {
    const r = dialog.showMessageBoxSync(w, {type:'question', buttons:[tr().quit, tr().cancel], defaultId:1, cancelId:1, noLink:true,
      title:'Narrative', message:tr().msg, detail:tr().detail});
    if (r === 0) e.preventDefault(); // continuar a fechar
  });
  // sem ligação e sem cópia guardada (primeira abertura sem internet): página de aviso
  if (main) w.webContents.on('did-fail-load', (e, code, desc, url, isMain) => {
    if (isMain && code !== -3) w.loadFile(path.join(__dirname, 'offline.html'));
  });
}

function createWindow(){
  const st = readState();
  const w = new BrowserWindow({
    width:1400, height:900, minWidth:360, minHeight:480, show:false,
    title:'Narrative', icon:path.join(__dirname, 'icon.png'), backgroundColor:'#161b2a', autoHideMenuBar:true,
    ...(st && st.bounds ? st.bounds : {}),
    webPreferences:{preload:path.join(__dirname, 'preload.js'), contextIsolation:true, sandbox:true, spellcheck:true}
  });
  if (st && st.max) w.maximize();
  w.once('ready-to-show', () => w.show());
  ['resize', 'move', 'close'].forEach(ev => w.on(ev, () => saveState(w)));
  wire(w, true);
  w.loadURL(APP_URL);
  return w;
}

app.whenReady().then(() => {
  shellInit();
  // no macOS, o menu da aplicação é o que dá Copiar, Colar, Anular e Sair (⌘C, ⌘V, ⌘Z, ⌘Q); no Windows e no Linux não há menu
  Menu.setApplicationMenu(process.platform === 'darwin' ? Menu.buildFromTemplate([{role:'appMenu'}, {role:'editMenu'}, {role:'windowMenu'}]) : null);
  try { const av = session.defaultSession.availableSpellCheckerLanguages || []; const want = [app.getLocale(), 'pt-PT', 'en-US', 'es-ES', 'fr-FR'].filter((l, i, a) => av.includes(l) && a.indexOf(l) === i); if (want.length) session.defaultSession.setSpellCheckerLanguages(want); } catch(e){}
  // só se pedem as permissões de que a ferramenta precisa (nenhuma de câmara, microfone ou localização)
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(['clipboard-sanitized-write', 'fullscreen', 'window-management', 'fileSystem'].includes(perm)));
  app.on('browser-window-created', (e, w) => { if (BrowserWindow.getAllWindows().length > 1) wire(w, false); });
  // o Chromium grava o armazenamento local em disco com algum atraso: força-se a gravação com frequência,
  // ao perder o foco e ao sair, para que um fecho forçado ou uma falha de energia não percam os últimos segundos
  const flush = () => { try { session.defaultSession.flushStorageData(); } catch(e){} };
  setInterval(flush, 5000);
  app.on('browser-window-blur', flush);
  app.on('before-quit', flush);
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
