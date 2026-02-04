/**
 * Configuration types with Zod schemas for runtime validation
 */

import { z } from 'zod';
import type { ExtractorReference } from './types.js';

export const ExtractorConfigSchema = z.object({
  name: z.string().min(1),
  module: z.string().min(1),
  options: z.record(z.string(), z.unknown()).optional(),
});

// Schema for extractor instance (already created)
export const ExtractorInstanceSchema = z.object({
  name: z.string().min(1),
  extract: z.function(),
});

export const ExtractorReferenceSchema: z.ZodType<ExtractorReference> = z.union([
  z.string().min(1),
  ExtractorConfigSchema,
]);

// Schema that accepts both references and instances
export const ExtractorOrReferenceSchema = z.union([
  z.string().min(1),
  ExtractorConfigSchema,
  ExtractorInstanceSchema,
]);

export const ScanConfigSchema = z.object({
  include: z.array(z.string().min(1)).optional(),
  exclude: z.array(z.string().min(1)).optional(),
  recursive: z.boolean().optional(),
  fileExtensions: z.array(z.string().min(1)).optional(),
});

export const ConfigSchema = () =>
  z.object({
    extractors: z.array(ExtractorOrReferenceSchema).optional(),
    scan: ScanConfigSchema.optional(),
    pathMappings: z
      .array(
        z.object({
          pattern: z.string().min(1),
          extractor: z.string().min(1),
        })
      )
      .optional(),
  });

export type ConfigSchemaType = z.infer<ReturnType<typeof ConfigSchema>>;
