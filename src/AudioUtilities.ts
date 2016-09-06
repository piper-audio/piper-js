import {Feature} from "./Feature";
import {ProcessBlock} from "./PluginServer";

/**
 * Created by lucas on 02/09/2016.
 */

export function batchProcess(blocks: ProcessBlock[],
			     process: (block: ProcessBlock) => Promise<Feature[][]>)
: Promise<Feature[][]> {

    const processPromises: (Promise<Feature[][]>)[] =
	blocks.map((block) => process(block));
    
    return processPromises.reduce(
	(runningFeatures, nextBlock) => {
            return runningFeatures.then((features) => {
		return concatFeatures(features, nextBlock);
            });
	},
	Promise.resolve([]));
}

function concatFeatures(running: Feature[][],
			nextBlock: Promise<Feature[][]>)
: Promise<Feature[][]> {

    return nextBlock.then((block) => {
        return running.concat(block);
    });
}

