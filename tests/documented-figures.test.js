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

import { test, expect, describe } from 'vitest';

const english = readFileSync('README.md', 'utf8');
const french = readFileSync('README.fr.md', 'utf8');

// The figure a document states, read back out of it: asserting against a
// constant here would only prove the constant.
const stated = (text, pattern) => Number(text.match(pattern)[1].replace(/\s/g, ''));

describe('the sizes the documents claim', () => {
    // The engine's own size is Bryntime's to state, and its README holds it.

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
            readFileSync('demo/App.svelte', 'utf8').match(
                /<strong>(\d+) KB<\/strong> gzip, runtime included/
            )[1]
        );

        expect(shown).toBe(stated(english, /production build: \*\*(\d+) KB gzip\*\*/));
    });
});

// The size of the callable matrix, which both READMEs state to say how far the
// rule about a callable's fields has been checked.
//
// It is here because it drifted **in the writing**: the sentence went in saying
// six shapes and twelve positions on the day the file held seven and thirteen,
// and the figure was a day old by the time it was read back. A number in prose
// beside a list that grows is a number that will be wrong.
describe('the size of the matrix the documents claim', () => {
    const matrix = readFileSync('tests/callable-matrix.test.js', 'utf8');

    // Every entry of either list begins with its label, and a label is the only
    // quoted string at the head of one — whether the entry fits on a line or is
    // written over four.
    const entries = (name) => {
        const from = matrix.indexOf(`const ${name} = [`);
        const list = matrix.slice(from, matrix.indexOf('\n];', from));

        return (list.match(/^\s{4}\[\s*$|^\s{4}\['/gm) || []).length;
    };

    test.for([
        ['README.md', english, /across \*\*(\d+) shapes\*\*/, /\*\*(\d+)\n?positions\*\*/],
        ['README.fr.md', french, /sur \*\*(\d+) formes\*\*/, /\*\*(\d+)\n?positions\*\*/]
    ])('%s states what the matrix holds', ([, text, shapes, positions]) => {
        expect(stated(text, shapes)).toBe(entries('SHAPES'));
        expect(stated(text, positions)).toBe(entries('POSITIONS'));
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
        ['README.md', () => stated(english, /Validated by `npm test`, ([\d\s]+?) tests as written/)],
        ['README.fr.md', () => stated(french, /Validé par `npm test`, ([\d\s]+?) tests écrits/)]
    ])('%s states a count within reach of the files', ([, read]) => {
        expect(read()).toBeGreaterThanOrEqual(counted);
    });
});
