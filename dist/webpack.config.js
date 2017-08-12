/**
 * Created by lucast on 17/07/2017.
 */
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
module.exports = {
  entry: './dist/ts/index.js',
  output: {
    path: __dirname,
    filename: 'piper.bundle.js',
    library: "Piper",
    libraryTarget: "umd"
  },
  devtool: 'source-map',
  plugins: [
    new UglifyJSPlugin(
      {
        sourceMap: true,
        uglifyOptions: { mangle: false } // seems there is a bug otherwise
      }
    )
  ]
};