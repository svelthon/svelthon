import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import NumericKeys from './fixtures/NumericKeys.svelte';

// The type of a key decided whether the dict's children were reactive.
//
// A Brython dict keeps its string keys as ordinary JavaScript properties and
// everything else in a hash table, and both the initial walk and the `.values()`
// hand-over read the properties. So the child of `{"one": []}` was watched and
// the child of `{1: []}` was not: appending to it changed the data and left the
// page showing the old one, until some later write to the dict itself revealed
// both at once.
//
// The same confusion between the JavaScript view and the Python content that
// `urlencode` met, one layer down.
describe('a dict indexed by number', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(NumericKeys, { target });
        flushSync();

        return {
            read: (k) => target.querySelector(`p[data-k="${k}"]`).textContent,
            click: (k) => {
                target.querySelector(`button[data-k="${k}"]`).click();
                flushSync();
            }
        };
    };

    test('shows a child mutated through .values()', () => {
        const { read, click } = setup();

        expect(read('numeric')).toBe('{1: []}');
        click('number');
        expect(read('numeric')).toBe('{1: [3]}');
    });

    // The control the audit used: the same operation on a string key was
    // already right, which is what made the defect look like nothing at all.
    test('as a dict indexed by text already did', () => {
        const { read, click } = setup();

        click('text');
        expect(read('textual')).toBe("{'one': [3]}");
    });
});
