/**
 * @fileoverview Unit test for browser/lib/date-formatter.js
 */
const { formatDate } = require('browser/lib/date-formatter')

test('formatDate throws on invalid argument', () => {
  expect(() => formatDate('invalid argument')).toThrow('Invalid argument.')
})
