const updateFolder = require('browser/main/lib/dataApi/updateFolder')

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

const storagePath = path.join(os.tmpdir(), 'test/update-folder')

const context = {}

beforeEach(() => {
  context.storage = TestDummy.dummyStorage(storagePath)
  localStorage.setItem('storages', JSON.stringify([context.storage.cache]))
})

test('Update a folder', () => {
  const storageKey = context.storage.cache.key
  const folderKey = context.storage.json.folders[0].key
  const input = {
    name: 'changed',
    color: '#FF0000'
  }
  return Promise.resolve()
    .then(function doTest() {
      return updateFolder(storageKey, folderKey, input)
    })
    .then(function assert(data) {
      expect(_.find(data.storage.folders, input)).not.toBeNull()
      const jsonData = CSON.readFileSync(
        path.join(data.storage.path, 'boostnote.json')
      )
      expect(_.find(jsonData.folders, input)).not.toBeNull()
    })
})

afterAll(() => {
  localStorage.clear()
  sander.rimrafSync(storagePath)
})
