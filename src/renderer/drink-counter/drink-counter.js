const countElement = document.querySelector('#drink-count')
const minusButton = document.querySelector('#drink-minus')
const plusButton = document.querySelector('#drink-plus')
const bottleElement = document.querySelector('.bottle')

function render(state) {
  const count = state?.drinksToday ?? 0

  countElement.textContent = count
  minusButton.disabled = count === 0
  bottleElement.style.setProperty('--fill', String(Math.min(count, 8) / 8))
}

async function adjust(delta) {
  try {
    render(await window.drinkCounterAPI.adjust(delta))
  }
  catch (error) {
    console.error('Gagal mencatat minum:', error)
  }
}

minusButton.addEventListener('click', () => adjust(-1))
plusButton.addEventListener('click', () => adjust(1))

window.drinkCounterAPI.onUpdate(render)
window.drinkCounterAPI.get().then(render).catch(error => {
  console.error('Gagal memuat catatan minum:', error)
})
