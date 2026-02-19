/**
 * Auto-generated metadata types from config and plugins.
 * Do not edit manually - regenerate with: functional-examples generate
 *
 * This file augments the ExampleMetadataRegistry interface to provide
 * type-safe metadata for all Example types in your project.
 *
 * Include this file in your tsconfig.json to enable type checking.
 */

// export {} makes this file a TypeScript module so the augmentation below
// applies to the ambient module rather than replacing it.
export {};

declare module '@functional-examples/devkit' {
  interface ExampleMetadataRegistry {
    metadata: {
      id: string;
      title: string;
      description?: string;
      tags?: Array<string>;
    };
  }
}
