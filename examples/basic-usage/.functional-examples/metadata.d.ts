/**
 * Auto-generated metadata types from config and plugins.
 * Do not edit manually - regenerate with: functional-examples generate
 *
 * This file augments the ExampleMetadataRegistry interface to provide
 * type-safe metadata for all Example types in your project.
 *
 * Include this file in your tsconfig.json to enable type checking.
 */

// PluginReference is imported so it is in scope inside augmentation blocks.
import type { PluginReference } from '@functional-examples/devkit';

declare module '@functional-examples/devkit' {
  interface ExampleMetadataRegistry {
    metadata: {
      include?: Array<string>;
      tags?: Array<string>;
      id: string;
      title: string;
      description?: string;
    };
  }

  interface PluginOptionsRegistry {
    plugins:
      | "@functional-examples/javascript"
      | ["@functional-examples/javascript", { skipFrontmatter?: boolean; skipRegions?: boolean; regionTag?: {
        start?: string;
        end?: string;
      }; skipExtraction?: boolean }]
      | "@functional-examples/yaml-manifest"
      | PluginReference;
  }
}
