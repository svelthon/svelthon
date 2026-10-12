// @vitest-environment node
//
// A source map is shipped with every compiled module and, until this file
// decoded one, nothing had ever read a segment of it. The tests asserted that
// `sources[0]` held the right filename and that `mappings` began with a `;`,
// which is the envelope rather than the contents.
//
// What that left unheld is the arithmetic. `mappings` is one string: groups
// separated by `;` are the *generated* lines in order, and the four numbers in a
// segment are **deltas** from the segment before, base64 VLQ, five bits at a
// time with a sixth bit meaning "another chunk follows". So a wrong delta, a
// wrong sign or a missing continuation gives a map that is well-formed and
// points at the wrong lines, which fails no test and raises nothing: the
// debugger simply opens the right file at the wrong place, and the author
// concludes that debugging Python does not work very well.
import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';

import { withPrelude } from '../src/lib/svelthon.js';

const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// The decoder is deliberately written from the spec rather than from `vlq()`, so
// that it can disagree with it.
function decode(mappings) {
    const out = [];
    let source = 0;

    mappings.split(';').forEach((group, generated) => {
        if (!group) return;

        for (const segment of group.split(',')) {
            const numbers = [];
            let at = 0;

            while (at < segment.length) {
                let shift = 0;
                let value = 0;
                let digit;

                do {
                    digit = CHARS.indexOf(segment[at++]);
                    value |= (digit & 31) << shift;
                    shift += 5;
                } while (digit & 32);

                numbers.push(value & 1 ? -(value >> 1) : value >> 1);
            }

            source += numbers[2];
            out.push({ generated, source, segment });
        }
    });

    return out;
}

// Six assignments, then a `def`, so the map has to walk forward and then jump.
const SOURCE = `${[0, 1, 2, 3, 4, 5].map((n) => `x${n} = ${n}`).join('\n')}\n\ndef go():\n    return x0\n`;

const mapped = (lineOffset) => {
    const { map, module } = compile(SOURCE, 'P', 'src/P.svelte', { lineOffset });
    const lines = module.split('\n');

    return {
        segments: decode(map.mappings),
        writes: (name) =>
            decode(map.mappings).find((one) =>
                new RegExp(`locals_[\\w]*\\.${name} =`).test(lines[one.generated] ?? '')
            )
    };
};

describe('the mappings decode to the lines they claim', () => {
    test('every segment points inside the Python that was compiled', () => {
        const { segments } = mapped(0);

        expect(segments.length).toBeGreaterThan(20);
        // Nine lines of source, and nothing may point outside them.
        for (const one of segments) {
            expect(one.source).toBeGreaterThanOrEqual(0);
            expect(one.source).toBeLessThan(9);
        }
    });

    // The assertion that would catch a delta out by one, which is the failure a
    // debugger shows and no other test can see.
    test.for([[0], [1], [4], [5]])('the line writing x%s maps to its own line', ([n]) => {
        expect(mapped(0).writes(`x${n}`).source).toBe(n);
    });

    test('the def and its body come after the blank line, in order', () => {
        const reached = [...new Set(mapped(0).segments.map((one) => one.source))];

        expect(reached).toEqual([0, 1, 2, 3, 4, 5, 7, 8]);
    });
});

// `lineOffset` is how many lines sit above `<script lang="python">`, and the
// *first* segment's delta is counted from zero, so it carries that number whole.
// Under 16 it fits in one base64 digit; at 16 it needs two, and the second is
// what the continuation bit is for.
//
// Measured: `AAAA` at 0, `AAUA` at 10, `AAgBA` at 16. The only test in the suite
// that passed a `lineOffset` passed 10, and asserted on an error message.
describe('a component whose Python starts far down the file', () => {
    test('the first segment stays one digit below sixteen', () => {
        expect(mapped(10).segments[0].segment).toHaveLength(4);
    });

    test('and takes a second digit from sixteen on', () => {
        expect(mapped(16).segments[0].segment).toHaveLength(5);
        expect(mapped(30).segments[0].segment).toHaveLength(5);
    });

    test.for([[16], [30], [200]])('and the whole map still decodes, at %s', ([offset]) => {
        const { writes } = mapped(offset);

        expect(writes('x0').source).toBe(offset);
        expect(writes('x4').source).toBe(offset + 4);
    });

    test('so an offset moves every line and changes nothing else', () => {
        const plain = mapped(0).segments.map((one) => one.source);
        const moved = mapped(30).segments.map((one) => one.source - 30);

        expect(moved).toEqual(plain);
    });

    // `vlq()` encodes a sign, and nothing here ever asks it to. `sourceMap()`
    // walks the generated lines in order and Brython's `set_lineno` markers only
    // ever move forward within a module, so every delta is positive or zero.
    // Measured across all 114 Python fixtures: not one negative delta.
    //
    // The sign handling stays, because `vlq` is a VLQ encoder and a VLQ encoder
    // signs. What this test is for is the day that stops being true: it fails
    // pointing at this paragraph, and whoever reads it knows the sign path has
    // just become reachable and is held by nothing.
    test('and nothing ever asks the encoder to go backwards', () => {
        const sources = mapped(0).segments.map((one) => one.source);

        for (let at = 1; at < sources.length; at++) {
            expect(sources[at]).toBeGreaterThanOrEqual(sources[at - 1]);
        }
    });
});

// A module that imports Python gets a prelude prepended, one `import` line per
// module, evaluated before init() so its import statements find them. The source map has to
// move down by as many, or a debugger opens the file that many lines off.

describe('a generated module behind its prelude', () => {
    const map = { version: 3, sources: ['a.py'], mappings: 'AAAA;AACA' };
    const lead = (m) => m.mappings.match(/^;*/)[0].length;

    test('no prelude leaves both alone', () => {
        const out = withPrelude('BODY', map, '');
        expect(out.code).toBe('BODY');
        expect(out.map).toBe(map);
    });

    test('one import costs one line', () =>
        expect(lead(withPrelude('BODY', map, 'import "a.py";').map)).toBe(1));

    // This is the one that was wrong: a single `;` was prepended whatever the
    // count, so two modules put every mapping one line too high.
    test('two imports cost two', () =>
        expect(lead(withPrelude('BODY', map, 'import "a.py";\nimport "b.py";').map)).toBe(2));

    test('four imports cost four', () =>
        expect(lead(withPrelude('BODY', map, 'a;\nb;\nc;\nd;').map)).toBe(4));

    test('the prelude ends up above the module', () =>
        expect(withPrelude('BODY', map, 'a;\nb;').code).toBe('a;\nb;\nBODY'));

    test('the rest of the map is untouched', () =>
        expect(withPrelude('BODY', map, 'a;').map).toEqual({ ...map, mappings: ';AAAA;AACA' }));
});
