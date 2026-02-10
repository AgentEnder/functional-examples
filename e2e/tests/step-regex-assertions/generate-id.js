// Generates a pseudo-random hex ID and a timestamp
const id = Math.random().toString(16).slice(2, 10);
const ts = Date.now();
console.log(`id=${id} ts=${ts}`);
