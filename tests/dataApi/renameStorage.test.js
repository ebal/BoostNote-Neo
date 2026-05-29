const renameStorage = require('browser/main/lib/dataApi/renameStorage')

const path = require('path')
const _ = require('lodash')
const TestDummy = require('../fixtures/TestDummy')
const sander = require('sander')
const os = require('os')

const storagePath = path.join(os.tmpdir(), 'test/rename-storage')

const context = {}

beforeEach(() => {
  context.storage = TestDummy.dummyStorage(storagePath)
  localStorage.setItem('storages', JSON.stringify([context.storage.cache]))
})

test('Rename a storage', () => {
  const storageKey = context.storage.cache.key
  return Promise.resolve()
    .then(function doTest() {
      return renameStorage(storageKey, 'changed')
    })
    .then(function assert() {
      const cachedStorageList = JSON.parse(localStorage.getItem('storages'))
      expect(_.find(cachedStorageList, { key: storageKey }).name).toBe(
        'changed'
      )
    })
})

afterAll(() => {
  localStorage.clear()
  sander.rimrafSync(storagePath)
})
