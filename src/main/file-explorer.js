const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const { shell } = require('electron')

const execFileAsync = promisify(execFile)
const collator = new Intl.Collator('id', { numeric: true, sensitivity: 'base' })

function resolveLocation(location, base = os.homedir()) {
  const value = String(location ?? '').trim()

  if (!value || value === '~') return os.homedir()
  if (value.startsWith('~/')) return path.resolve(os.homedir(), value.slice(2))

  return path.resolve(base, value)
}

async function describeEntry(entryPath, name = path.basename(entryPath)) {
  try {
    const stats = await fs.stat(entryPath)

    return { name, path: entryPath, directory: stats.isDirectory() }
  }
  catch {
    // Broken symlinks remain visible, though the OS may refuse to open them.
    return { name, path: entryPath, directory: false }
  }
}

async function listDirectory(location, base) {
  const directory = resolveLocation(location, base)
  const stats = await fs.stat(directory)

  if (!stats.isDirectory()) throw new Error('Lokasi ini bukan folder.')

  const dirents = await fs.readdir(directory, { withFileTypes: true })
  const entries = await Promise.all(dirents.map(entry => {
    const entryPath = path.join(directory, entry.name)
    return entry.isSymbolicLink()
      ? describeEntry(entryPath, entry.name)
      : { name: entry.name, path: entryPath, directory: entry.isDirectory() }
  }))

  entries.sort((a, b) => Number(b.directory) - Number(a.directory) || collator.compare(a.name, b.name))

  return { directory, parent: path.dirname(directory), entries }
}

async function searchFiles(query) {
  const name = String(query ?? '').trim()

  if (!name) return { entries: [], truncated: false }

  // Spotlight searches indexed locations quickly; direct folder browsing above
  // still works in directories that Spotlight does not index.
  const { stdout } = await execFileAsync('mdfind', ['-name', name], {
    timeout: 15_000,
    maxBuffer: 8 * 1024 * 1024,
  })
  const paths = stdout.split('\n').filter(Boolean)

  return {
    entries: await Promise.all(paths.slice(0, 100).map(entryPath => describeEntry(entryPath))),
    truncated: paths.length > 100,
  }
}

async function openFile(location) {
  const file = resolveLocation(location)
  const stats = await fs.stat(file)

  if (stats.isDirectory()) throw new Error('Pilih folder untuk menjelajahinya.')

  const error = await shell.openPath(file)

  if (error) throw new Error(error)

  return { opened: file }
}

module.exports = { listDirectory, openFile, resolveLocation, searchFiles }
