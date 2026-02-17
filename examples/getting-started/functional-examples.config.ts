// #_region config
import { createJavaScriptPlugin } from '@functional-examples/javascript';

export default {
  plugins: [createJavaScriptPlugin()],
  scan: {
    include: ['src/**/*'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
};
// #_endregion config
