// @vitest-environment node
//
// The numbers the READMEs and the demo state, held against what they describe.
//
// They were hard-coded and had drifted: the runtime was called 255 KB when that
// was the *full* bundle, which has not shipped since it was split in two, while
// the half a browser gets is smaller by fifty. The build figure differed
// between the README and the demo. An outside reading found both, which is the
// tell that no test was holding them.
//
// A figure in prose cannot be recomputed at build time when it describes the
// build itself, so the answer is not to generate it but to make it fail loudly
// when it stops being true.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

import { test, expect, describe } from 'vitest';

const KIB = 1024;
const english = readFileSync('README.md', 'utf8');
const french = readFileSync('README.fr.md', 'utf8');

// The figure a document states, read back out of it: asserting against a
// constant here would only prove the constant.
const stated = (text, pattern) => Number(text.match(pattern)[1].replace(/\s/g, ''));

describe('the sizes the documents claim', () => {
    // The half a browser actually receives, which is what "the runtime" means to
    // a reader: `boot.js` loads this file and no other.
    const runtime = gzipSync(readFileSync('vendor/brython_runtime.js')).length / KIB;

    test.for([
        ['README.md', () => stated(english, /The whole runtime, gzipped, is \*\*(\d+) KB\*\*/)],
        ['README.fr.md', () => stated(french, /Le runtime entier, gzippé, fait \*\*(\d+) Ko\*\*/)]
    ])('%s states the size of the runtime that ships', ([, read]) => {
        expect(read()).toBe(Math.round(runtime));
    });

    // And the bundle it is cut from, named in the same sentence so a reader can
    // see what the split buys. It does not ship, so it is not in `files`.
    test('and the size of the one that does not', () => {
        const full = gzipSync(readFileSync('build/brython.js')).length / KIB;

        expect(stated(english, /the full bundle it is cut from is (\d+) KB/)).toBe(Math.round(full));
    });

    // The two documents have to agree with each other, which is the drift an
    // outside reading found first: one said 250, the other 255.
    test('the two READMEs agree on the production build', () => {
        const build = /production build: \*\*(\d+) KB gzip\*\*/;
        const fr = /build de production : \*\*(\d+) Ko gzip\*\*/;

        expect(stated(french, fr)).toBe(stated(english, build));
    });

    // The demo prints the same number in the page, and it is the one that had
    // drifted furthest from the README.
    test('and the demo prints the number the README states', () => {
        const shown = Number(
            readFileSync('src/App.svelte', 'utf8').match(
                /<strong>(\d+) KB<\/strong> gzip, runtime included/
            )[1]
        );

        expect(shown).toBe(stated(english, /production build: \*\*(\d+) KB gzip\*\*/));
    });
});

describe('the test count the documents claim', () => {
    // The same counter the demo's stats module uses, so the number in the page
    // and the number in the prose cannot disagree either.
    const counted = (existsSync('tests') ? readdirSync('tests') : [])
        .filter((name) => name.endsWith('.test.js'))
        .reduce(
            (total, name) =>
                total +
                (readFileSync(`tests/${name}`, 'utf8').match(/^\s*test(\.fails)?\(/gm) || []).length,
            0
        );

    // Not the number vitest reports: a `test.for` row counts once here and many
    // times there. What matters is that the prose moves when the suite does, so
    // the two documents are held against the same count rather than against a
    // total nobody can compute without running everything.
    test.for([
        ['README.md', () => stated(english, /npm test\s+# ([\d\s]+?) tests: semantics/)],
        ['README.fr.md', () => stated(french, /npm test\s+# ([\d\s]+?) tests : sémantique/)]
    ])('%s states a count within reach of the files', ([, read]) => {
        expect(read()).toBeGreaterThanOrEqual(counted);
    });
});
