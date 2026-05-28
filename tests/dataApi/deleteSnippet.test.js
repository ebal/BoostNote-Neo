const deleteSnippet = require('browser/main/lib/dataApi/deleteSnippet')
const sander = require('sander')
const os = require('os')
const path = require('path')
const crypto = require('crypto')

const snippetFilePath = path.join(os.tmpdir(), 'test', 'delete-snippet')
const snippetFile = path.join(snippetFilePath, 'snippets.json')
const newSnippet = {
  id: crypto.randomBytes(16).toString('hex'),
  name: 'Unnamed snippet',
  prefix: [],
  content: ''
}

beforeEach(() => {
  sander.writeFileSync(snippetFile, JSON.stringify([newSnippet]))
})

test('Delete a snippet', () => {
  return Promise.resolve()
    .then(function doTest() {
      return Promise.all([deleteSnippet(newSnippet, snippetFile)])
    })
    .then(function assert() {
      const snippets = JSON.parse(sander.readFileSync(snippetFile))
      expect(snippets.length).toBe(0)
    })
})

afterAll(() => {
  sander.rimrafSync(snippetFilePath)
})
