const removeStorage = require('browser/main/lib/dataApi/removeStorage')

const path = require('path')
const TestDummy = require('../fixtures/TestDummy')
const sander = require('sander')
const os = require('os')

const storagePath = path.join(os.tmpdir(), 'test/remove-storage')

const context = {}

beforeEach(() => {
  context.storage = TestDummy.dummyStorage(storagePath)
  localStorage.setItem('storages', JSON.stringify([context.storage.cache]))
})

test('Remove a storage', () => {
  const storageKey = context.storage.cache.key
  return Promise.resolve()
    .then(function doTest() {
      return removeStorage(storageKey)
    })
    .then(function assert() {
      expect(JSON.parse(localStorage.getItem('storages')).length).toBe(0)
    })
})

afterAll(() => {
  localStorage.clear()
  sander.rimrafSync(storagePath)
})
