import type { Reporter, TestResult } from './types.js';
import type { Example } from 'functional-examples';

function countTests(examples: Example[]): number {
  return examples.reduce((sum, e) => {
    const test = (e.metadata as { test?: unknown })?.test;
    if (!test) return sum;
    return sum + (Array.isArray(test) ? test.length : 1);
  }, 0);
}

export function createTapReporter(): Reporter {
  let testNumber = 0;

  return {
    start(examples) {
      const total = countTests(examples);
      console.log('TAP version 14');
      console.log(`1..${total}`);
    },

    report(result, _verbose) {
      testNumber++;
      const status = result.passed ? 'ok' : 'not ok';
      const name = `${result.example} > ${result.test}`;

      console.log(`${status} ${testNumber} - ${name}`);

      if (!result.passed) {
        console.log('  ---');
        if (result.error) {
          const escaped = result.error.replace(/"/g, '\\"');
          console.log(`  message: "${escaped}"`);
        }
        if (result.actual) {
          console.log(`  actual_exit_code: ${result.actual.exitCode}`);
          if (result.actual.stdout) {
            console.log('  stdout: |');
            result.actual.stdout.split('\n').forEach((line) => {
              console.log(`    ${line}`);
            });
          }
          if (result.actual.stderr) {
            console.log('  stderr: |');
            result.actual.stderr.split('\n').forEach((line) => {
              console.log(`    ${line}`);
            });
          }
        }
        console.log('  ...');
      }
    },

    finish({ passed, failed }) {
      console.log(`# tests ${passed + failed}`);
      console.log(`# pass ${passed}`);
      console.log(`# fail ${failed}`);
    },
  };
}
