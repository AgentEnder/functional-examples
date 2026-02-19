import type { Reporter } from './types.js';
import type { Example } from '@functional-examples/devkit';

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

/** Indent each line of a string by a fixed prefix */
function indent(s: string, prefix: string): string {
  return s
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');
}

/** Write a block of raw command output, preserving color codes */
function writeOutputBlock(content: string): void {
  process.stdout.write(indent(content.trimEnd(), '       ') + '\n\n');
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
        if (result.actual) {
          if (result.exitCodeFailure) {
            // Exit-code failures: show interleaved output between the failure
            // label and the reason, so the user sees what the command printed
            // before reading the assertion message.
            if (result.actual.interleaved) {
              process.stdout.write(indent(result.actual.interleaved.trimEnd(), '       ') + '\n\n');
            }
          } else {
            // Other failures: show stdout and stderr separately.
            if (result.actual.stdout) {
              writeOutputBlock(result.actual.stdout);
            }
            if (result.actual.stderr) {
              writeOutputBlock(result.actual.stderr);
            }
          }
        }

        const indented = indent(result.error, '       ');
        console.log(indented + '\n');
      }

      if (verbose && result.passed && result.actual?.stdout) {
        writeOutputBlock(result.actual.stdout);
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
