import { describe, it, expect } from 'vitest';
import type { ExampleFile } from '@functional-examples/devkit';
import { ConsumptionTracker } from './consumption-tracker.js';

function makeFile(relativePath: string): ExampleFile {
  return {
    absolutePath: `/tmp/test/${relativePath}`,
    relativePath,
    raw: `// ${relativePath}`,
  };
}

describe('ConsumptionTracker', () => {
  it('should start with nothing consumed', () => {
    const tracker = new ConsumptionTracker();
    expect(tracker.isConsumed('index.ts')).toBe(false);
  });

  it('should mark a file as consumed', () => {
    const tracker = new ConsumptionTracker();
    tracker.consume('index.ts');
    expect(tracker.isConsumed('index.ts')).toBe(true);
  });

  it('should not affect other files when consuming one', () => {
    const tracker = new ConsumptionTracker();
    tracker.consume('index.ts');
    expect(tracker.isConsumed('utils.ts')).toBe(false);
  });

  it('should return only unconsumed files', () => {
    const tracker = new ConsumptionTracker();
    const files = [makeFile('index.ts'), makeFile('utils.ts'), makeFile('README.md')];

    tracker.consume('index.ts');
    tracker.consume('README.md');

    const unconsumed = tracker.getUnconsumedFiles(files);
    expect(unconsumed).toHaveLength(1);
    expect(unconsumed[0].relativePath).toBe('utils.ts');
  });

  it('should return all files when nothing is consumed', () => {
    const tracker = new ConsumptionTracker();
    const files = [makeFile('a.ts'), makeFile('b.ts')];

    expect(tracker.getUnconsumedFiles(files)).toHaveLength(2);
  });

  it('should return empty array when all files are consumed', () => {
    const tracker = new ConsumptionTracker();
    const files = [makeFile('a.ts')];

    tracker.consume('a.ts');
    expect(tracker.getUnconsumedFiles(files)).toHaveLength(0);
  });

  it('should handle consuming the same file twice gracefully', () => {
    const tracker = new ConsumptionTracker();
    tracker.consume('index.ts');
    tracker.consume('index.ts');
    expect(tracker.isConsumed('index.ts')).toBe(true);
  });
});
