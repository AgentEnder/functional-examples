import type { Example, ResolvedConfig } from '@functional-examples/devkit';
import { cli } from 'cli-forge';
import { cacheKey, createTestCache } from '../cache.js';
import { normalizeTests, runTest } from '../runner.js';
import type { TestCase } from '../schema.js';
import { TestMetadata, testMetadataSchema } from '../schema.js';
import type { ResolvedTestPluginOptions } from '../types.js';
import { typedFilter } from '../utils.js';

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

type TestableExample = Example & { metadata: { test: TestCase | TestCase[] } };

function filterToFailedTests(
  examples: TestableExample[],
  failedKeys: Set<string>
): TestableExample[] {
  const result: TestableExample[] = [];
  for (const example of examples) {
    const tests = normalizeTests(example.metadata.test).filter((t) =>
      failedKeys.has(cacheKey(example.id, t.name))
    );
    if (tests.length > 0) {
      result.push({ ...example, metadata: { ...example.metadata, test: tests } });
    }
  }
  return result;
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
        })
        .option('onlyFailed', {
          type: 'boolean',
          description: 'Only run tests that failed in the previous run',
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

      const cache = createTestCache();

      if (args.verbose) {
        if (cache) {
          console.log(`Cache: ${cache.path}`);
          const summary = cache.statusSummary();
          const total = summary.passed + summary.failed + summary['not-started'];
          if (total > 0) {
            console.log(
              `Cache status: ${total} entries — ${summary.passed} passed, ${summary.failed} failed, ${summary['not-started']} not-started`
            );
          } else {
            console.log('Cache status: empty (first run)');
          }
        } else {
          console.log('Cache: unavailable (no node_modules found)');
        }
      }

      // Scan for examples
      const { scanExamples } = await import('functional-examples');
      const { examples, errors } = await scanExamples<TestMetadata>(config);

      if (errors.length) {
        for (const error of errors) {
          console.error(`Error in ${error}: ${error.message}`);
        }
        process.exit(1);
      }

      // Filter to examples with tests
      let testableExamples = typedFilter(examples, hasTests);

      if (args.verbose) {
        const testCount = testableExamples.reduce(
          (sum, e) => sum + normalizeTests(e.metadata.test).length,
          0
        );
        console.log(`Found ${testCount} test${testCount !== 1 ? 's' : ''} across ${testableExamples.length} example${testableExamples.length !== 1 ? 's' : ''}`);
      }

      // Apply filter pattern
      if (args.filter) {
        const pattern = args.filter.toLowerCase();
        testableExamples = testableExamples.filter(
          (e) =>
            e.id.toLowerCase().includes(pattern) ||
            e.rootPath.toLowerCase().includes(pattern)
        );
        if (args.verbose) {
          const testCount = testableExamples.reduce(
            (sum, e) => sum + normalizeTests(e.metadata.test).length,
            0
          );
          console.log(`After --filter: ${testCount} test${testCount !== 1 ? 's' : ''} across ${testableExamples.length} example${testableExamples.length !== 1 ? 's' : ''}`);
        }
      }

      if (args.onlyFailed) {
        if (!cache) {
          console.error(
            'No cache found — cannot use --only-failed without a previous run'
          );
          process.exit(1);
        }
        testableExamples = filterToFailedTests(testableExamples, cache.nonPassedKeys());
        if (args.verbose) {
          const testCount = testableExamples.reduce(
            (sum, e) => sum + normalizeTests(e.metadata.test).length,
            0
          );
          console.log(`After --only-failed: ${testCount} test${testCount !== 1 ? 's' : ''} to re-run`);
        }
      }

      if (testableExamples.length === 0) {
        console.log(
          args.onlyFailed
            ? 'No previously failed tests found'
            : 'No examples with tests found'
        );
        process.exit(0);
      }

      await reporter.start(testableExamples);

      let passed = 0;
      let failed = 0;

      // Mark every test as not-started before the run begins. If the run is
      // interrupted (bail, crash, Ctrl-C) those tests remain as not-started
      // and --only-failed will correctly include them next time.
      if (cache) {
        for (const example of testableExamples) {
          for (const testCase of normalizeTests(example.metadata.test)) {
            cache.record(example.id, testCase.name, 'not-started');
          }
        }
      }

      for (const example of testableExamples) {
        if (!example.metadata.test) {
          continue;
        }

        const tests = normalizeTests(example.metadata.test);

        for (const testCase of tests) {
          const result = await runTest(example.id, example.rootPath, testCase, {
            timeout: args.timeout,
            config,
            updateSnapshots: args['update-snapshots'],
          });

          cache?.record(example.id, testCase.name, result.passed ? 'passed' : 'failed');
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
