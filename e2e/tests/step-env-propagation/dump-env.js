// Prints specified env vars as KEY=VALUE lines
const keys = (process.env.DUMP_KEYS || '').split(',').filter(Boolean);
for (const key of keys) {
  console.log(`${key}=${process.env[key] ?? '<unset>'}`);
}
