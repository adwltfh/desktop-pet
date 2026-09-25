const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('calendarEventAPI', {
  listCalendars: () => ipcRenderer.invoke('quick-action:list-calendars'),
  create: payload => ipcRenderer.invoke('quick-action:create-calendar-event', payload),
  close: () => ipcRenderer.send('quick-action:close'),
})
