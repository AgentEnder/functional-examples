/**
 * Auto-generated metadata types from config and plugins.
 * Do not edit manually - regenerate with: functional-examples generate
 *
 * This file augments the ExampleMetadataRegistry interface to provide
 * type-safe metadata for all Example types in your project.
 *
 * Include this file in your tsconfig.json to enable type checking.
 */

// Import required to make this an augmentation rather than a replacement
import '@functional-examples/devkit';

declare module '@functional-examples/devkit' {
  interface ExampleMetadataRegistry {
    metadata: {
      docs?: {
        template?: string;
        skip?: boolean;
        outputName?: string;
        hunks?: Record<string, string>;
      };
      tags?: Array<string>;
      id: string;
      title: string;
      description?: string;
    };
  }
}
