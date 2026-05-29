const webpack = require('webpack')
const path = require('path')

var config = {
  target: 'electron-renderer',
  entry: {
    main: ['./browser/main/index.js']
  },
  resolve: {
    extensions: ['.js', '.jsx', '.styl'],
    aliasFields: ['browser'],
    mainFields: ['webpack', 'browserify', 'jam', 'main'],
    alias: {
      lib: path.join(__dirname, 'lib'),
      browser: path.join(__dirname, 'browser')
    },
    fallback: {
      buffer: false,
      crypto: false,
      stream: false,
      path: false,
      fs: false,
      os: false,
      util: false,
      url: false,
      querystring: false,
      tty: false,
      assert: false,
      zlib: false,
      http: false,
      https: false,
      child_process: false,
      net: false,
      tls: false,
      dns: false,
      module: false,
      readline: false,
      vm: false
    }
  },
  plugins: [new webpack.NoEmitOnErrorsPlugin()],
  externals: [
    'prettier',
    'node-ipc',
    'electron',
    '@electron/remote',
    'lodash',
    'markdown-it',
    'moment',
    'markdown-it-emoji',
    '@rokt33r/markdown-it-math',
    'markdown-it-kbd',
    'markdown-it-plantuml',
    'markdown-it-admonition',
    'markdown-toc',
    '@rokt33r/season',
    {
      react: 'var React',
      'react-dom': 'var ReactDOM',
      'react-redux': 'var ReactRedux',
      codemirror: 'var CodeMirror',
      redux: 'var Redux',
      raphael: 'var Raphael',
      flowchart: 'var flowchart',
      'sequence-diagram': 'var Diagram'
    }
  ]
}

module.exports = config
