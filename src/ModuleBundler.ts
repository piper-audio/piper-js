// /**
//  * Created by lucast on 16/09/2016.
//  */
// import * as glob from "glob";
// import {LocalModuleRequestHandler, PluginFactory, FeatureExtractorFactory} from "./LocalModuleRequestHandler";
// import {StaticData} from "./ClientServer";
// import * as path from "path";
// import {ZeroCrossings} from "../plugins/example-module/zero-crossings/src/ZeroCrossings";
//
// export function locateConfigFiles(pluginBasePath: string): string[] {
//     const configFilePaths = glob.sync(pluginBasePath + '/**/feats-config.json', {realpath: true});
//     if (configFilePaths.length === 0) throw Error("No config files were found.");
//     return configFilePaths;
// }
//
// export function createModuleRequestHandler(configFilePaths: string[]): LocalModuleRequestHandler {
//     const createFactory: (className: string) => FeatureExtractorFactory = (className: string) => {
//         return (sr: number) => eval("new " + className + "(" + sr + ")"); // TODO i'm sorry
//     };
//     const factories: PluginFactory[] = configFilePaths.map(configFilePath => {
//         new ZeroCrossings(44100);
//         const config: {main: string, description: StaticData} = require(configFilePath);
//         const extractorClass: string = path.basename(config.main, '.ts');
//         console.log(createFactory(extractorClass)(44100));
//         return {extractor: createFactory(extractorClass), metadata: config.description} as PluginFactory;
//     });
//     return new LocalModuleRequestHandler(...factories);
// }