const toggleStorage = require('browser/main/lib/dataApi/toggleStorage')

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

const storagePath = path.join(os.tmpdir(), 'test/toggle-storage')

const context = {}

beforeEach(() => {
  context.storage = TestDummy.dummyStorage(storagePath)
  localStorage.setItem('storages', JSON.stringify([context.storage.cache]))
})

test('Toggle a storage location', () => {
  const storageKey = context.storage.cache.key
  return Promise.resolve()
    .then(function doTest() {
      return toggleStorage(storageKey, true)
    })
    .then(function assert() {
      const cachedStorageList = JSON.parse(localStorage.getItem('storages'))
      expect(_.find(cachedStorageList, { key: storageKey }).isOpen).toBe(true)
    })
})

afterAll(() => {
  localStorage.clear()
  sander.rimrafSync(storagePath)
})
