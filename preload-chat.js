const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('chatAPI', {
  ask: message => ipcRenderer.invoke('ai:ask', message),
  history: () => ipcRenderer.invoke('ai:history'),
  clear: () => ipcRenderer.invoke('ai:clear'),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: patch => ipcRenderer.invoke('settings:update', patch),
  setApiKey: (provider, key) => ipcRenderer.invoke(
    'settings:set-key',
    { provider, key },
  ),
})
