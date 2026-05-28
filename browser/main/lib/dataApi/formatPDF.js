import formatHTML from './formatHTML'
const remote = require('@electron/remote')

export default function formatPDF(props) {
  return function(note, targetPath, exportTasks) {
    const printout = new remote.BrowserWindow({
      show: false,
      webPreferences: { webSecurity: false, javascript: false }
    })

    printout.loadURL(
      'data:text/html;charset=UTF-8,' +
        formatHTML(props)(note, targetPath, exportTasks)
    )

    return new Promise((resolve, reject) => {
      printout.webContents.on('did-finish-load', () => {
        printout.webContents
          .printToPDF({})
          .then(resolve, reject)
          .finally(() => printout.destroy())
      })
    })
  }
}
