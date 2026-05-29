const noop = () => {}

const MenuMock = jest.fn().mockImplementation(() => ({
  append: noop,
  popup: noop
}))
MenuMock.buildFromTemplate = jest.fn().mockImplementation(() => ({
  popup: noop,
  append: noop
}))

module.exports = {
  require: jest.fn(),
  match: jest.fn(),
  app: { getPath: noop, getAppPath: noop, getVersion: noop },
  remote: jest.fn(),
  dialog: { showMessageBox: noop, showOpenDialog: noop, showSaveDialog: noop },
  Menu: MenuMock,
  MenuItem: jest.fn(),
  clipboard: { writeText: noop, readText: () => '' },
  shell: { openExternal: noop, openPath: noop },
  ipcRenderer: { on: noop, off: noop, send: noop, invoke: () => Promise.resolve() },
  webFrame: { setZoomFactor: noop, setZoomLevel: noop }
}
