import type { Reporter, TestResult, TestSummary } from './types.js';
import type { Example } from 'functional-examples';

const PASS = '\x1b[32m PASS \x1b[0m';
const FAIL = '\x1b[31m FAIL \x1b[0m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';

function countTests(examples: Example[]): number {
  return examples.reduce((sum, e) => {
    const test = (e.metadata as { test?: unknown })?.test;
    if (!test) return sum;
    return sum + (Array.isArray(test) ? test.length : 1);
  }, 0);
}

export function createPrettyReporter(): Reporter {
  return {
    start(examples) {
      const testCount = countTests(examples);
      console.log(
        `\nRunning ${testCount} test${testCount !== 1 ? 's' : ''} from ${examples.length} example${examples.length !== 1 ? 's' : ''}\n`
      );
    },

    report(result, verbose) {
      const status = result.passed ? PASS : FAIL;
      const duration = `${DIM}(${result.duration}ms)${RESET}`;

      console.log(`${status} ${result.example} > ${result.test} ${duration}`);

      if (!result.passed && result.error) {
        const indented = result.error
          .split('\n')
          .map((line) => `       ${line}`)
          .join('\n');
        console.log(indented);
        if (result.actual) {
          console.log(`       ${DIM}Exit code: ${result.actual.exitCode}${RESET}`);
        }
      }

      if (verbose && result.passed && result.actual) {
        if (result.actual.stdout) {
          const truncated = result.actual.stdout.slice(0, 200);
          console.log(`       ${DIM}stdout: ${truncated}${RESET}`);
        }
      }
    },

    finish({ passed, failed, bail }) {
      console.log('');
      if (bail) {
        console.log(`${YELLOW}Bailed after first failure${RESET}\n`);
      }

      const parts: string[] = [];
      if (failed > 0) parts.push(`${RED}${failed} failed${RESET}`);
      if (passed > 0) parts.push(`${GREEN}${passed} passed${RESET}`);
      parts.push(`${passed + failed} total`);

      console.log(`Tests: ${parts.join(', ')}`);
    },
  };
}
