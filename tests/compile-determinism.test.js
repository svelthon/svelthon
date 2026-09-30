// @vitest-environment node
//
// One source compiles to one text. Brython numbers the functions and lambdas it
// generates from a counter and a tag it draws at random per process; the
// compiler draws them from the file's path instead, so a build is reproducible
// and a cache keyed on content keeps its hits.
import { test, expect, describe } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { compile } = require('../src/lib/compile.cjs');
const { SOURCE } = require('./fixtures/compile-output-source.cjs');

const compiled = (source = 'src/Counter.svelte') => compile(SOURCE, 'Counter', source, {}).module;

test('twice in one process, the same code', () => {
    expect(compiled()).toBe(compiled());
});

// The range each file draws from differs, so two files still name their
// functions apart, as Brython's random start meant them to.
test('two files, two sets of names', () => {
    const names = (text) => new Set(text.match(/\bincrement\d+/g));
    const [one] = names(compiled('src/Counter.svelte'));
    const [other] = names(compiled('src/Other.svelte'));

    expect(one).toBeDefined();
    expect(one).not.toBe(other);
});

// Asked once, because spawning is not everyone's to do; see
// `boot-conditions.test.js`.
const canSpawn = (() => {
    try {
        execFileSync(process.execPath, ['-e', ''], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
})();

// The lambda's tag is drawn once per process, so only two processes show it.
describe.skipIf(!canSpawn)('across processes', () => {
    test('two processes, the same code', () => {
        const run = () => execFileSync(process.execPath, ['tests/fixtures/compile-output.cjs'], { encoding: 'utf8' });
        const first = run();

        expect(first).toMatch(/lambda_/);
        expect(run()).toBe(first);
    });
});
