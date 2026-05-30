const nodeIpc = require('node-ipc')
const { app, Menu, globalShortcut, ipcMain, clipboard } = require('electron')
const path = require('path')
const mainWindow = require('./main-window')

ipcMain.on('clipboard:read-text', e => {
  e.returnValue = clipboard.readText()
})
ipcMain.on('clipboard:read-html', e => {
  e.returnValue = clipboard.readHTML()
})
ipcMain.on('clipboard:read-image-png', e => {
  const image = clipboard.readImage()
  e.returnValue = image.isEmpty() ? null : image.toPNG()
})
ipcMain.on('clipboard:write-text', (e, text) => {
  clipboard.writeText(text)
  e.returnValue = true
})

nodeIpc.config.id = 'node'
nodeIpc.config.retry = 1500
nodeIpc.config.silent = true

function toggleMainWindow() {
  switch (global.process.platform) {
    case 'darwin':
      if (mainWindow.isFocused()) {
        Menu.sendActionToFirstResponder('hide:')
      } else {
        mainWindow.show()
      }
      return
    default:
      if (mainWindow.isFocused()) {
        mainWindow.minimize()
      } else {
        mainWindow.minimize()
        mainWindow.restore()
      }
  }
}

ipcMain.on('config-renew', (e, payload) => {
  nodeIpc.server.broadcast('config-renew', payload)

  globalShortcut.unregisterAll()
  var { config } = payload

  mainWindow.setMenuBarVisibility(config.ui.showMenuBar)
  var errors = []
  try {
    globalShortcut.register(config.hotkey.toggleMain, toggleMainWindow)
  } catch (err) {
    errors.push('toggleMain')
  }
  if (!config.silent) {
    if (errors.length === 0) {
      mainWindow.webContents.send('APP_SETTING_DONE', {})
    } else {
      mainWindow.webContents.send('APP_SETTING_ERROR', {
        message: 'Failed to apply hotkey: ' + errors.join(' ')
      })
    }
  }
})

nodeIpc.serve(
  path.join(app.getPath('userData'), 'boostnote.service'),
  function () {
    nodeIpc.server.on('connect', function (socket) {
      nodeIpc.log('ipc server >> socket joinned'.rainbow)
      socket.on('close', function () {
        nodeIpc.log('ipc server >> socket closed'.rainbow)
      })
    })
    nodeIpc.server.on('error', function (err) {
      nodeIpc.log('Node IPC error'.rainbow, err)
    })
  }
)

module.exports = nodeIpc
