const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('petAPI', {
  setIgnoreMouse: ignore => ipcRenderer.send('pet:set-ignore-mouse', ignore),
  moveBy: (dx, dy) => ipcRenderer.send('pet:move-by', { dx, dy }),
  setPosition: (x, y) => ipcRenderer.send('pet:set-position', { x, y }),
  getBounds: () => ipcRenderer.invoke('pet:get-bounds'),

  // Selisih kursor terhadap mata pet, dipakai pandangan yang mengikuti mouse
  getCursor: () => ipcRenderer.invoke('pet:get-cursor'),
  raise: () => ipcRenderer.send('pet:raise'),

  openChat: () => ipcRenderer.send('pet:open-chat'),
  showMenu: () => ipcRenderer.send('pet:menu'),

  // Daftar animasi tinggal di renderer pet; jendela penguji memintanya
  // lewat main process.
  reportAnimations: list => ipcRenderer.send('pet:animations', list),

  getSettings: () => ipcRenderer.invoke('settings:get'),

  // Mode aktivitas (reading / music / coding / focus) disimpan di main
  // process supaya menu klik-kanan dan pet melihat nilai yang sama.
  getModes: () => ipcRenderer.invoke('pet:get-modes'),

  onSay: handler => {
    ipcRenderer.on('pet:say', (_event, payload) => handler(payload))
  },

  onThinking: handler => {
    ipcRenderer.on('pet:thinking', (_event, value) => handler(value))
  },

  onCommand: handler => {
    ipcRenderer.on('pet:command', (_event, payload) => handler(payload))
  },

  onSettings: handler => {
    ipcRenderer.on('pet:settings', (_event, payload) => handler(payload))
  },

  onModes: handler => {
    ipcRenderer.on('pet:modes', (_event, payload) => handler(payload))
  },
})
