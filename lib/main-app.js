const electron = require('electron')
const app = electron.app
const Menu = electron.Menu
// electron.crashReporter.start()
const singleInstance = app.requestSingleInstanceLock()

var ipcServer = null

var mainWindow = null

// Single Instance Lock
if (!singleInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, it should focus the existing instance.
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
    }
  })
}

app.on('window-all-closed', function () {
  app.quit()
})

app.on('ready', function () {
  mainWindow = require('./main-window')

  var template = require('./main-menu')
  var menu = Menu.buildFromTemplate(template)
  var touchBarMenu = require('./touchbar-menu')
  switch (process.platform) {
    case 'darwin':
      Menu.setApplicationMenu(menu)
      mainWindow.setTouchBar(touchBarMenu)
      break
    case 'win32':
      mainWindow.setMenu(menu)
      break
    case 'linux':
      Menu.setApplicationMenu(menu)
      mainWindow.setMenu(menu)
  }

  ipcServer = require('./ipcServer')
  ipcServer.server.start()
})

module.exports = app
