// **A descriptor's own state is what the name it is stored under holds**, so
// changing it repaints what read the name. The value read was followed, and the
// name replaced, but a `__get__` computing a number from the descriptor's state
// handed back a value nothing linked to that state: `Row.value.n = 1` changed
// what Python read and left the page on 0. And whatever `__get__` hands back:
// a function, a bound method or a callable instance was taken for a method,
// whose descriptor holds nothing that changes, and was not followed either.
// The witness is CPython, which reads 0, 1, 2 from the same script, and the
// page is asserted, not the model, which was right throughout. Each reader is
// mounted alone: a read through the class would otherwise follow the name for
// a read through an instance.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import DescriptorOwnState from './fixtures/DescriptorOwnState.svelte';

const READERS = ['instance', 'class', 'made', 'super'];
const SHAPES = ['value', 'function', 'method', 'callable'];

const CASES = READERS.flatMap((reader) =>
    SHAPES.flatMap((shape) => [
        [reader, shape, 'a number', false],
        [reader, shape, 'a list', true]
    ])
);

test.for(CASES)("a descriptor's state changed in place repaints what read it (%s, %s, %s)", ([reader, shape, , by_list]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const host = mount(DescriptorOwnState, { target, props: { by_list, reader, shape } });
    const seen = [];

    flushSync();
    seen.push(target.querySelector('output').textContent);
    for (const step of [1, 2]) {
        host.change(step);
        flushSync();
        seen.push(target.querySelector('output').textContent);
    }

    expect(seen).toEqual(['0', '1', '2']);
});
