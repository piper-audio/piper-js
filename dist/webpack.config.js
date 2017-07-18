/**
 * Created by lucast on 17/07/2017.
 */
module.exports = {
    entry: './dist/ts/index.js',
    output: {
        path: __dirname,
        filename: 'piper.bundle.js',
        library: "Piper",
        libraryTarget: "umd"
    },
    devtool: 'source-map'
};