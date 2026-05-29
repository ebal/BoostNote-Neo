const createNote = require('browser/main/lib/dataApi/createNote')
const deleteNote = require('browser/main/lib/dataApi/deleteNote')

const path = require('path')
const TestDummy = require('../fixtures/TestDummy')
const sander = require('sander')
const os = require('os')
const CSON = require('@rokt33r/season')
const faker = require('faker')
const fs = require('fs')
const attachmentManagement = require('browser/main/lib/dataApi/attachmentManagement')

const storagePath = path.join(os.tmpdir(), 'test/delete-note')

const context = {}

beforeEach(() => {
  context.storage = TestDummy.dummyStorage(storagePath)
  localStorage.setItem('storages', JSON.stringify([context.storage.cache]))
})

test('Delete a note', () => {
  const storageKey = context.storage.cache.key
  const folderKey = context.storage.json.folders[0].key

  const input1 = {
    type: 'SNIPPET_NOTE',
    description: faker.lorem.lines(),
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
  input1.title = input1.description.split('\n').shift()

  return Promise.resolve()
    .then(function doTest() {
      return createNote(storageKey, input1)
        .then(function createAttachmentFolder(data) {
          fs.mkdirSync(
            path.join(storagePath, attachmentManagement.DESTINATION_FOLDER)
          )
          fs.mkdirSync(
            path.join(
              storagePath,
              attachmentManagement.DESTINATION_FOLDER,
              data.key
            )
          )
          return data
        })
        .then(function(data) {
          return deleteNote(storageKey, data.key)
        })
    })
    .then(function assert(data) {
      try {
        CSON.readFileSync(
          path.join(storagePath, 'notes', data.noteKey + '.cson')
        )
        throw new Error('note cson must be deleted.')
      } catch (err) {
        expect(err.code).toBe('ENOENT')
        return data
      }
    })
    .then(function assertAttachmentFolderDeleted(data) {
      const attachmentFolderPath = path.join(
        storagePath,
        attachmentManagement.DESTINATION_FOLDER,
        data.noteKey
      )
      expect(fs.existsSync(attachmentFolderPath)).toBe(false)
    })
})

afterAll(() => {
  localStorage.clear()
  sander.rimrafSync(storagePath)
})
