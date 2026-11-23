'use strict';
/* Diz à ferramenta que está a correr como aplicação para PC (e em que versão), sem lhe dar mais nenhum acesso ao sistema. */
const { contextBridge, ipcRenderer } = require('electron');
let version = '';
try { version = ipcRenderer.sendSync('narrativa-desktop-version'); } catch(e){}
contextBridge.exposeInMainWorld('narrativaDesktop', { version, platform: process.platform });
