'use strict'

import { escapeHtmlCharacters } from './utils'
import url from 'url'

module.exports = function sanitizePlugin(md, options) {
  options = options || {}

  md.core.ruler.after('linkify', 'sanitize_inline', state => {
    for (let tokenIdx = 0; tokenIdx < state.tokens.length; tokenIdx++) {
      if (state.tokens[tokenIdx].type === 'html_block') {
        state.tokens[tokenIdx].content = sanitizeBlock(
          state.tokens[tokenIdx].content,
          options
        )
      }
      if (state.tokens[tokenIdx].type.match(/.*_fence$/)) {
        // escapeHtmlCharacters has better performance
        state.tokens[tokenIdx].content = escapeHtmlCharacters(
          state.tokens[tokenIdx].content,
          { skipSingleQuote: true }
        )
      }
      if (state.tokens[tokenIdx].type === 'inline') {
        const inlineTokens = state.tokens[tokenIdx].children
        for (let childIdx = 0; childIdx < inlineTokens.length; childIdx++) {
          if (inlineTokens[childIdx].type === 'html_inline') {
            inlineTokens[childIdx].content = sanitizeInline(
              inlineTokens[childIdx].content,
              options
            )
          }
        }
      }
    }
  })
}

const tagRegex = /<([A-Z][A-Z0-9]*)\b([^>]*)\/?>|<\/([A-Z][A-Z0-9]*)\s*>/i
// Original was `/([A-Z][A-Z0-9]*)(?:=("|')([^\\2]+?)\\2)?/gi` — the
// `[^\\2]` was meant as a backreference to group 2 (the quote char) but
// JS regex treats `\\N` inside a character class as an OCTAL escape, so
// the pattern silently matched any character except STX (0x02). V8 in
// Chromium 108+ (Electron 22+) handles this edge case differently and
// produces zero-length matches whose capture groups are undefined,
// crashing `match[1].toLowerCase()` downstream. Rewrite to explicit
// alternation for double-quoted, single-quoted, and unquoted attribute
// values. Capture groups now: 1 = name, 2 = value (without quotes).
const attributesRegex =
  /([A-Z][A-Z0-9]*)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gi

function sanitizeBlock(html, options) {
  const tagPattern = /<[^>]*>/g
  let lastIndex = 0
  let result = ''
  let match

  while ((match = tagPattern.exec(html)) !== null) {
    result += html.slice(lastIndex, match.index)
    result += sanitizeInline(match[0], options)
    lastIndex = match.index + match[0].length
  }
  result += html.slice(lastIndex)

  return result
}

function sanitizeInline(html, options) {
  let match = tagRegex.exec(html)
  if (!match) {
    return ''
  }

  const {
    allowedTags,
    allowedAttributes,
    selfClosing,
    allowedSchemesAppliedToAttributes
  } = options

  if (match[1] !== undefined) {
    // opening tag
    const tag = match[1].toLowerCase()
    if (allowedTags.indexOf(tag) === -1) {
      return ''
    }

    const attributes = match[2]

    let attrs = ''
    let name
    let value

    while ((match = attributesRegex.exec(attributes))) {
      if (!match[1]) {
        if (match.index === attributesRegex.lastIndex)
          attributesRegex.lastIndex++
        continue
      }
      name = match[1].toLowerCase()
      // Three possible capture sites for the value depending on quote
      // style: match[2] = double-quoted, match[3] = single-quoted,
      // match[4] = unquoted. Bare attributes have all three undefined.
      const hasValue = match[2] != null || match[3] != null || match[4] != null
      value = hasValue ? match[2] || match[3] || match[4] : undefined

      if (
        allowedAttributes['*'].indexOf(name) !== -1 ||
        (allowedAttributes[tag] && allowedAttributes[tag].indexOf(name) !== -1)
      ) {
        if (allowedSchemesAppliedToAttributes.indexOf(name) !== -1) {
          if (
            naughtyHRef(value, options) ||
            (tag === 'iframe' &&
              name === 'src' &&
              naughtyIFrame(value, options))
          ) {
            continue
          }
        }

        attrs += ` ${name}`
        if (hasValue) {
          attrs += `="${value}"`
        }
      }
    }

    if (selfClosing.indexOf(tag) === -1) {
      return '<' + tag + attrs + '>'
    } else {
      return '<' + tag + attrs + ' />'
    }
  } else {
    // closing tag
    if (match[3] == null) {
      return ''
    }
    if (allowedTags.indexOf(match[3].toLowerCase()) !== -1) {
      return html
    } else {
      return ''
    }
  }
}

function naughtyHRef(href, options) {
  // href = href.replace(/[\x00-\x20]+/g, '')
  if (!href) {
    // No href
    return false
  }
  let previous
  do {
    previous = href
    href = href.replace(/<\!\-\-[\s\S]*?\-\-\>/g, '')
  } while (href !== previous)

  const matches = href.match(/^([a-zA-Z]+)\:/)
  if (!matches) {
    if (href.match(/^[\/\\]{2}/)) {
      return !options.allowProtocolRelative
    }

    // No scheme
    return false
  }

  const scheme = matches[1].toLowerCase()

  return options.allowedSchemes.indexOf(scheme) === -1
}

function naughtyIFrame(src, options) {
  try {
    const parsed = url.parse(src, false, true)

    return options.allowedIframeHostnames.indexOf(parsed.hostname) === -1
  } catch (e) {
    return true
  }
}
