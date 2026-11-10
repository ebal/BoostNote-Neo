/**
 * @fileoverview Unit test for browser/lib/normalizeEditorFontFamily
 */
import normalizeEditorFontFamily from '../../browser/lib/normalizeEditorFontFamily'

const defaults =
  "'JetBrains Mono', Monaco, Menlo, 'Ubuntu Mono', Consolas, source-code-pro, monospace"

test('normalizeEditorFontFamily() should return the quoted default font family', () => {
  expect(normalizeEditorFontFamily()).toBe(defaults)
})

test('normalizeEditorFontFamily() should quote a single name with spaces', () => {
  expect(normalizeEditorFontFamily('Fira Code')).toBe(
    `'Fira Code', ${defaults}`
  )
})

test('normalizeEditorFontFamily() should quote each family of a list separately', () => {
  expect(normalizeEditorFontFamily('font1, Source Code Pro,font2')).toBe(
    `font1, 'Source Code Pro', font2, ${defaults}`
  )
})

test('normalizeEditorFontFamily() should not re-quote quoted names', () => {
  expect(normalizeEditorFontFamily('"Fira Code", Monaco')).toBe(
    `"Fira Code", Monaco, ${defaults}`
  )
})
