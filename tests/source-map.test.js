// @vitest-environment node
//
// A module that imports Python gets a prelude prepended — one `import` line per
// module, evaluated before init() so the namespaces exist. The source map has to
// move down by as many, or a debugger opens the file that many lines off.
import { test, expect, describe } from 'vitest';
import { withPrelude } from '../src/lib/svelthon.js';

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
