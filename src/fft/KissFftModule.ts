import {EmscriptenModule} from '../emscripten';

const factory: () => EmscriptenModule = require('./KissFft');
export default factory;
export const KissFft = factory;