const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('testerAPI', {
  // Daftar animasi dibaca dari renderer pet lewat main process, jadi jendela
  // ini tidak perlu menyalin isi animation.js.
  list: () => ipcRenderer.invoke('pet:animation-list'),

  play: (name, withDialogue) => ipcRenderer.send(
    'pet:test-command',
    { action: 'play', name, withDialogue },
  ),

  setFacing: facing => ipcRenderer.send(
    'pet:test-command',
    { action: 'facing', facing },
  ),

  random: () => ipcRenderer.send('pet:test-command', { action: 'random' }),
  resume: () => ipcRenderer.send('pet:test-command', { action: 'resume' }),
})
