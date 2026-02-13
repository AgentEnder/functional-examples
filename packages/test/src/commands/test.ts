import { cli } from 'cli-forge';
import type { Example, ResolvedConfig } from '@functional-examples/devkit';
import { scanExamples } from 'functional-examples';
import { normalizeTests, runTest } from '../runner.js';
import type { TestCase } from '../schema.js';
import { TestMetadata, testMetadataSchema } from '../schema.js';
import type { ResolvedTestPluginOptions } from '../types.js';

function isCI(): boolean {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.JENKINS_URL ||
    process.env.TRAVIS
  );
}

function hasTests(
  example: Example
): example is Example & { metadata: { test: TestCase | TestCase[] } } {
  const result = testMetadataSchema.safeParse(example.metadata);
  return result.success && result.data.test !== undefined;
}

export function createTestCommand(
  config: ResolvedConfig,
  pluginOpts: ResolvedTestPluginOptions
) {
  const { reporters, defaultReporter, ciReporter, timeout } = pluginOpts;

  return cli('$0', {
    description: 'Run tests for functional examples',
    builder: (cmd) =>
      cmd
        .option('path', {
          type: 'string',
          alias: ['p'],
          description: 'Path to examples directory',
          default: '.',
        })
        .option('filter', {
          type: 'string',
          alias: ['f'],
          description: 'Filter examples by id pattern',
        })
        .option('bail', {
          type: 'boolean',
          alias: ['b'],
          description: 'Stop on first failure',
          default: false,
        })
        .option('verbose', {
          type: 'boolean',
          alias: ['v'],
          description: 'Show command output even on success',
          default: false,
        })
        .option('format', {
          type: 'string',
          description: `Output format (default: ${defaultReporter} in TTY, ${ciReporter} in CI)`,
        })
        .option('timeout', {
          type: 'number',
          description: 'Default timeout in ms',
          default: timeout,
        })
        .option('update-snapshots', {
          type: 'boolean',
          alias: ['u'],
          description: 'Update snapshot files with actual content',
          default: false,
        }),
    handler: async (args) => {
      const formatName = args.format ?? (isCI() ? ciReporter : defaultReporter);
      const reporterFactory = reporters[formatName];

      if (!reporterFactory) {
        console.error(`Unknown reporter: ${formatName}`);
        console.error(`Available: ${Object.keys(reporters).join(', ')}`);
        process.exit(1);
      }

      const reporter = reporterFactory();

      // Scan for examples
      const { examples, errors } = await scanExamples<TestMetadata>(config);

      if (errors.length) {
        for (const error of errors) {
          console.error(`Error in ${error}: ${error.message}`);
        }
        process.exit(1);
      }

      // Filter to examples with tests
      let testableExamples = examples.filter(hasTests);

      // Apply filter pattern
      if (args.filter) {
        const pattern = args.filter.toLowerCase();
        testableExamples = testableExamples.filter(
          (e) =>
            e.id.toLowerCase().includes(pattern) ||
            e.rootPath.toLowerCase().includes(pattern)
        );
      }

      if (testableExamples.length === 0) {
        console.log('No examples with tests found');
        process.exit(0);
      }

      await reporter.start(testableExamples);

      let passed = 0;
      let failed = 0;

      for (const example of testableExamples) {
        const tests = normalizeTests(example.metadata.test);

        for (const testCase of tests) {
          const result = await runTest(example.id, example.rootPath, testCase, {
            timeout: args.timeout,
            config,
            updateSnapshots: args['update-snapshots'],
          });

          await reporter.report(result, args.verbose);

          if (result.passed) {
            passed++;
          } else {
            failed++;
            if (args.bail) {
              await reporter.finish({ passed, failed, bail: true });
              process.exit(1);
            }
          }
        }
      }

      await reporter.finish({ passed, failed });
      process.exit(failed > 0 ? 1 : 0);
    },
  });
}
