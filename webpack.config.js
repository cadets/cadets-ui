let path = require('path');

module.exports = {
  entry: {
    machines: './lib/graphing/machines.js',
    notifications: './lib/notifications.js',
    style: './lib/graphing/style.js',
    worksheet: './lib/graphing/worksheet.js',
  },

  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },

  devtool: 'source-map',

  module: {
    rules: [
      // Fonts
      {
        test: /\.(ttf|eot|svg)(\?[\s\S]+)?$/,
        use: [ 'file-loader?name=/dist/[hash].[ext]' ],
      },
      {
        test: /\.woff2?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
        use: [ 'url-loader?name=/dist/[hash].[ext]&limit=10000&mimetype=application/font-woff' ],
      },

      // Images
      {
        test: /\.(png|svg|jpg|gif)$/,
        use: [
          {
            loader: 'url-loader',
            options: { limit: 8192 },
          },
        ],
      },

      // Scripts
      {
        test: /\.tsx?$/,
        use: [
          'ts-loader',
        ],
      },

      // Style (raw CSS, Sass/SCSS and Stylus)
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
        ]
      },
      {
        test: /\.s[ac]ss$/,
        use: [
          'style-loader',
          'css-loader',
          'sass-loader',
        ]
      },
      {
        test: /\.styl$/,
        use: [
          'style-loader',
          'css-loader',
          'stylus-loader',
        ]
      },
    ],
  },
};
