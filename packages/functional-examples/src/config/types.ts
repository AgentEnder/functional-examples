/**
 * Configuration types - re-exported from devkit for backwards compatibility
 */

import type { BaseMetadata } from '@functional-examples/devkit';

export type {
  BaseMetadata,
  Config,
  ConfigWithRoot,
  Extractor,
  ExtractorConfig,
  ExtractorConfigOrFunction,
  ExtractorReference,
  GenerateConfig,
  JSONSchemaObject,
  PathMapping,
  Plugin,
  ScanConfig,
} from '@functional-examples/devkit';

/**
 * @deprecated Use Extractor from @functional-examples/devkit
 */
export interface MetadataExtractorFunction<
  TMetadata extends BaseMetadata = BaseMetadata
> {
  (context: unknown, options?: Record<string, unknown>): Promise<{
    metadata: TMetadata;
    files: unknown[];
  }>;
  name?: string;
  canExtract?: (context: unknown) => boolean | Promise<boolean>;
}
