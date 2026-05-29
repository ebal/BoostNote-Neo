const skeleton = require('./webpack-skeleton')
const webpack = require('webpack')
const path = require('path')
const NodeTargetPlugin = require('webpack/lib/node/NodeTargetPlugin')

const stylusOptions = {
  use: [require('nib')()],
  import: [
    '~nib/lib/nib/index.styl',
    path.join(__dirname, 'browser/styles/index.styl')
  ]
}

var config = Object.assign({}, skeleton, {
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /(node_modules|bower_components)/,
        use: 'babel-loader'
      },
      {
        test: /global\.styl$/,
        use: [
          { loader: 'style-loader' },
          { loader: 'css-loader' },
          { loader: 'stylus-loader', options: stylusOptions }
        ]
      },
      {
        test: /\.styl$/,
        exclude: /(node_modules|bower_components|global\.styl$)/,
        use: [
          { loader: 'style-loader' },
          {
            loader: 'css-loader',
            options: {
              modules: true,
              importLoaders: 1,
              localIdentName: '[name]__[local]___[path]'
            }
          },
          { loader: 'stylus-loader', options: stylusOptions }
        ]
      },
      {
        test: /\.json$/,
        use: 'json-loader'
      }
    ]
  },
  output: {
    path: path.join(__dirname, 'compiled'),
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    sourceMapFilename: '[name].map',
    publicPath: 'http://localhost:8080/assets/'
  },
  plugins: [
    new webpack.NoEmitOnErrorsPlugin(),
    new NodeTargetPlugin(),
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production'),
        BABEL_ENV: JSON.stringify('production')
      }
    })
  ]
})

module.exports = config
