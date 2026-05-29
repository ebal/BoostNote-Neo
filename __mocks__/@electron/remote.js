// Mock @electron/remote for the jest test environment.
// At import time, the real module calls process._linkedBinding(
// 'electron_common_features') which only exists inside an Electron
// renderer process — Node-only jest cannot resolve it and module load
// throws. This mock returns a no-op surface broad enough for the
// dataApi tests that transitively reach formatPDF.js / formatHTML.js.
const noop = () => {}

module.exports = {
  app: {
    getAppPath: noop,
    getPath: noop,
    getVersion: noop
  },
  dialog: {
    showMessageBox: noop,
    showMessageBoxSync: noop,
    showOpenDialog: noop,
    showSaveDialog: noop,
    showErrorBox: noop
  },
  shell: {
    openExternal: noop,
    openPath: noop
  },
  Menu: Object.assign(
    jest.fn().mockImplementation(() => ({
      append: noop,
      popup: noop
    })),
    {
      buildFromTemplate: jest.fn().mockImplementation(() => ({
        popup: noop,
        append: noop
      }))
    }
  ),
  MenuItem: jest.fn(),
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: noop,
    webContents: {
      send: noop,
      on: noop,
      printToPDF: () => Promise.resolve(Buffer.from(''))
    },
    on: noop,
    close: noop,
    destroy: noop
  })),
  getCurrentWindow: jest.fn().mockReturnValue({
    webContents: { send: noop }
  }),
  getCurrentWebContents: jest.fn().mockReturnValue({ send: noop })
}
