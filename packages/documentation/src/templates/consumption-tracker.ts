import type { ExampleFile } from '@functional-examples/devkit';

/**
 * Tracks which example files have been "consumed" by prose template helpers
 * (e.g. `file()` or `region()`). Consumed files are excluded from the
 * "remaining files" section in the rendered output.
 */
export class ConsumptionTracker {
  private consumed = new Set<string>();

  /** Mark a file as consumed by its relative path. */
  consume(relativePath: string): void {
    this.consumed.add(relativePath);
  }

  /** Check whether a file has been consumed. */
  isConsumed(relativePath: string): boolean {
    return this.consumed.has(relativePath);
  }

  /** Return only those files that have NOT been consumed. */
  getUnconsumedFiles(files: ExampleFile[]): ExampleFile[] {
    return files.filter((f) => !this.consumed.has(f.relativePath));
  }
}
