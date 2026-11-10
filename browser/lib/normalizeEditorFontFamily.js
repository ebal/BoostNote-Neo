import consts from 'browser/lib/consts'
import isString from 'lodash/isString'

function quoteFontName(name) {
  return name.includes(' ') && !/^['"]/.test(name) ? `'${name}'` : name
}

// A configured value may itself be a list (e.g. "Monaco, Consolas" from
// .boostnoterc or older configs), so quote each family separately.
function quoteFontList(list) {
  return list
    .split(',')
    .map(name => name.trim())
    .filter(name => name.length > 0)
    .map(quoteFontName)
}

export default function normalizeEditorFontFamily(fontFamily) {
  const defaultEditorFontFamily = consts.DEFAULT_EDITOR_FONT_FAMILY
  return isString(fontFamily) && fontFamily.length > 0
    ? quoteFontList(fontFamily)
        .concat(defaultEditorFontFamily.map(quoteFontName))
        .join(', ')
    : defaultEditorFontFamily.map(quoteFontName).join(', ')
}
