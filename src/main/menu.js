const { app, Menu } = require('electron')

const affection = require('./affection')
const state = require('./state')
const {
  keepOnTop,
  sendToPet,
  broadcastModeState,
  createChatWindow,
  createTesterWindow,
  getPetWindow,
} = require('./windows')

function toggleMode(name) {
  if (state.getModeState().selection === name) {
    return
  }

  if (!state.selectMode(name)) {
    return
  }

  broadcastModeState()
}

function showPetMenu() {
  const selectedMode = state.getModeState().selection
  const menu = Menu.buildFromTemplate([
    {
      label: 'Ngobrol...',
      click: () => createChatWindow(),
    },

    { type: 'separator' },

    {
      label: 'Suruh tidur',
      click: () => sendToPet('pet:command', { action: 'sleep' }),
    },

    {
      label: 'Bangunkan',
      click: () => sendToPet('pet:command', { action: 'wake' }),
    },

    {
      label: 'Animasi acak',
      click: () => sendToPet('pet:command', { action: 'random' }),
    },

    // Uji manual reaksi ngambek tanpa perlu menunggu satu hari penuh kelewat
    // tanpa dipat. Tidak memotong like sungguhan -- cuma menampilkan reaksi
    // dengan angka like yang berlaku sekarang.
    {
      label: 'Uji ngambek',
      click: () => sendToPet('pet:command', {
        action: 'sulk',
        likes: affection.getAffection().likes,
      }),
    },

    { type: 'separator' },

    {
      label: 'Mode',
      submenu: [
        {
          label: 'Auto',
          type: 'radio',
          checked: selectedMode === 'auto',
          click: () => toggleMode('auto'),
        },

        {
          label: 'Baca',
          type: 'radio',
          checked: selectedMode === 'reading',
          click: () => toggleMode('reading'),
        },

        {
          label: 'Musik',
          type: 'radio',
          checked: selectedMode === 'music',
          click: () => toggleMode('music'),
        },

        {
          label: 'Kerja / ngoding',
          type: 'radio',
          checked: selectedMode === 'coding',
          click: () => toggleMode('coding'),
        },

        {
          label: 'Fokus',
          type: 'radio',
          checked: selectedMode === 'focus',
          click: () => toggleMode('focus'),
        },
      ],
    },

    {
      label: 'Uji animasi...',
      click: () => createTesterWindow(),
    },

    { type: 'separator' },

    {
      label: 'Keluar',
      click: () => app.quit(),
    },
  ])

  menu.popup({ window: getPetWindow(), callback: () => keepOnTop(true) })
}

module.exports = {
  showPetMenu,
  toggleMode,
}
