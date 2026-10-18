// **A child held under an attribute is read as Python reads it.** A tag
// `<Holder.Child />`, or `<row.Child />` inside a block, was written as
// JavaScript reads it: an instance's attribute, a slot, a property or a
// class's name was the property of that name, undefined, and the child was not
// there; one a dict or a JavaScript object held was found, and not read again
// once swapped. The same child read into a name first, through a `@derived`,
// is the witness, and what each child shows: `Price|EUR` for a `Price` a
// Python child keeps, `number|0.50` for the number a JavaScript child is
// handed.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import HeldThroughAttribute from './fixtures/HeldThroughAttribute.svelte';

const SHOWN = ['Price|EUR', 'number|0.50', 'Price|EUR', 'number|0.50'];

test.for(
    ['instance', 'slots', 'property', 'class', 'dict', 'javascript'].flatMap((kind) =>
        ['direct', 'row', 'alias'].map((mode) => [kind, mode])
    )
)('a child held by %s, written %s, is the child, and follows a swap', ([kind, mode]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(HeldThroughAttribute, { target, props: { kind, mode } });
    flushSync();

    const states = [target.textContent.trim()];

    for (let at = 0; at < 3; at++) {
        instance.swap();
        flushSync();
        states.push(target.textContent.trim());
    }

    expect(states).toEqual(SHOWN);
});
