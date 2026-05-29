const webpack = require('webpack')
const WebpackDevServer = require('webpack-dev-server')
const config = require('../webpack.config')
const signale = require('signale')
const { spawn } = require('child_process')
const electron = require('electron')
const port = 8080

const devServerOptions = {
  hot: true,
  port,
  host: 'localhost',
  client: { overlay: { warnings: false } },
  static: false,
  allowedHosts: 'all',
  devMiddleware: {
    publicPath: config.output.publicPath
  }
}

let server = null
let firstRun = true

async function startServer() {
  const compiler = webpack(config)

  return new Promise((resolve, reject) => {
    compiler.hooks.done.tap('boostnote-dev', stats => {
      if (!stats.hasErrors()) {
        signale.success('Bundle success!')
        resolve()
      } else {
        if (!firstRun) {
          console.log(stats.compilation.errors[0])
        } else {
          firstRun = false
          reject(stats.compilation.errors[0])
        }
      }
    })

    server = new WebpackDevServer(devServerOptions, compiler)
    server.start().then(() => {
      signale.success(`Webpack Dev Server listening at localhost:${port}`)
      signale.watch('Waiting for webpack to bundle...')
    })
  })
}

function startElectron() {
  spawn(electron, ['--hot', './index.js'], { stdio: 'inherit' })
    .on('close', () => server.stop())
    .on('error', err => {
      signale.error(err)
      server.stop()
    })
    .on('disconnect', () => server.stop())
    .on('exit', () => server.stop())
}

startServer()
  .then(() => {
    startElectron()
    signale.success('Electron started')
  })
  .catch(err => {
    signale.error(err)
    process.exit(1)
  })
