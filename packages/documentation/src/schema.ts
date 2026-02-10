import { z } from 'zod';
import type { ValidationResult } from '@functional-examples/devkit';

/**
 * Zod schema for documentation-specific metadata.
 */
export const docsMetadataSchema = z.object({
  docs: z
    .strictObject({
      template: z.string().optional(),
      skip: z.boolean().optional(),
      outputName: z.string().optional(),
      /** Descriptions for specific hunks/regions, keyed by hunk ID */
      hunks: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});

export type DocsMetadataSchemaType = z.infer<typeof docsMetadataSchema>;

/** JSON Schema for metadata plugin registration */
export const DOCS_METADATA_JSON_SCHEMA = z.toJSONSchema(docsMetadataSchema);

/**
 * Zod schema for documentation plugin options.
 * Fields with defaults are resolved via `docsOptionsSchema.parse(...)`.
 */
export const docsOptionsSchema = z.object({
  outputDir: z.string().default('./docs/examples'),
  format: z.enum(['markdown', 'mdoc']).default('markdown'),
  templates: z.string().optional(),
  enableExtractor: z.boolean().default(false),
});

/** JSON Schema for options plugin registration */
export const DOCS_OPTIONS_JSON_SCHEMA = z.toJSONSchema(docsOptionsSchema);

function mapZodIssue(
  zIssue: z.core.$ZodIssue
): ValidationResult['errors'][number] {
  return {
    path: zIssue.path.join('.'),
    message: zIssue.message,
  };
}

/**
 * Validate documentation metadata using Zod schema.
 */
export function validateDocsMetadata(metadata: unknown): ValidationResult {
  const result = docsMetadataSchema.safeParse(metadata);
  if (result.success) {
    return { success: true, errors: [] };
  }

  return {
    success: false,
    errors: result.error.issues.map(mapZodIssue),
  };
}

// ── Types (formerly types.ts) ─────────────────────────────────────────

/** Options for the documentation plugin factory (input — all optional). */
export type DocumentationPluginOptions = z.input<typeof docsOptionsSchema>;

/** Resolved options with defaults applied (output of parsing). */
export type ResolvedDocumentationPluginOptions = z.output<
  typeof docsOptionsSchema
>;

/**
 * Documentation-specific metadata that examples can declare.
 */
export interface DocsMetadata {
  docs?: DocsMetadataSchemaType;
}
