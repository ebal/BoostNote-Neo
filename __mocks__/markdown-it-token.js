// markdown-it 14 ships lib/token as .mjs only, so jest (CommonJS) cannot
// resolve `markdown-it/lib/token`, which @hikerpig/markdown-it-toc-and-anchor
// requires. Webpack resolves it through the .mjs extension; jest gets the
// same class from the CommonJS build instead.
module.exports = require('markdown-it')().core.State.prototype.Token
