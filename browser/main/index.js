import { Provider } from 'react-redux'
import Main from './Main'
import { store, history } from './store'
import React, { Fragment } from 'react'
import ReactDOM from 'react-dom'
require('!!style!css!stylus!./global.styl')
import config from 'browser/main/lib/ConfigManager'
import { Route, Switch, Redirect } from 'react-router-dom'
import { ConnectedRouter } from 'connected-react-router'
import DevTools from './DevTools'

require('./lib/ipcClient')
require('../lib/customMeta')

document.addEventListener('drop', function(e) {
  e.preventDefault()
  e.stopPropagation()
})
document.addEventListener('dragover', function(e) {
  e.preventDefault()
  e.stopPropagation()
})

// prevent menu from popup when alt pressed
// but still able to toggle menu when only alt is pressed
let isAltPressing = false
let isAltWithMouse = false
let isAltWithOtherKey = false
let isOtherKey = false

document.addEventListener('keydown', function(e) {
  if (e.key === 'Alt') {
    isAltPressing = true
    if (isOtherKey) {
      isAltWithOtherKey = true
    }
  } else {
    if (isAltPressing) {
      isAltWithOtherKey = true
    }
    isOtherKey = true
  }
})

document.addEventListener('mousedown', function(e) {
  if (isAltPressing) {
    isAltWithMouse = true
  }
})

document.addEventListener('keyup', function(e) {
  if (e.key === 'Alt') {
    if (isAltWithMouse || isAltWithOtherKey) {
      e.preventDefault()
    }
    isAltWithMouse = false
    isAltWithOtherKey = false
    isAltPressing = false
    isOtherKey = false
  }
})

document.addEventListener('click', function(e) {
  const className = e.target.className
  if (!className && typeof className !== 'string') return
  const isInfoButton = className.includes('infoButton')
  const offsetParent = e.target.offsetParent
  const isInfoPanel =
    offsetParent !== null ? offsetParent.className.includes('infoPanel') : false
  if (isInfoButton || isInfoPanel) return
  const infoPanel = document.querySelector('.infoPanel')
  if (infoPanel) infoPanel.style.display = 'none'
})

if (!config.get().ui.showScrollBar) {
  const scrollbarStyleEl = document.createElement('style')
  document.head.appendChild(scrollbarStyleEl)
  const scrollbarSheet = scrollbarStyleEl.sheet
  scrollbarSheet.insertRule('::-webkit-scrollbar {display: none}')
  scrollbarSheet.insertRule('::-webkit-scrollbar-corner {display: none}')
  scrollbarSheet.insertRule('::-webkit-scrollbar-thumb {display: none}')
}

const el = document.getElementById('content')

ReactDOM.render(
  <Provider store={store}>
    <ConnectedRouter history={history}>
      <Fragment>
        <Switch>
          <Redirect path='/' to='/home' exact />
          <Route path='/(home|alltags|starred|trashed)' component={Main} />
          <Route path='/searched' component={Main} exact />
          <Route path='/searched/:searchword' component={Main} />
          <Redirect path='/tags' to='/alltags' exact />
          <Route path='/tags/:tagname' component={Main} />

          {/* storages */}
          <Redirect path='/storages' to='/home' exact />
          <Route path='/storages/:storageKey' component={Main} exact />
          <Route
            path='/storages/:storageKey/folders/:folderKey'
            component={Main}
          />
        </Switch>
        <DevTools />
      </Fragment>
    </ConnectedRouter>
  </Provider>,
  el,
  function() {
    const loadingCover = document.getElementById('loadingCover')
    loadingCover.parentNode.removeChild(loadingCover)
  }
)
