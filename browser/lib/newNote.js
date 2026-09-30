import dataApi from 'browser/main/lib/dataApi'
import ee from 'browser/main/lib/eventEmitter'
import queryString from 'browser/lib/queryString'
import { push } from 'connected-react-router'

export function createMarkdownNote(
  storage,
  folder,
  dispatch,
  location,
  params,
  config
) {
  let tags = []
  if (
    config.ui.tagNewNoteWithFilteringTags &&
    location.pathname.match(/\/tags/)
  ) {
    tags = params.tagname.split(' ')
  }

  return dataApi
    .createNote(storage, {
      type: 'MARKDOWN_NOTE',
      folder: folder,
      title: '',
      tags,
      content: '',
      linesHighlighted: []
    })
    .then(note => {
      const noteHash = note.key
      dispatch({
        type: 'UPDATE_NOTE',
        note: note
      })

      dispatch(
        push({
          pathname: location.pathname,
          search: queryString.stringify({ key: noteHash })
        })
      )
      ee.emit('list:jump', noteHash)
      ee.emit('detail:focus')
    })
}

export function createSnippetNote(
  storage,
  folder,
  dispatch,
  location,
  params,
  config
) {
  let tags = []
  if (
    config.ui.tagNewNoteWithFilteringTags &&
    location.pathname.match(/\/tags/)
  ) {
    tags = params.tagname.split(' ')
  }

  const defaultLanguage =
    config.editor.snippetDefaultLanguage === 'Auto Detect'
      ? null
      : config.editor.snippetDefaultLanguage

  return dataApi
    .createNote(storage, {
      type: 'SNIPPET_NOTE',
      folder: folder,
      title: '',
      tags,
      description: '',
      snippets: [
        {
          name: '',
          mode: defaultLanguage,
          content: '',
          linesHighlighted: []
        }
      ]
    })
    .then(note => {
      const noteHash = note.key
      dispatch({
        type: 'UPDATE_NOTE',
        note: note
      })
      dispatch(
        push({
          pathname: location.pathname,
          search: queryString.stringify({ key: noteHash })
        })
      )
      ee.emit('list:jump', noteHash)
      ee.emit('detail:focus')
    })
}
