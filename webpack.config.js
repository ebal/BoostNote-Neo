const skeleton = require('./webpack-skeleton')
const path = require('path')

const stylusLoaderOptions = {
  sourceMap: true,
  stylusOptions: {
    use: [require('nib')()],
    import: [
      '~nib/lib/nib/index.styl',
      path.join(__dirname, 'browser/styles/index.styl')
    ]
  }
}

var config = Object.assign({}, skeleton, {
  mode: 'development',
  performance: { hints: false },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: { cacheDirectory: true }
        }
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
          {
            loader: 'stylus-loader',
            options: stylusLoaderOptions
          }
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
    sourceMapFilename: '[name].map',
    libraryTarget: 'commonjs2',
    publicPath: 'http://localhost:8080/assets/'
  },
  devtool: 'cheap-module-eval-source-map',
  devServer: {
    port: 8080,
    hot: true,
    inline: true,
    quiet: false,
    publicPath: 'http://localhost:8080/assets/'
  }
})

module.exports = config
