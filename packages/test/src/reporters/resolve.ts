import type { ReporterFactory, ReporterConfig } from './types.js';
import { createPrettyReporter } from './pretty.js';
import { createTapReporter } from './tap.js';

export const BUILTIN_REPORTERS: Record<string, ReporterFactory> = {
  pretty: createPrettyReporter,
  tap: createTapReporter,
};

/**
 * Load a reporter from a module path
 */
async function loadReporterModule(modulePath: string): Promise<ReporterFactory> {
  try {
    const mod = await import(modulePath);
    const factory = mod.default ?? mod.reporter ?? mod.createReporter;

    if (typeof factory !== 'function') {
      throw new Error(
        `Reporter module "${modulePath}" must export a factory function ` +
          `as default, 'reporter', or 'createReporter'`
      );
    }

    return factory;
  } catch (err) {
    throw new Error(
      `Failed to load reporter from "${modulePath}": ${err instanceof Error ? err.message : err}`
    );
  }
}

/**
 * Resolve reporter configs to factory functions
 */
export async function resolveReporters(
  custom: Record<string, ReporterConfig> = {}
): Promise<Record<string, ReporterFactory>> {
  const resolved: Record<string, ReporterFactory> = { ...BUILTIN_REPORTERS };

  for (const [name, config] of Object.entries(custom)) {
    if (typeof config === 'function') {
      resolved[name] = config;
    } else if (typeof config === 'string') {
      resolved[name] = await loadReporterModule(config);
    }
  }

  return resolved;
}
