const moveNote = require('browser/main/lib/dataApi/moveNote')

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
const sander = require('sander')
const os = require('os')
const CSON = require('@rokt33r/season')

const storagePath = path.join(os.tmpdir(), 'test/move-note')
const storagePath2 = path.join(os.tmpdir(), 'test/move-note2')

const context = {}

beforeEach(() => {
  context.storage1 = TestDummy.dummyStorage(storagePath)
  context.storage2 = TestDummy.dummyStorage(storagePath2)
  localStorage.setItem(
    'storages',
    JSON.stringify([context.storage1.cache, context.storage2.cache])
  )
})

test('Move a note', () => {
  const storageKey1 = context.storage1.cache.key
  const folderKey1 = context.storage1.json.folders[0].key
  const note1 = context.storage1.notes[0]
  const note2 = context.storage1.notes[1]
  const storageKey2 = context.storage2.cache.key
  const folderKey2 = context.storage2.json.folders[0].key

  return Promise.resolve()
    .then(function doTest() {
      return Promise.all([
        moveNote(storageKey1, note1.key, storageKey1, folderKey1),
        moveNote(storageKey1, note2.key, storageKey2, folderKey2)
      ])
    })
    .then(function assert(data) {
      const data1 = data[0]
      const data2 = data[1]

      const jsonData1 = CSON.readFileSync(
        path.join(storagePath, 'notes', data1.key + '.cson')
      )

      expect(jsonData1.folder).toBe(folderKey1)
      expect(jsonData1.title).toBe(note1.title)

      const jsonData2 = CSON.readFileSync(
        path.join(storagePath2, 'notes', data2.key + '.cson')
      )
      expect(jsonData2.folder).toBe(folderKey2)
      expect(jsonData2.title).toBe(note2.title)
      try {
        CSON.readFileSync(path.join(storagePath, 'notes', note2.key + '.cson'))
        throw new Error('The old note should be deleted.')
      } catch (err) {
        expect(err.code).toBe('ENOENT')
      }
    })
})

afterAll(() => {
  localStorage.clear()
  sander.rimrafSync(storagePath)
  sander.rimrafSync(storagePath2)
})
