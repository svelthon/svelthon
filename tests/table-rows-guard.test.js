// The guard `table-rows-setup.js` puts on `test.for` lets a template table
// through with its values, and guards a modifier's `.for` as the base one: it
// took the table alone, so a template's values were lost, and `test.skip.for`
// and the rest were not guarded at all.
import { test, expect } from 'vitest';

test.for`
    a       | b
    ${0.5}  | ${'x'}
`('a template table hands its rows as objects, $a and $b', ({ a, b }) => {
    expect([a, b]).toEqual([0.5, 'x']);
});

test('a modifier’s table of strings read as arrays is refused too', () => {
    expect(() => test.skip.for(['first', 'second'])('rows', ([kind]) => kind)).toThrow(
        /its rows are no arrays, and its callback reads one as an array/
    );
});
