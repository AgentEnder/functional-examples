// This file documents plugin extension point patterns.

// #_region schemas
const schemas = {
  options: {
    /* JSON Schema for plugin options */
  },
  metadata: {
    /* JSON Schema for metadata fields */
  },
};
// #_endregion schemas

// #_region validators
const validators = {
  validateOptions(_options: unknown) {
    return { success: true, errors: [] as string[] };
  },
  validateMetadata(_metadata: unknown) {
    return { success: true, errors: [] as string[] };
  },
};
// #_endregion validators

// #_region commands
const commands = [
  {
    name: 'my-command',
    description: 'Does something useful',
    handler: async (_args: unknown) => {
      /* ... */
    },
  },
];
// #_endregion commands

export { schemas, validators, commands };
