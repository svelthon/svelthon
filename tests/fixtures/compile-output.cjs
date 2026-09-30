// Prints the code one component compiles to, for `compile-determinism.test.js`
// to compare across processes.
const { compile } = require('../../src/lib/compile.cjs');
const { SOURCE } = require('./compile-output-source.cjs');

process.stdout.write(compile(SOURCE, 'Counter', 'src/Counter.svelte', {}).module);
