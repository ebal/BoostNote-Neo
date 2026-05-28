const reorderFolder = require('browser/main/lib/dataApi/reorderFolder')

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
const _ = require('lodash')
const TestDummy = require('../fixtures/TestDummy')
const sander = require('sander')
const os = require('os')
const CSON = require('@rokt33r/season')

const storagePath = path.join(os.tmpdir(), 'test/reorder-folder')

const context = {}

beforeEach(() => {
  context.storage = TestDummy.dummyStorage(storagePath)
  localStorage.setItem('storages', JSON.stringify([context.storage.cache]))
})

test('Reorder a folder', () => {
  const firstFolderKey = context.storage.json.folders[0].key
  const secondFolderKey = context.storage.json.folders[1].key
  const storageKey = context.storage.cache.key

  return Promise.resolve()
    .then(function doTest() {
      return reorderFolder(storageKey, 0, 1)
    })
    .then(function assert(data) {
      expect(_.nth(data.storage.folders, 0).key).toBe(secondFolderKey)
      expect(_.nth(data.storage.folders, 1).key).toBe(firstFolderKey)

      const jsonData = CSON.readFileSync(
        path.join(data.storage.path, 'boostnote.json')
      )

      expect(_.nth(jsonData.folders, 0).key).toBe(secondFolderKey)
      expect(_.nth(jsonData.folders, 1).key).toBe(firstFolderKey)
    })
})

afterAll(() => {
  localStorage.clear()
  sander.rimrafSync(storagePath)
})
