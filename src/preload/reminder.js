const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('reminderAPI', {
  listLists: () => ipcRenderer.invoke('quick-action:list-reminder-lists'),
  create: payload => ipcRenderer.invoke('quick-action:create-reminder', payload),
  close: () => ipcRenderer.send('quick-action:close'),
})
