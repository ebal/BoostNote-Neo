'use strict'

// GitHub-style alert blockquotes:
//   > [!NOTE]
//   > body
// Transforms matching blockquote token ranges into:
//   <div class="markdown-alert markdown-alert-note">
//     <p class="markdown-alert-title">Note</p>
//     <p>body</p>
//   </div>
// Supported types: NOTE, TIP, IMPORTANT, WARNING, CAUTION.
// Runs after the block ruler so token children are still unparsed and the
// inline ruler picks up the rewritten content + injected title tokens.

const ALERT_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\r?\n|$)/

module.exports = function githubAlertsPlugin(md) {
  md.core.ruler.after('block', 'github_alerts', state => {
    const tokens = state.tokens
    const Token = state.Token

    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'blockquote_open') continue

      const pOpenIdx = i + 1
      const inlineIdx = i + 2
      const pOpen = tokens[pOpenIdx]
      const inline = tokens[inlineIdx]

      if (!pOpen || pOpen.type !== 'paragraph_open') continue
      if (!inline || inline.type !== 'inline') continue

      const match = ALERT_RE.exec(inline.content)
      if (!match) continue

      const type = match[1].toLowerCase()
      const title = match[1].charAt(0) + match[1].slice(1).toLowerCase()

      // Strip the marker from the inline content; inline ruler will
      // (re)parse the remainder later in the pipeline.
      inline.content = inline.content.slice(match[0].length)

      // Find the matching blockquote_close at the same nesting depth.
      let depth = 1
      let closeIdx = -1
      for (let j = i + 1; j < tokens.length; j++) {
        if (tokens[j].type === 'blockquote_open') depth++
        else if (tokens[j].type === 'blockquote_close') {
          depth--
          if (depth === 0) {
            closeIdx = j
            break
          }
        }
      }
      if (closeIdx === -1) continue

      // Rewrite the blockquote wrapper into a div with alert classes.
      tokens[i].tag = 'div'
      tokens[i].attrSet(
        'class',
        'markdown-alert markdown-alert-' + type
      )
      tokens[closeIdx].tag = 'div'

      // Build the title paragraph and insert before the body paragraph.
      const titleOpen = new Token('paragraph_open', 'p', 1)
      titleOpen.attrSet('class', 'markdown-alert-title')
      titleOpen.block = true

      const titleInline = new Token('inline', '', 0)
      titleInline.content = title
      titleInline.children = []

      const titleClose = new Token('paragraph_close', 'p', -1)
      titleClose.block = true

      tokens.splice(pOpenIdx, 0, titleOpen, titleInline, titleClose)

      // Advance past the rewritten close (closeIdx shifted by +3 inserts).
      i = closeIdx + 3
    }
  })
}
