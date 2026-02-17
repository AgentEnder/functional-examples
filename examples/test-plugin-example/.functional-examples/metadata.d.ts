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
      test?: {
        name: string;
        options: {
          cwd?: string;
          env?: Record<string, string>;
          timeout?: number;
          command: string;
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
        }>;
      } | Array<{
        name: string;
        options: {
          cwd?: string;
          env?: Record<string, string>;
          timeout?: number;
          command: string;
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
        }>;
      }>;
      tags?: Array<string>;
      id: string;
      title: string;
      description?: string;
    };
  }
}
