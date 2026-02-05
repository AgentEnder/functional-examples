import { cli } from 'cli-forge';
import type { ResolvedConfig, Example } from 'functional-examples';
import { scanExamples } from 'functional-examples';
import type { TestCase } from '../schema.js';
import { testMetadataSchema } from '../schema.js';
import { normalizeTests } from '../runner.js';

function hasTests(
  example: Example
): example is Example & { metadata: { test: TestCase | TestCase[] } } {
  const result = testMetadataSchema.safeParse(example.metadata);
  return result.success && result.data.test !== undefined;
}

export function createListCommand(config: ResolvedConfig) {
  return cli('list', {
    description: 'List available tests',
    builder: (cmd) =>
      cmd
        .option('path', {
          type: 'string',
          alias: ['p'],
          description: 'Path to examples directory',
          default: '.',
        })
        .option('format', {
          type: 'string',
          choices: ['table', 'json'] as const,
          description: 'Output format',
          default: 'table' as const,
        }),
    handler: async (args) => {
      const { examples } = await scanExamples({
        root: args.path ?? '.',
        plugins: config.plugins,
        pathMappings: config.pathMappings,
        include: config.scan.include,
        exclude: config.scan.exclude,
      });

      const testableExamples = examples.filter(hasTests);

      const testList = testableExamples.flatMap((example) => {
        const tests = normalizeTests(example.metadata.test);
        return tests.map((t) => ({
          example: example.id,
          test: t.name,
          command: t.options.command,
        }));
      });

      if (args.format === 'json') {
        console.log(JSON.stringify(testList, null, 2));
        return;
      }

      // Table format
      if (testList.length === 0) {
        console.log('No tests found');
        return;
      }

      console.log('Example'.padEnd(30) + 'Test'.padEnd(30) + 'Command');
      console.log('-'.repeat(80));

      for (const t of testList) {
        console.log(
          t.example.slice(0, 28).padEnd(30) +
            t.test.slice(0, 28).padEnd(30) +
            t.command
        );
      }
    },
  });
}
