// @vitest-environment node
//
// A component that imports Python modules gets a prelude prepended to its
// generated module — one `import` line per module. The source map has to move
// down by as many, or a debugger opens the file that many lines off.
import { test, expect, describe } from 'vitest';
import { shifted } from '../src/lib/svelthon.js';

describe('the source map of a module with a prelude', () => {
    const map = { version: 3, sources: ['a.py'], mappings: 'AAAA;AACA' };
    const lead = (m) => m.mappings.match(/^;*/)[0].length;

    // What `${prelude}\n${module}` prepends: the prelude, then its newline.
    test('no import still costs the separating newline', () =>
        expect(lead(shifted(map, '\n'))).toBe(1));

    test('one import costs one line', () =>
        expect(lead(shifted(map, 'import "a.py";\n'))).toBe(1));

    // This is the one that was wrong: a single `;` was prepended whatever the
    // count, so two modules put every mapping one line too high.
    test('two imports cost two', () =>
        expect(lead(shifted(map, 'import "a.py";\nimport "b.py";\n'))).toBe(2));

    test('four imports cost four', () =>
        expect(lead(shifted(map, 'a;\nb;\nc;\nd;\n'))).toBe(4));

    test('the rest of the map is untouched', () =>
        expect(shifted(map, '\n')).toEqual({ ...map, mappings: ';AAAA;AACA' }));
});
