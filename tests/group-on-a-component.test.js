import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import GroupHost from './fixtures/GroupHost.svelte';

// `bind:group` is rewritten into an action, and every word of the argument for
// that is about `<input>`: Svelte works out which inputs form one group from the
// text of the expression, so a getter/setter pair has nothing to compare.
//
// A component has no group machinery at all. Svelte reads `bind:group={x}` there
// as the prop of that name, like any other. The rewrite was applied to the tag
// kind it was never written for, and Svelte refused its own output with "This
// type of directive is not valid on components" — so the component did not
// compile.
describe('bind:group on a component', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(GroupHost, { target });
        flushSync();

        return {
            read: (k) => target.querySelector(`[data-k="${k}"]`).textContent,
            click: (k) => {
                target.querySelector(`[data-k="${k}"]`).click();
                flushSync();
            }
        };
    };

    test('it compiles, and binds the prop of that name', () => {
        const { read } = setup();

        expect(read('parent')).toBe('a');
        expect(read('child')).toBe('a');
    });

    test('and the binding writes back, like any other prop', () => {
        const { read, click } = setup();

        click('pick');

        expect(read('child')).toBe('z');
        expect(read('parent')).toBe('z');
    });
});
