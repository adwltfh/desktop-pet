const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pomodoroAPI', {
  get: () => ipcRenderer.invoke('pomodoro:get'),
  command: (action, minutes) => ipcRenderer.invoke('pomodoro:command', action, minutes),
  onUpdate: handler => {
    ipcRenderer.on('pomodoro:update', (_event, timer) => handler(timer))
  },
})
