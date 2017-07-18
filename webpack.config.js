/**
 * Created by lucast on 17/07/2017.
 */
const path = require('path');
module.exports = {
    entry: './dist/ts/index.js',
    output: {
        path: path.resolve(__dirname, "dist"), // string
        filename: 'piper.bundle.js',
        library: "Piper",
        libraryTarget: "umd"
    },
    devtool: 'source-map'
};