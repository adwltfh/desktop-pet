const patCountElement = document.querySelector('#pat-count')
const badgeElement = document.querySelector('#badge')

function render(affection) {
  patCountElement.textContent = affection?.patsToday ?? 0
}

window.patCounterAPI.onUpdate(render)

window.patCounterAPI.onKick(() => {
  badgeElement.classList.remove('is-kicked')
  // Reaksi tetap terulang kalau dua tendangan datang berdekatan.
  void badgeElement.offsetWidth
  badgeElement.classList.add('is-kicked')
})

window.patCounterAPI.getAffection().then(render)
