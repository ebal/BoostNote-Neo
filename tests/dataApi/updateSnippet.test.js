const updateSnippet = require('browser/main/lib/dataApi/updateSnippet')
const sander = require('sander')
const os = require('os')
const path = require('path')
const crypto = require('crypto')

const snippetFilePath = path.join(os.tmpdir(), 'test', 'update-snippet')
const snippetFile = path.join(snippetFilePath, 'snippets.json')
const oldSnippet = {
  id: crypto.randomBytes(16).toString('hex'),
  name: 'Initial snippet',
  prefix: [],
  content: ''
}

const newSnippet = {
  id: oldSnippet.id,
  name: 'new name',
  prefix: ['prefix'],
  content: 'new content'
}

beforeEach(() => {
  sander.writeFileSync(snippetFile, JSON.stringify([oldSnippet]))
})

test('Update a snippet', () => {
  return Promise.resolve()
    .then(function doTest() {
      return Promise.all([updateSnippet(newSnippet, snippetFile)])
    })
    .then(function assert() {
      const snippets = JSON.parse(sander.readFileSync(snippetFile))
      const snippet = snippets.find(
        currentSnippet => currentSnippet.id === newSnippet.id
      )
      expect(snippet).not.toBeUndefined()
      expect(snippet.name).toBe(newSnippet.name)
      expect(snippet.prefix).toEqual(newSnippet.prefix)
      expect(snippet.content).toBe(newSnippet.content)
    })
})

afterAll(() => {
  sander.rimrafSync(snippetFilePath)
})
