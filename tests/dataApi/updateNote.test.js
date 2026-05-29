const createNote = require('browser/main/lib/dataApi/createNote')
const updateNote = require('browser/main/lib/dataApi/updateNote')

const path = require('path')
const TestDummy = require('../fixtures/TestDummy')
const sander = require('sander')
const os = require('os')
const CSON = require('@rokt33r/season')
const faker = require('faker')

const storagePath = path.join(os.tmpdir(), 'test/update-note')

const context = {}

beforeEach(() => {
  context.storage = TestDummy.dummyStorage(storagePath)
  localStorage.setItem('storages', JSON.stringify([context.storage.cache]))
})

test('Update a note', () => {
  const storageKey = context.storage.cache.key
  const folderKey = context.storage.json.folders[0].key

  const randLinesHighlightedArray = new Array(10)
    .fill()
    .map(() => Math.round(Math.random() * 10))
  const randLinesHighlightedArray2 = new Array(15)
    .fill()
    .map(() => Math.round(Math.random() * 15))

  const input1 = {
    type: 'SNIPPET_NOTE',
    description: faker.lorem.lines(),
    snippets: [
      {
        name: faker.system.fileName(),
        mode: 'text',
        content: faker.lorem.lines(),
        linesHighlighted: randLinesHighlightedArray
      }
    ],
    tags: faker.lorem.words().split(' '),
    folder: folderKey
  }
  input1.title = input1.description.split('\n').shift()

  const input2 = {
    type: 'MARKDOWN_NOTE',
    content: faker.lorem.lines(),
    tags: faker.lorem.words().split(' '),
    folder: folderKey,
    linesHighlighted: randLinesHighlightedArray
  }
  input2.title = input2.content.split('\n').shift()

  const input3 = {
    type: 'SNIPPET_NOTE',
    description: faker.lorem.lines(),
    snippets: [
      {
        name: faker.system.fileName(),
        mode: 'text',
        content: faker.lorem.lines(),
        linesHighlighted: randLinesHighlightedArray2
      }
    ],
    tags: faker.lorem.words().split(' ')
  }
  input3.title = input3.description.split('\n').shift()

  const input4 = {
    type: 'MARKDOWN_NOTE',
    content: faker.lorem.lines(),
    tags: faker.lorem.words().split(' '),
    linesHighlighted: randLinesHighlightedArray2
  }
  input4.title = input4.content.split('\n').shift()

  return Promise.resolve()
    .then(function doTest() {
      return Promise.all([
        createNote(storageKey, input1),
        createNote(storageKey, input2)
      ]).then(function updateNotes(data) {
        const data1 = data[0]
        const data2 = data[1]
        return Promise.all([
          updateNote(data1.storage, data1.key, input3),
          updateNote(data1.storage, data2.key, input4)
        ])
      })
    })
    .then(function assert(data) {
      const data1 = data[0]
      const data2 = data[1]

      const jsonData1 = CSON.readFileSync(
        path.join(storagePath, 'notes', data1.key + '.cson')
      )
      expect(data1.title).toBe(input3.title)
      expect(jsonData1.title).toBe(input3.title)
      expect(data1.description).toBe(input3.description)
      expect(jsonData1.description).toBe(input3.description)
      expect(data1.tags.length).toBe(input3.tags.length)
      expect(jsonData1.tags.length).toBe(input3.tags.length)
      expect(data1.snippets.length).toBe(input3.snippets.length)
      expect(jsonData1.snippets.length).toBe(input3.snippets.length)
      expect(data1.snippets[0].content).toBe(input3.snippets[0].content)
      expect(jsonData1.snippets[0].content).toBe(input3.snippets[0].content)
      expect(data1.snippets[0].name).toBe(input3.snippets[0].name)
      expect(jsonData1.snippets[0].name).toBe(input3.snippets[0].name)
      expect(data1.snippets[0].linesHighlighted).toEqual(
        input3.snippets[0].linesHighlighted
      )
      expect(jsonData1.snippets[0].linesHighlighted).toEqual(
        input3.snippets[0].linesHighlighted
      )

      const jsonData2 = CSON.readFileSync(
        path.join(storagePath, 'notes', data2.key + '.cson')
      )
      expect(data2.title).toBe(input4.title)
      expect(jsonData2.title).toBe(input4.title)
      expect(data2.content).toBe(input4.content)
      expect(jsonData2.content).toBe(input4.content)
      expect(data2.tags.length).toBe(input4.tags.length)
      expect(jsonData2.tags.length).toBe(input4.tags.length)
      expect(data2.linesHighlighted).toEqual(input4.linesHighlighted)
      expect(jsonData2.linesHighlighted).toEqual(input4.linesHighlighted)
    })
})

afterAll(() => {
  localStorage.clear()
  sander.rimrafSync(storagePath)
})
