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
      docs?: {
        template?: string;
        skip?: boolean;
        outputName?: string;
        hunks?: Record<string, string>;
      };
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
}
