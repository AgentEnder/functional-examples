import type { Example, ResolvedConfig } from '@functional-examples/devkit';
import { cli } from 'cli-forge';
import { scanExamples } from 'functional-examples';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { ResolvedDocumentationPluginOptions } from '../schema.js';
import { docsMetadataSchema } from '../schema.js';
import type { TemplateDescriptor } from '../templates/engine.js';
import {
  loadTemplates,
  renderIndexTemplate,
  renderItemTemplate,
  renderTemplate,
} from '../templates/engine.js';

function shouldSkip(example: Example): boolean {
  const result = docsMetadataSchema.safeParse(example.metadata);
  if (result.success && result.data.docs?.skip) {
    return true;
  }
  return false;
}

function getOutputName(example: Example): string | undefined {
  const result = docsMetadataSchema.safeParse(example.metadata);
  if (result.success) {
    return result.data.docs?.outputName;
  }
  return undefined;
}

function getPerExampleTemplate(example: Example): string | undefined {
  const result = docsMetadataSchema.safeParse(example.metadata);
  if (result.success) {
    return result.data.docs?.template;
  }
  return undefined;
}

/** Ensure the parent directory of a file path exists. */
async function ensureParentDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

/** Map CLI format names to template file extensions. */
const FORMAT_TO_EXT: Record<string, string> = {
  markdown: '.md',
  mdoc: '.mdoc',
};

