// The only module in the extension that imports from ./mock/fabric.
// Production swap: replace the below import with `import * as fabric from 'fabric';`
import * as fabric from './mock/fabric';
export default fabric;
