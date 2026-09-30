/**
 * @fileoverview Unit test for browser/lib/queryString
 *
 * Pins the query-string behaviours the call sites in browser/lib/newNote.js,
 * browser/main/Detail/*, browser/main/NoteList/index.js and
 * browser/main/modals/NewNoteModal.js depend on.
 */

const queryString = require('browser/lib/queryString').default

describe('parse()', () => {
  it('parses a search string with a leading ?', () => {
    expect(queryString.parse('?key=abc').key).toBe('abc')
  })

  it('parses a search string without a leading ?', () => {
    expect(queryString.parse('key=abc').key).toBe('abc')
  })

  it('returns undefined for an absent key, not null', () => {
    // Detail/index.js and NoteList/index.js read `.key` directly and rely on
    // a falsy-but-not-null result when the param is missing.
    expect(queryString.parse('?other=1').key).toBeUndefined()
  })

  it('returns an empty object for empty, ? and nullish input', () => {
    expect(queryString.parse('')).toEqual({})
    expect(queryString.parse('?')).toEqual({})
    expect(queryString.parse(undefined)).toEqual({})
  })

  it('round-trips a uuid v4 note key, the only value this repo stringifies', () => {
    const key = '3b6f8bd6-4edd-4b15-96e0-eadc4475b564'
    expect(queryString.parse(queryString.stringify({ key })).key).toBe(key)
  })

  it('decodes percent-encoded and plus-encoded spaces alike', () => {
    expect(queryString.parse('?tag=a%20b').tag).toBe('a b')
    expect(queryString.parse('?tag=a+b').tag).toBe('a b')
  })

  it('parses multiple params', () => {
    expect(queryString.parse('?a=1&b=2')).toEqual({ a: '1', b: '2' })
  })
})

describe('stringify()', () => {
  it('stringifies a single key', () => {
    expect(queryString.stringify({ key: 'abc' })).toBe('key=abc')
  })

  it('returns an empty string for an empty object', () => {
    // NoteList/index.js:938 passes an object with its only entry commented out.
    expect(queryString.stringify({})).toBe('')
  })

  it('returns an empty string for nullish input', () => {
    expect(queryString.stringify(undefined)).toBe('')
    expect(queryString.stringify(null)).toBe('')
  })

  it('sorts keys, matching query-string default behaviour', () => {
    expect(queryString.stringify({ b: '2', a: '1' })).toBe('a=1&b=2')
  })

  it('skips undefined values', () => {
    expect(queryString.stringify({ key: 'abc', gone: undefined })).toBe(
      'key=abc'
    )
  })

  it('percent-encodes rather than emitting + for spaces', () => {
    // URLSearchParams.toString() would give 'tag=a+b'; query-string gave
    // 'tag=a%20b'. Keep the latter so emitted URLs are unchanged.
    expect(queryString.stringify({ tag: 'a b' })).toBe('tag=a%20b')
  })

  it('encodes reserved characters in keys and values', () => {
    expect(queryString.stringify({ 'a&b': 'c=d' })).toBe('a%26b=c%3Dd')
  })
})
