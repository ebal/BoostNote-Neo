const { escapeMarkdownPipe } = require('browser/lib/utils')

test('escapeMarkdownPipe returns input unchanged when no pipe present', () => {
  expect(escapeMarkdownPipe('hello world')).toBe('hello world')
})

test('escapeMarkdownPipe escapes a single pipe', () => {
  expect(escapeMarkdownPipe('foo|bar')).toBe('foo\\|bar')
})

test('escapeMarkdownPipe escapes every pipe occurrence (regression: js/incomplete-sanitization)', () => {
  expect(escapeMarkdownPipe('a|b|c|d')).toBe('a\\|b\\|c\\|d')
})

test('escapeMarkdownPipe handles consecutive pipes', () => {
  expect(escapeMarkdownPipe('||')).toBe('\\|\\|')
})

test('escapeMarkdownPipe handles empty string', () => {
  expect(escapeMarkdownPipe('')).toBe('')
})

test('escapeMarkdownPipe does not touch already-escaped pipes (still escapes the pipe itself)', () => {
  expect(escapeMarkdownPipe('a\\|b')).toBe('a\\\\|b')
})

test('escapeMarkdownPipe does not touch other markdown meta characters', () => {
  expect(escapeMarkdownPipe('[foo](bar)')).toBe('[foo](bar)')
})

test('escapeMarkdownPipe leaves full-width pipe untouched', () => {
  expect(escapeMarkdownPipe('a｜b')).toBe('a｜b')
})
