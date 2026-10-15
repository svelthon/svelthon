// **An `{#each}` walks its rows once**, as Python's `for` does: a JavaScript
// array whose iteration is a generator of its own yields what that generator
// yields, the first time it runs. Handed on as the array, it was walked by the
// watch and again by the block, which showed the second walk's rows, and an
// iterator that refuses a second walk stopped the page from mounting. And its
// `Symbol.iterator` is read once: a getter there chooses the iterator, and was
// asked again by the walk after the question whether the array had one.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { walked, looked } from './fixtures/stateful_rows.js';
import EachIterated from './fixtures/EachIterated.svelte';

// What the block showed and how often the array was walked and looked at, and
// the same of Python's `for` over a fresh array, the witness.
const shown = (kind) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(EachIterated, { target, props: { kind } });

    flushSync();

    const mine = {
        shown: [...target.querySelectorAll('span')].map((one) => one.textContent).join(' '),
        walks: walked(),
        looks: looked()
    };
    const python = { shown: instance.walked_by_python(), walks: walked(), looks: looked() };

    return { mine, python };
};

test('a JavaScript array with an iterator of its own is walked once, as Python walks it', () => {
    const { mine, python } = shown('own');

    expect(mine).toEqual(python);
    expect(mine).toEqual({ shown: '10 11', walks: 1, looks: 0 });
});

test('the iterator a getter chooses is chosen once, as Python chooses it', () => {
    const { mine, python } = shown('getter');

    expect(mine).toEqual(python);
    expect(mine).toEqual({ shown: '10 11', walks: 1, looks: 1 });
});
