'use strict';
/* Diz à ferramenta que está a correr como aplicação para PC (e em que versão) e deixa-a pedir a atualização do próprio programa,
   sem lhe dar mais nenhum acesso ao sistema. */
const { contextBridge, ipcRenderer } = require('electron');
let version = '';
try { version = ipcRenderer.sendSync('narrativa-desktop-version'); } catch(e){}
/* atualizar o próprio programa: a ferramenta pede para procurar, recebe o estado e escolhe quando instalar */
const shell = {
  check:() => ipcRenderer.invoke('narrativa-shell-check'),
  state:() => ipcRenderer.invoke('narrativa-shell-state'),
  install:() => ipcRenderer.invoke('narrativa-shell-install'),
  on:fn => { if (typeof fn === 'function') ipcRenderer.on('narrativa-shell-update', (e, st) => fn(st)); } };
contextBridge.exposeInMainWorld('narrativaDesktop', { version, platform: process.platform, shell });
