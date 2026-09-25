const statusElement = document.querySelector('#mode-status')
const buttons = [...document.querySelectorAll('[data-mode]')]

const labels = {
  coding: 'kerja',
  music: 'musik',
  reading: 'baca',
  focus: 'fokus',
}

function render(modeState) {
  const selection = modeState?.selection ?? 'auto'
  const active = modeState?.active ?? null

  statusElement.textContent = selection === 'auto'
    ? `Otomatis · ${labels[active] ?? 'santai'}`
    : `${labels[selection]} aktif`

  for (const button of buttons) {
    button.setAttribute('aria-pressed', String(button.dataset.mode === selection))
    button.dataset.active = String(button.dataset.mode === active)
  }
}

for (const button of buttons) {
  button.addEventListener('click', async () => {
    try {
      render(await window.modePickerAPI.choose(button.dataset.mode))
    }
    catch (error) {
      console.error('Gagal mengganti mode Jinshi:', error)
    }
  })
}

window.modePickerAPI.onUpdate(render)
window.modePickerAPI.get().then(render).catch(error => {
  console.error('Gagal membaca mode Jinshi:', error)
})
