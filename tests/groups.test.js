import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import Groups from './fixtures/Groups.svelte';

// `bind:group` is the one directive Svelte refuses a getter/setter pair for: it
// works out which inputs form a group from the *text* of the expression. Its own
// version writes with a plain JavaScript assignment, which lands on the object
// and never reaches `$B.$setitem` — so nothing re-renders, not even the effect
// that unfills the other buttons. Compiled to an action instead, the write goes
// back through Python and the group needs no identity at all.
describe('bind:group', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Groups, { target });
        flushSync();

        return {
            read: (k) => target.querySelector(`p[data-k="${k}"]`).textContent,
            click: (k) => {
                target.querySelector(`input[data-k="${k}"]`).click();
                flushSync();
            },
            filled: (prefix) =>
                [...target.querySelectorAll(`input[data-k^="${prefix}"]`)]
                    .filter((one) => one.checked)
                    .map((one) => one.dataset.k)
                    .join(' ')
        };
    };

    test('a bare name', () => {
        const { read, click, filled } = setup();

        expect(filled('n-')).toBe('n-a');
        click('n-b');
        expect(read('name')).toBe('b');
        expect(filled('n-')).toBe('n-b');
    });

    test('a field of a dict', () => {
        const { read, click, filled } = setup();

        click('d-c');
        expect(read('dict')).toBe('c');
        expect(filled('d-')).toBe('d-c');
    });

    test('an attribute of an object', () => {
        const { read, click, filled } = setup();

        // Neither half worked before: an instance's attributes are not
        // JavaScript properties, so the JavaScript expression saw nothing.
        expect(filled('o-')).toBe('o-a');
        click('o-b');
        expect(read('obj')).toBe('b');
        expect(filled('o-')).toBe('o-b');
    });

    test('a checkbox group collects into a list', () => {
        const { read, click, filled } = setup();

        click('t-a');
        click('t-c');
        expect(read('tags')).toBe("['a', 'c']");
        expect(filled('t-')).toBe('t-a t-c');

        click('t-a');
        expect(read('tags')).toBe("['c']");
    });

    test('and it is a Python list, not a JavaScript array', () => {
        // Svelte's own version assigns an array built in JavaScript, which reads
        // as a JavascriptArray: it prints `[a, c]`, refuses a slice, and is not
        // an instance of list.
        const { click, read } = setup();

        click('t-a');
        expect(read('tags-type')).toBe('list');
    });

    test('a checkbox group on a field of a dict', () => {
        const { read, click } = setup();

        click('s-b');
        expect(read('sheet')).toBe("['b']");
    });

    test('a checkbox group on an attribute of an object', () => {
        const { read, click } = setup();

        click('k-a');
        click('k-b');
        expect(read('basket')).toBe("['a', 'b']");
    });

    test('one group per row of an {#each}', () => {
        const { read, click, filled } = setup();

        expect(read('rows')).toBe('a/b');
        click('r0-c');
        expect(read('rows')).toBe('c/b');
        expect(filled('r0-')).toBe('r0-c');
        expect(filled('r1-')).toBe('r1-b');
    });
});
