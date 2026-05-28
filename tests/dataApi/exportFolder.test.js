const exportFolder = require('browser/main/lib/dataApi/exportFolder')
const createNote = require('browser/main/lib/dataApi/createNote')

global.document = require('jsdom').jsdom('<body></body>')
global.window = document.defaultView
Object.defineProperty(global, 'navigator', {
  get: () => window.navigator,
  configurable: true
})

const Storage = require('dom-storage')
const localStorage = (window.localStorage = global.localStorage = new Storage(
  null,
  { strict: true }
))
const path = require('path')
const TestDummy = require('../fixtures/TestDummy')
const os = require('os')
const faker = require('faker')
const fs = require('fs')
const sander = require('sander')

const storagePath = path.join(os.tmpdir(), 'test/export-note')

const context = {}

beforeEach(() => {
  context.storage = TestDummy.dummyStorage(storagePath)
  localStorage.setItem('storages', JSON.stringify([context.storage.cache]))
})

test('Export a folder', () => {
  const storageKey = context.storage.cache.key
  const folderKey = context.storage.json.folders[0].key

  const input1 = {
    type: 'MARKDOWN_NOTE',
    description: '*Some* markdown text',
    tags: faker.lorem.words().split(' '),
    folder: folderKey
  }
  input1.title = 'input1'

  const input2 = {
    type: 'SNIPPET_NOTE',
    description: 'Some normal text',
    snippets: [
      {
        name: faker.system.fileName(),
        mode: 'text',
        content: faker.lorem.lines()
      }
    ],
    tags: faker.lorem.words().split(' '),
    folder: folderKey
  }
  input2.title = 'input2'

  const config = {
    export: {
      metadata: 'DONT_EXPORT',
      variable: 'boostnote',
      prefixAttachmentFolder: false
    }
  }

  return createNote(storageKey, input1)
    .then(function() {
      return createNote(storageKey, input2)
    })
    .then(function() {
      return exportFolder(storageKey, folderKey, 'md', storagePath, config)
    })
    .then(function assert() {
      let filePath = path.join(storagePath, 'input1.md')
      expect(fs.existsSync(filePath)).toBe(true)
      filePath = path.join(storagePath, 'input2.md')
      expect(fs.existsSync(filePath)).toBe(false)
    })
})

afterAll(() => {
  localStorage.clear()
  sander.rimrafSync(storagePath)
})
