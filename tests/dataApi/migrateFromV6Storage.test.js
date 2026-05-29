const migrateFromV6Storage = require('browser/main/lib/dataApi/migrateFromV6Storage')

const path = require('path')
const TestDummy = require('../fixtures/TestDummy')
const sander = require('sander')
const CSON = require('@rokt33r/season')
const _ = require('lodash')
const os = require('os')

const dummyStoragePath = path.join(os.tmpdir(), 'test/migrate-test-storage')

const context = {}

beforeEach(() => {
  const dummyData = (context.dummyData =
    TestDummy.dummyLegacyStorage(dummyStoragePath))
  console.log('init count', dummyData.notes.length)
  localStorage.setItem('storages', JSON.stringify([dummyData.cache]))
})

test('Migrate legacy storage into v1 storage', () => {
  return Promise.resolve()
    .then(function doTest() {
      return migrateFromV6Storage(dummyStoragePath)
    })
    .then(function assert(data) {
      // Check the result. It must be true if succeed.
      expect(data).toBe(true)

      // Check all notes migrated.
      const dummyData = context.dummyData
      const noteDirPath = path.join(dummyStoragePath, 'notes')
      const fileList = sander.readdirSync(noteDirPath)
      expect(dummyData.notes.length).toBe(fileList.length)
      const noteMap = fileList.map(filePath => {
        return CSON.readFileSync(path.join(noteDirPath, filePath))
      })
      dummyData.notes.forEach(function (targetNote) {
        expect(
          _.find(noteMap, {
            title: targetNote.title,
            folder: targetNote.folder
          })
        ).not.toBeNull()
      })

      // Check legacy folder directory is removed
      dummyData.json.folders.forEach(function (folder) {
        try {
          sander.statSync(dummyStoragePath, folder.key)
          throw new Error('Folder still remains. ENOENT error must be occured.')
        } catch (err) {
          expect(err.code).toBe('ENOENT')
        }
      })
    })
})

afterAll(() => {
  localStorage.clear()
  sander.rimrafSync(dummyStoragePath)
})
