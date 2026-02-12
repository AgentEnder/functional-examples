import type { Config } from 'vike/types';

import type { TypedocContext } from './context.js';
import type { LoadTypedocContextOptions } from './server.js';

declare global {
  namespace Vike {
    interface Config {
      /** Configuration for vike-plugin-typedoc. */
      typedoc?: LoadTypedocContextOptions;
    }
    interface GlobalContextServer {
      $$VIKE_PLUGIN_TYPEDOC$$?: TypedocContext;
    }
  }
}

export default {
  name: 'vike-plugin-typedoc',
  require: {
    vike: '>=0.4.250',
  },
  onCreateGlobalContext:
    'import:vike-plugin-typedoc/__internal/hooks/onCreateGlobalContext:onCreateGlobalContext',
  onBeforePrerenderStart:
    'import:vike-plugin-typedoc/__internal/hooks/onBeforePrerenderStart:onBeforePrerenderStart',
  meta: {
    typedoc: {
      env: { server: true },
      global: true,
    },
    onCreateGlobalContext: {
      env: { server: true },
    },
    onBeforePrerenderStart: {
      env: { server: true },
    },
  },
} satisfies Config;
