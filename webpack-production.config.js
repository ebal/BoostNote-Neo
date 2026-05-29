const skeleton = require('./webpack-skeleton')
const webpack = require('webpack')
const path = require('path')
const TerserPlugin = require('terser-webpack-plugin')

const stylusLoaderOptions = {
  stylusOptions: {
    use: [require('nib')()],
    import: [
      '~nib/lib/nib/index.styl',
      path.join(__dirname, 'browser/styles/index.styl')
    ]
  }
}

var config = Object.assign({}, skeleton, {
  mode: 'production',
  performance: { hints: false },
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          ecma: 5,
          keep_classnames: true,
          keep_fnames: true,
          compress: { ecma: 5 },
          output: { ecma: 5 }
        }
      })
    ]
  },
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
          { loader: 'stylus-loader', options: stylusLoaderOptions }
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
              modules: {
                localIdentName: '[name]__[local]___[path]'
              },
              importLoaders: 1
            }
          },
          { loader: 'stylus-loader', options: stylusLoaderOptions }
        ]
      },
      {
        test: /\.json$/,
        type: 'javascript/auto',
        use: 'json-loader'
      }
    ]
  },
  output: {
    path: path.join(__dirname, 'compiled'),
    filename: '[name].js',
    chunkFilename: '[name].chunk.js',
    libraryTarget: 'commonjs2',
    sourceMapFilename: '[name].map',
    publicPath: '../compiled/'
  },
  plugins: [
    new webpack.NoEmitOnErrorsPlugin(),
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production'),
        BABEL_ENV: JSON.stringify('production')
      }
    })
  ]
})

module.exports = config
