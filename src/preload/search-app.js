const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('fileExplorerAPI', {
  list: (location, base) => ipcRenderer.invoke('file-explorer:list', location, base),
  search: query => ipcRenderer.invoke('file-explorer:search', query),
  open: location => ipcRenderer.invoke('file-explorer:open', location),
  close: () => ipcRenderer.send('quick-action:close'),
})
