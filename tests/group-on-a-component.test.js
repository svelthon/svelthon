import { test, expect, describe } from 'vitest';
import { compile as compileSvelte } from 'svelte/compiler';
import { mount, flushSync } from './mounted.js';
import { overMarkup, pythonExpressions, collector } from '../src/lib/markup.js';
import '../src/lib/compile.js';
import GroupHost from './fixtures/GroupHost.svelte';
import GroupHostUnicode from './fixtures/GroupHostUnicode.svelte';

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

// The capital is Unicode's, as in Svelte's own rule: `<Étiquette>` and `<Δ>`
// were not read as tags at all, so the binding became an action and Svelte
// refused it on a component.
test('a component named past ASCII binds the prop too, in both spellings', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const read = (selector) => target.querySelector(selector).textContent;

    mount(GroupHostUnicode, { target });
    flushSync();

    expect([read('[data-k="long"] [data-k="child"]'), read('[data-k="short"] [data-k="child"]')]).toEqual(['a', 'b']);

    target.querySelector('[data-k="long"] [data-k="pick"]').click();
    target.querySelector('[data-k="short"] [data-k="pick"]').click();
    flushSync();

    expect([read('[data-k="chosen"]'), read('[data-k="group"]')]).toEqual(['z', 'z']);
});

// And on an element, an `<input>` alone, as Svelte has it (`bind_invalid_target`):
// the action the binding becomes is taken by any element, so a `<select>` or a
// `<div>` bound by `bind:group` compiled, bound to nothing. A `<svelte:element>`
// is refused too, as Svelte refuses it: its `type` was read once, and its
// server rendering knew no checkbox.
//
// And beside a `type` that is not text, as Svelte refuses it beside its own
// binding (`attribute_invalid_type`): the server took `type={kind}` for a radio
// and wrote no box checked, and the action, the shape its first type gave, so a
// checkbox become a radio wrote a list.
describe('bind:group on an element', () => {
    const rewrite = (markup) => overMarkup(markup, (source, at) => pythonExpressions(source, collector([]), undefined, at));

    test.for([
        ['<select bind:group={picked}><option value="a">a</option></select>'],
        ['<textarea bind:group={picked}></textarea>'],
        ['<div bind:group={picked}></div>'],
        ['<button bind:group={picked}></button>'],
        ['<svg bind:group={picked}></svg>'],
        ['<svelte:element this={tag} bind:group={picked} />']
    ])('%s is refused, as Svelte refuses it', ([markup]) => {
        expect(() => rewrite(markup)).toThrow(/`bind:group` can only be used with `<input>`/);
        expect(() => compileSvelte(`<script>let picked = $state([]);</script>${markup}`, { name: 'Probe' })).toThrow(
            /`bind:group` can only be used with `<input>`/
        );
    });

    test.for([
        ['<input type={kind} value="a" bind:group={picked} />'],
        ['<input type="{kind}" value="a" bind:group={picked} />'],
        ['<input {type} value="a" bind:group={picked} />'],
        ['<input type value="a" bind:group={picked} />'],
        ['<input type="check{kind}" value="a" bind:group={picked} />']
    ])('%s is refused, as Svelte refuses it', ([markup]) => {
        const refusal = /'type' attribute must be a static text value if input uses two-way binding/;

        expect(() => rewrite(markup)).toThrow(refusal);
        expect(() =>
            compileSvelte(`<script>let picked = $state([]); let kind = $state('checkbox'); let type = $state('radio');</script>${markup}`, {
                name: 'Probe'
            })
        ).toThrow(refusal);
    });

    test.for([
        ['<input type="checkbox" value="a" bind:group={picked} />'],
        ['<input type="radio" value="a" bind:group={picked} />'],
        ['<input type=checkbox value="a" bind:group={picked} />'],
        ['<input {**attrs} value="a" bind:group={picked} />']
    ])('%s keeps the binding', ([markup]) => {
        expect(rewrite(markup)).toContain('use:__group');
    });
});
