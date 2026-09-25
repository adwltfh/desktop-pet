const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('drinkCounterAPI', {
  get: () => ipcRenderer.invoke('drinks:get'),
  adjust: delta => ipcRenderer.invoke('drinks:adjust', delta),

  onUpdate: handler => {
    ipcRenderer.on('drink-counter:update', (_event, state) => handler(state))
  },
})
