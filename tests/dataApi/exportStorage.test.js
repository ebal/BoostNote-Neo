const exportStorage = require('browser/main/lib/dataApi/exportStorage')

const path = require('path')
const TestDummy = require('../fixtures/TestDummy')
const os = require('os')
const fs = require('fs')
const sander = require('sander')

const context = {}

beforeEach(() => {
  context.storageDir = path.join(os.tmpdir(), 'test/export-storage')
  context.storage = TestDummy.dummyStorage(context.storageDir)
  context.exportDir = path.join(os.tmpdir(), 'test/export-storage-output')
  try {
    fs.mkdirSync(context.exportDir)
  } catch (e) {}
  localStorage.setItem('storages', JSON.stringify([context.storage.cache]))
})

test('Export a storage', () => {
  const storageKey = context.storage.cache.key
  const folders = context.storage.json.folders
  const notes = context.storage.notes
  const exportDir = context.exportDir
  const folderKeyToName = folders.reduce((acc, folder) => {
    acc[folder.key] = folder.name
    return acc
  }, {})

  const config = {
    export: {
      metadata: 'DONT_EXPORT',
      variable: 'boostnote',
      prefixAttachmentFolder: false
    }
  }

  return exportStorage(storageKey, 'md', exportDir, config).then(() => {
    notes.forEach(note => {
      const noteDir = path.join(
        exportDir,
        folderKeyToName[note.folder],
        `${note.title}.md`
      )
      if (note.type === 'MARKDOWN_NOTE') {
        expect(fs.existsSync(noteDir)).toBe(true)
        expect(fs.readFileSync(noteDir, 'utf8')).toBe(note.content)
      } else if (note.type === 'SNIPPET_NOTE') {
        expect(fs.existsSync(noteDir)).toBe(false)
      }
    })
  })
})

afterEach(() => {
  localStorage.clear()
  sander.rimrafSync(context.storageDir)
  sander.rimrafSync(context.exportDir)
})
