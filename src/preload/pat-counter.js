const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('patCounterAPI', {
  getAffection: () => ipcRenderer.invoke('affection:get'),

  onUpdate: handler => {
    ipcRenderer.on('pat-counter:update', (_event, payload) => handler(payload))
  },

  onKick: handler => {
    ipcRenderer.on('pat-counter:kick', handler)
  },
})
