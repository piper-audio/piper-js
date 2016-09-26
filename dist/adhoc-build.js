/**
 * Created by lucast on 26/09/2016.
 */
const fs = require("fs"); // Gets replaced by brfs when compiling
const path = require("path"); // Can probably replace this with a simple basename equivalent, might reduce code size

const basePath = "/../plugins/example-module/zero-crossings";
const ZeroCrossings = require("./ts/plugins/example-module/zero-crossings/src/ZeroCrossings.js");
// TODO brfs doesn't work with dynamic names, is there an alternative?
const configFiles = ["/../../plugins/example-module/zero-crossings/feats-config.json"];
const factories = configFiles.map(configFile => {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, "/../plugins/example-module/zero-crossings/feats-config.json"), 'utf8'));
    return {
        extractor: sr => eval("new ZeroCrossings.default(" + sr + ")"),
        metadata: config.description
    };
});

export function create() {
    return new feats.LocalModuleRequestHandler(...factories); // TODO this is assuming feats is loaded on the page, what about node??
}