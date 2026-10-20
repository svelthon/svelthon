// Prints the code one component compiles to, for `compile-determinism.test.js`
// to compare across processes.
import { compile } from '../../src/lib/compile.js';
import { SOURCE } from './compile-output-source.js';

process.stdout.write(compile(SOURCE, 'Counter', 'src/Counter.svelte', {}).module);
