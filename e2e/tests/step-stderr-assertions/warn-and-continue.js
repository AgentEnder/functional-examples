// Writes warnings to stderr but exits 0
const label = process.env.LABEL || 'default';
console.error(`[warn] ${label}: deprecated API usage`);
console.log(`${label} ok`);
