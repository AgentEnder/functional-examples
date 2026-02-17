// #_region full-config
import { createJavaScriptPlugin } from '@functional-examples/javascript';
import { createTestPlugin } from '@functional-examples/test';
import { createDocumentationPlugin } from '@functional-examples/documentation';

export default {
  plugins: [
    createJavaScriptPlugin(),    // extracts from frontmatter or package.json
    createTestPlugin(),          // reads metadata.test for assertions
    createDocumentationPlugin(), // adds doc generation
  ],
};
// #_endregion full-config
