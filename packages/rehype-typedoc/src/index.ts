export {
  default,
  default as rehypeTypedoc,
  type RehypeTypedocOptions,
  type RehypeTypedocSymbol,
  type SymbolEntry,
} from './plugin.js';

export {
  default as rehypeTypedocCodeBlocks,
} from './code-blocks.js';

export {
  default as remarkCodeProps,
} from './remark-code-props.js';

export type { RemarkCodePropsOptions } from './remark-code-props.js';

export {
  buildSymbolsFromDocuments,
  type TypeDocDocument,
} from './build-symbols.js';
