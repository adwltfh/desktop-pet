const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('modePickerAPI', {
  get: () => ipcRenderer.invoke('modes:get'),
  choose: name => ipcRenderer.invoke('modes:choose', name),
  onUpdate: handler => {
    ipcRenderer.on('mode-picker:update', (_event, modeState) => handler(modeState))
  },
})
