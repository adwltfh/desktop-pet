const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { listDirectory, resolveLocation } = require('../src/main/file-explorer')

test('menjelajah folder biasa, tersembunyi, dan symlink dari lokasi mana pun', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pet-explorer-'))

  try {
    await fs.mkdir(path.join(root, 'folder'))
    await fs.writeFile(path.join(root, '.tersembunyi'), '')
    await fs.writeFile(path.join(root, 'catatan.txt'), '')
    await fs.symlink(path.join(root, 'folder'), path.join(root, 'pintasan'))

    const listing = await listDirectory(root)
    assert.equal(listing.directory, root)
    assert.equal(listing.parent, path.dirname(root))
    assert.deepEqual(listing.entries.map(entry => [entry.name, entry.directory]), [
      ['folder', true],
      ['pintasan', true],
      ['.tersembunyi', false],
      ['catatan.txt', false],
    ])

    const nested = await listDirectory('folder', root)
    assert.equal(nested.directory, path.join(root, 'folder'))
    assert.deepEqual(nested.entries, [])
    assert.equal(resolveLocation('~/Documents'), path.join(os.homedir(), 'Documents'))
  }
  finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test('lokasi file ditolak sebagai folder', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pet-explorer-'))

  try {
    const file = path.join(root, 'file.txt')
    await fs.writeFile(file, '')
    await assert.rejects(listDirectory(file), /bukan folder/)
  }
  finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
