const { app, Menu } = require('electron')

const { petModes } = require('./state')
const {
  keepOnTop,
  sendToPet,
  createChatWindow,
  createTesterWindow,
  getPetWindow,
} = require('./windows')

// Dipakai submenu Mode (sedang dikomentari di showPetMenu)
function toggleMode(name) {
  if (!(name in petModes)) {
    return
  }

  petModes[name] = !petModes[name]

  sendToPet('pet:modes', { ...petModes })
}

function showPetMenu() {
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

    // { type: 'separator' },

    // SEMENTARA DIMATIKAN untuk uji coba. Hapus komentarnya untuk
    // mengembalikan submenu Mode.
    // {
    //   label: 'Mode',
    //   submenu: [
    //     {
    //       label: 'Baca',
    //       type: 'checkbox',
    //       checked: petModes.reading,
    //       click: () => toggleMode('reading'),
    //     },
    //
    //     {
    //       label: 'Musik',
    //       type: 'checkbox',
    //       checked: petModes.music,
    //       click: () => toggleMode('music'),
    //     },
    //
    //     {
    //       label: 'Ngoding',
    //       type: 'checkbox',
    //       checked: petModes.coding,
    //       click: () => toggleMode('coding'),
    //     },
    //
    //     {
    //       label: 'Fokus',
    //       type: 'checkbox',
    //       checked: petModes.focus,
    //       click: () => toggleMode('focus'),
    //     },
    //   ],
    // },

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
