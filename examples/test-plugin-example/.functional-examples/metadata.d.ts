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
      test?: {
        name: string;
        options: {
          cwd?: string;
          env?: Record<string, string>;
          timeout?: number;
          command: string;
          maintainVTSequences?: boolean;
          outputSnapshot?: {
            path: string;
            stdout?: boolean;
            stderr?: boolean;
            exitCode?: boolean;
            ansi?: boolean;
          };
        };
        assertions?: unknown;
      } | {
        name: string;
        options?: {
          cwd?: string;
          env?: Record<string, string>;
          timeout?: number;
        };
        steps: Array<{
          command: string;
          cwd?: string;
          env?: Record<string, string>;
          timeout?: number;
          assertions?: unknown;
          maintainVTSequences?: boolean;
          outputSnapshot?: {
            path: string;
            stdout?: boolean;
            stderr?: boolean;
            exitCode?: boolean;
            ansi?: boolean;
          };
        }>;
      } | Array<{
        name: string;
        options: {
          cwd?: string;
          env?: Record<string, string>;
          timeout?: number;
          command: string;
          maintainVTSequences?: boolean;
          outputSnapshot?: {
            path: string;
            stdout?: boolean;
            stderr?: boolean;
            exitCode?: boolean;
            ansi?: boolean;
          };
        };
        assertions?: unknown;
      } | {
        name: string;
        options?: {
          cwd?: string;
          env?: Record<string, string>;
          timeout?: number;
        };
        steps: Array<{
          command: string;
          cwd?: string;
          env?: Record<string, string>;
          timeout?: number;
          assertions?: unknown;
          maintainVTSequences?: boolean;
          outputSnapshot?: {
            path: string;
            stdout?: boolean;
            stderr?: boolean;
            exitCode?: boolean;
            ansi?: boolean;
          };
        }>;
      }>;
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
      | "@functional-examples/test"
      | PluginReference;
  }
}
