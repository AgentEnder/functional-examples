// Simulates a tool that exits non-zero but writes useful info to stderr
console.error('Error: config file not found at ./missing.yml');
console.log('attempted: ./missing.yml');
process.exit(2);
