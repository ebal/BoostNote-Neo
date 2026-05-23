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

test('escapeMarkdownPipe escapes backslashes before pipes so the encoding is reversible', () => {
  // Input: a\|b — the backslash is a literal user-provided char, not an escape.
  // Backslash must be doubled first (\ → \\), then the pipe escaped (| → \|),
  // so the result is a\\\|b (each meta-char unambiguous).
  expect(escapeMarkdownPipe('a\\|b')).toBe('a\\\\\\|b')
})

test('escapeMarkdownPipe escapes lone backslashes even without a pipe', () => {
  expect(escapeMarkdownPipe('foo\\bar')).toBe('foo\\\\bar')
})

test('escapeMarkdownPipe does not touch other markdown meta characters', () => {
  expect(escapeMarkdownPipe('[foo](bar)')).toBe('[foo](bar)')
})

test('escapeMarkdownPipe leaves full-width pipe untouched', () => {
  expect(escapeMarkdownPipe('a｜b')).toBe('a｜b')
})