export function createGenerateCommand(
  config: ResolvedConfig,
  pluginOpts: ResolvedDocumentationPluginOptions
) {
  return cli('$0', {
    description: 'Generate documentation from functional examples',
    builder: (cmd) =>
      cmd
        .option('output', {
          type: 'string',
          alias: ['o'],
          description: 'Output directory',
          default: pluginOpts.outputDir,
        })
        .option('format', {
          type: 'string',
          alias: ['f'],
          description: 'Output format: markdown | mdoc',
          default: pluginOpts.format,
        })
        .option('templates', {
          type: 'string',
          alias: ['t'],
          description: 'Path to custom templates directory',
        })
        .option('filter', {
          type: 'string',
          description: 'Filter examples by id pattern',
        })
        .option('dry-run', {
          type: 'boolean',
          description: 'Show what would be generated without writing files',
          default: false,
        })
        .option('clean', {
          type: 'boolean',
          description: 'Remove output directory before generating',
          default: false,
        })
        .option('check', {
          type: 'boolean',
          description:
            'Verify generated docs are up-to-date (exit code 1 if stale)',
          default: false,
        }),
    handler: async (args) => {
      const format = (args.format === 'mdoc' ? 'mdoc' : 'markdown') as
        | 'markdown'
        | 'mdoc';
      const outputDir = path.resolve(args.output);
      const customTemplatesDir = args.templates ?? pluginOpts.templates;

      // Load templates — custom directory or built-in filtered by format
      let templates: TemplateDescriptor[];
      if (customTemplatesDir) {
        templates = await loadTemplates(path.resolve(customTemplatesDir));
      } else {
        const all = await loadTemplates();
        const ext = FORMAT_TO_EXT[format] ?? '.md';
        templates = all.filter((t) => t.format === ext);
      }

      // Scan for examples
      const { examples, errors } = await scanExamples(config);

      if (errors.length) {
        for (const error of errors) {
          console.error(`Error: ${error.message}`);
        }
        process.exit(1);
      }

      // Filter out skipped examples
      let docsExamples = examples.filter((e) => !shouldSkip(e));

      // Apply filter pattern
      if (args.filter) {
        const pattern = args.filter.toLowerCase();
        docsExamples = docsExamples.filter(
          (e) =>
            e.id.toLowerCase().includes(pattern) ||
            e.rootPath.toLowerCase().includes(pattern)
        );
      }

      if (docsExamples.length === 0) {
        console.log('No examples found for documentation generation');
        return;
      }

      // ── --check mode: compare rendered output against existing files ──
      if (args.check) {
        const staleFiles: string[] = [];

        for (const template of templates) {
          if (template.perItem) {
            for (const example of docsExamples) {
              const perExampleTemplate = getPerExampleTemplate(example);
              if (perExampleTemplate) {
                // Per-example override: use custom template file directly
                const outputName = getOutputName(example) ?? example.id;
                const ext = template.format;
                const outputFile = path.join(outputDir, `${outputName}${ext}`);
                const rendered = await renderTemplate(
                  example,
                  perExampleTemplate
                );

                let existing: string | undefined;
                try {
                  existing = await fs.readFile(outputFile, 'utf-8');
                } catch {
                  // file doesn't exist yet
                }
                if (existing !== rendered) {
                  staleFiles.push(outputFile);
                }
              } else {
                const result = await renderItemTemplate(template, example);
                const outputName = getOutputName(example);
                const relativePath = outputName
                  ? `${outputName}${template.format}`
                  : result.relativePath;
                const outputFile = path.join(outputDir, relativePath);

                let existing: string | undefined;
                try {
                  existing = await fs.readFile(outputFile, 'utf-8');
                } catch {
                  // file doesn't exist yet
                }
                if (existing !== result.content) {
                  staleFiles.push(outputFile);
                }
              }
            }
          } else {
            const result = await renderIndexTemplate(template, docsExamples);
            const outputFile = path.join(outputDir, result.relativePath);

            let existing: string | undefined;
            try {
              existing = await fs.readFile(outputFile, 'utf-8');
            } catch {
              // file doesn't exist yet
            }
            if (existing !== result.content) {
              staleFiles.push(outputFile);
            }
          }
        }

        if (staleFiles.length > 0) {
          console.error(
            `Documentation is out of date. ${staleFiles.length} file(s) would change:`
          );
          for (const f of staleFiles) {
            console.error(`  ${f}`);
          }
          process.exit(1);
        }

        console.log('Documentation is up to date.');
        return;
      }

      // ── --dry-run / normal write mode ──

      // Clean output directory if requested
      if (args.clean && !args['dry-run']) {
        await fs.rm(outputDir, { recursive: true, force: true });
      }

      // Ensure output directory exists
      if (!args['dry-run']) {
        await fs.mkdir(outputDir, { recursive: true });
      }

      console.log(
        `Generating ${format} documentation for ${docsExamples.length} example(s)...`
      );

      for (const template of templates) {
        if (template.perItem) {
          for (const example of docsExamples) {
            const perExampleTemplate = getPerExampleTemplate(example);

            if (perExampleTemplate) {
              // Per-example template override
              const outputName = getOutputName(example) ?? example.id;
              const ext = template.format;
              const outputFile = path.join(outputDir, `${outputName}${ext}`);

              if (args['dry-run']) {
                console.log(`  [dry-run] ${outputFile}`);
                continue;
              }

              const rendered = await renderTemplate(
                example,
                perExampleTemplate
              );
              await ensureParentDir(outputFile);
              await fs.writeFile(outputFile, rendered, 'utf-8');
              console.log(`  ${outputFile}`);
            } else {
              const result = await renderItemTemplate(template, example);
              const outputName = getOutputName(example);
              const relativePath = outputName
                ? `${outputName}${template.format}`
                : result.relativePath;
              const outputFile = path.join(outputDir, relativePath);

              if (args['dry-run']) {
                console.log(`  [dry-run] ${outputFile}`);
                continue;
              }

              await ensureParentDir(outputFile);
              await fs.writeFile(outputFile, result.content, 'utf-8');
              console.log(`  ${outputFile}`);
            }
          }
        } else {
          const result = await renderIndexTemplate(template, docsExamples);
          const outputFile = path.join(outputDir, result.relativePath);

          if (args['dry-run']) {
            console.log(`  [dry-run] ${outputFile}`);
            continue;
          }

          await ensureParentDir(outputFile);
          await fs.writeFile(outputFile, result.content, 'utf-8');
          console.log(`  ${outputFile}`);
        }
      }

      if (!args['dry-run']) {
        console.log(`\nDone. ${docsExamples.length} example(s) documented.`);
      }
    },
  });
}
