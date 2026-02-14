// #_region error-script
const args = process.argv.slice(2);

if (args.includes('--fail')) {
  console.error('Error: intentional failure');
  process.exit(1);
}

console.log('No failure triggered');
// #_endregion error-script
