const locationInput = document.querySelector('#location')
const queryInput = document.querySelector('#query')
const searchButton = document.querySelector('#search-button')
const entriesElement = document.querySelector('#entries')
const statusElement = document.querySelector('#status')
const listTitle = document.querySelector('#list-title')
const countElement = document.querySelector('#count')
const parentButton = document.querySelector('#parent')

const icons = {
  folder: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 5.5a2 2 0 0 1 2-2H8l1.8 2H15.5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z" /></svg>',
  file: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2.5h6l4 4v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1zM11 2.5v4h4" /></svg>',
  next: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 6 6-6 6" /></svg>',
  open: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 14 14 6M8 6h6v6" /></svg>',
}

let currentDirectory = ''
let parentDirectory = ''
let displayedEntries = []
let visibleCount = 0
let showingSearch = false
let requestId = 0

function setStatus(message, tone = 'error') {
  statusElement.textContent = message
  statusElement.hidden = !message
  statusElement.dataset.tone = tone
}

function entryButton(entry) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'entry'
  button.dataset.directory = String(entry.directory)
  button.title = entry.path

  const icon = document.createElement('span')
  icon.className = 'entry__icon'
  icon.innerHTML = entry.directory ? icons.folder : icons.file

  const copy = document.createElement('span')
  copy.className = 'entry__copy'
  const name = document.createElement('span')
  name.className = 'entry__name'
  name.textContent = entry.name
  copy.appendChild(name)

  if (showingSearch) {
    const path = document.createElement('span')
    path.className = 'entry__path'
    path.textContent = entry.path
    copy.appendChild(path)
  }

  const arrow = document.createElement('span')
  arrow.className = 'entry__arrow'
  arrow.setAttribute('aria-hidden', 'true')
  arrow.innerHTML = entry.directory ? icons.next : icons.open
  button.append(icon, copy, arrow)
  button.addEventListener('click', () => entry.directory ? browse(entry.path) : openFile(entry.path))
  return button
}

function showNextEntries() {
  const previous = visibleCount
  visibleCount = Math.min(displayedEntries.length, visibleCount + 150)
  const fragment = document.createDocumentFragment()

  for (const entry of displayedEntries.slice(previous, visibleCount)) {
    fragment.appendChild(entryButton(entry))
  }

  entriesElement.querySelector('.load-more')?.remove()
  entriesElement.appendChild(fragment)

  if (visibleCount < displayedEntries.length) {
    const more = document.createElement('button')
    more.type = 'button'
    more.className = 'load-more'
    more.textContent = `Tampilkan lagi (${displayedEntries.length - visibleCount})`
    more.addEventListener('click', showNextEntries)
    entriesElement.appendChild(more)
  }
}

function renderEntries(entries, emptyMessage) {
  displayedEntries = entries
  visibleCount = 0
  entriesElement.replaceChildren()
  countElement.textContent = `${entries.length} item`

  if (entries.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'empty'
    empty.textContent = emptyMessage
    entriesElement.appendChild(empty)
    return
  }

  showNextEntries()
  entriesElement.scrollTop = 0
}

async function browse(location, base = currentDirectory) {
  const id = ++requestId
  searchButton.disabled = false
  setStatus('Membuka folder...', 'info')

  try {
    const result = await window.fileExplorerAPI.list(location, base)
    if (id !== requestId) return
    if (!result?.ok) throw new Error(result?.error ?? 'Folder tidak bisa dibuka.')

    currentDirectory = result.directory
    parentDirectory = result.parent
    locationInput.value = currentDirectory
    parentButton.disabled = currentDirectory === parentDirectory
    showingSearch = false
    listTitle.textContent = location === '~' ? 'Home' : currentDirectory.split('/').filter(Boolean).pop() || 'Root /'
    for (const [id, target] of Object.entries({ home: '~', documents: '~/Documents', downloads: '~/Downloads', root: '/' })) {
      document.querySelector(`#${id}`).dataset.active = String(location === target)
    }
    queryInput.value = ''
    renderEntries(result.entries, 'Folder ini kosong.')
    setStatus('')
  }
  catch (error) {
    if (id !== requestId) return
    locationInput.value = currentDirectory || locationInput.value
    setStatus(`Folder tidak bisa dibuka: ${String(error?.message ?? error)}`)
  }
}

async function search(query) {
  const id = ++requestId
  searchButton.disabled = true
  setStatus('Mencari nama file...', 'info')

  try {
    const result = await window.fileExplorerAPI.search(query)
    if (id !== requestId) return
    if (!result?.ok) throw new Error(result?.error ?? 'Pencarian gagal.')

    showingSearch = true
    listTitle.textContent = `Hasil: ${query}`
    renderEntries(result.entries, 'Belum ada file yang cocok. Coba nama lain atau jelajahi foldernya.')
    setStatus(result.truncated ? 'Menampilkan 100 hasil pertama. Perjelas nama untuk hasil lain.' : '', 'info')
  }
  catch (error) {
    if (id === requestId) setStatus(`Pencarian gagal: ${String(error?.message ?? error)}`)
  }
  finally {
    if (id === requestId) searchButton.disabled = false
  }
}

async function openFile(location) {
  setStatus('Membuka file...', 'info')

  try {
    const result = await window.fileExplorerAPI.open(location)
    if (!result?.ok) throw new Error(result?.error ?? 'File tidak bisa dibuka.')
    setStatus('File dibuka.', 'info')
  }
  catch (error) {
    setStatus(`File tidak bisa dibuka: ${String(error?.message ?? error)}`)
  }
}

document.querySelector('#location-form').addEventListener('submit', event => {
  event.preventDefault()
  browse(locationInput.value)
})

document.querySelector('#search-form').addEventListener('submit', event => {
  event.preventDefault()
  const query = queryInput.value.trim()
  if (query) search(query)
  else browse(currentDirectory)
})

document.querySelector('#home').addEventListener('click', () => browse('~'))
document.querySelector('#documents').addEventListener('click', () => browse('~/Documents'))
document.querySelector('#downloads').addEventListener('click', () => browse('~/Downloads'))
document.querySelector('#root').addEventListener('click', () => browse('/'))
parentButton.addEventListener('click', () => browse(parentDirectory))
document.querySelector('#close').addEventListener('click', () => window.fileExplorerAPI.close())
window.addEventListener('keydown', event => {
  if (event.key === 'Escape') window.fileExplorerAPI.close()
})

browse('~')
queryInput.focus()
