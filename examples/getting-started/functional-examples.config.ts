// #_region config
import { createJavaScriptPlugin } from '@functional-examples/javascript';

export default {
  plugins: [createJavaScriptPlugin()],
  scan: {
    root: 'src',
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
};
// #_endregion config
