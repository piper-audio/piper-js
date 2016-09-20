/**
 * Created by lucast on 19/09/2016.
 */
import {ModuleRequestHandler, Request, Response, ProcessEncoding} from "./ClientServer";


export class LocalModuleRequestHandler implements ModuleRequestHandler {

    public handle(request: Request): Promise<Response> {
        return undefined;
    }

    public getProcessEncoding(): ProcessEncoding {
        return ProcessEncoding.Raw;
    }

    // TODO this all belongs somewhere else, as it is essentially the server and could be remote

    // list is basically a dump of each plugins static data (from config)
    //     - StaticData

    // load instantiates the given plugin (pluginKey, need a map) using the sampleRate provided, adapterFlags are used for channel adapting stuff etc
    //     - LoadResponse, some handle for the plugin is returned, so I guess need something like the CountingHandle from VamPipe
    //

    // configure, will call initialised on the plugin (which currently doesn't exist, and also this is forcing the API to be like Vamp plugins, but not many ways to do this really)
    //     - ConfigurationResponse

    // process, should be a direct call to process, may need to alter the shape of the return (not sure)
    //     - ProcessResponse (there is no JSON schema for this, but copy the shape of the latest VamPipe)

    // finish, directly call finish
    //     - ProcessResponse?
}