import React from 'react'
import CSSModules from 'browser/lib/CSSModules'
import styles from './InfoTab.styl'
import i18n from 'browser/lib/i18n'

const { shell } = require('electron')
const remote = require('@electron/remote')
const appVersion = remote.app.getVersion()

class InfoTab extends React.Component {
  handleLinkClick(e) {
    shell.openExternal(e.currentTarget.href)
    e.preventDefault()
  }

  render() {
    return (
      <div styleName='root'>
        <div styleName='group-header--sub'>{i18n.__('About')}</div>

        <div styleName='top'>
          <div styleName='icon-space'>
            <img
              styleName='icon'
              src='../resources/app.png'
              width='92'
              height='92'
            />
            <div styleName='icon-right'>
              <div styleName='appId'>Boostnote Legacy {appVersion}</div>
              <div styleName='description'>
                {i18n.__(
                  'An open source note-taking app made for programmers just like you.'
                )}
              </div>
            </div>
          </div>
        </div>

        <ul styleName='list'>
          <li styleName='cc'>{i18n.__('Copyright (C) 2017 - 2020 BoostIO')}</li>
          <li styleName='cc'>{i18n.__('License: GPL v3')}</li>
        </ul>
      </div>
    )
  }
}

InfoTab.propTypes = {}

export default CSSModules(InfoTab, styles)
