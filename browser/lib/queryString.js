/**
 * Minimal stand-in for the `query-string` package's `parse` / `stringify`,
 * implemented on the platform's URLSearchParams.
 *
 * query-string was dropped because it has no non-vulnerable configuration:
 * every major (6 through 9) depends on `decode-uri-component`, and that
 * package's only patched release (0.5.0, for GHSA #280 -- exponential
 * decoding of malformed percent-encoded input) is ESM-only *and* drops the
 * `+` -> space substitution CJS query-string relies on. There is no version
 * pair that is both installable here and patched, so the dependency had to go.
 *
 * Only the behaviour this codebase actually relies on is reproduced:
 *
 * - `parse()` accepts a search string with or without a leading `?`, returns a
 *   plain object, and yields `undefined` for absent keys -- so the existing
 *   `parse(location.search).key` reads behave identically. It decodes both
 *   `%20` and `+` to a space, as query-string did.
 * - `stringify()` emits `k=v` pairs joined by `&`, sorted by key (query-string
 *   sorts by default), skipping entries whose value is `undefined`. It encodes
 *   via encodeURIComponent rather than letting URLSearchParams emit `+` for
 *   spaces, which keeps the percent-encoded output shape query-string
 *   produced.
 *
 * Deliberate difference: query-string collapses a repeated key into an array,
 * this keeps the last occurrence. No call site in this repo emits or reads
 * repeated keys -- every `stringify` here passes `{ key: <uuid> }` or `{}`.
 */

export function parse(search) {
  const result = {}
  if (!search) return result

  const params = new URLSearchParams(
    search.charAt(0) === '?' ? search.slice(1) : search
  )
  params.forEach((value, key) => {
    result[key] = value
  })

  return result
}

export function stringify(obj) {
  if (!obj) return ''

  return Object.keys(obj)
    .sort()
    .filter(key => obj[key] !== undefined)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`)
    .join('&')
}

export default { parse, stringify }
