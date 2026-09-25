const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('chatAPI', {
  ask: (message, mode, attachmentPath) => ipcRenderer.invoke(
    'ai:ask',
    { message, mode, attachmentPath },
  ),
  history: () => ipcRenderer.invoke('ai:history'),
  clear: () => ipcRenderer.invoke('ai:clear'),
  usage: () => ipcRenderer.invoke('ai:usage'),
  pickAttachment: () => ipcRenderer.invoke('composer:pick-attachment'),
  saveClipboardImage: (buffer, mimeType) => ipcRenderer.invoke('composer:save-clipboard-image', buffer, mimeType),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  getAffection: () => ipcRenderer.invoke('affection:get'),
  getMemoryLog: () => ipcRenderer.invoke('memory-log:list'),
  undoMemoryEntry: id => ipcRenderer.invoke('memory-log:undo', id),
  updateSettings: patch => ipcRenderer.invoke('settings:update', patch),
  setApiKey: (provider, key) => ipcRenderer.invoke(
    'settings:set-key',
    { provider, key },
  ),
})
