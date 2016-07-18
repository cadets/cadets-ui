
module.exports = {
  entry: './lib/opus-console/index.js',
  output: {
    filename: './www/js/bundle.js'
  },
  resolve: {
    extensions: ['', '.js']
  },
  bail: true,
  module: {
    loaders: [
      { test: /\.css$/, loader: 'style-loader!css-loader' },
    ]
  }
}
