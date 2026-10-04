// An object JavaScript puts into a Python container through its view. It was
// kept as the JavaScript object it was, so the insertion was followed and the
// next write to it was not: `rows.push({n: 2})` showed 2, `rows.at(-1).n = 3`
// changed the data and left the page on 2. Svelte makes a proxy of a plain
// object or an array put into its state, and of nothing else, which is the
// witness here: each step is flushed and read on its own.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ViewInsertedData from './fixtures/ViewInsertedData.svelte';
import ViewInsertedDataNative from './fixtures/ViewInsertedDataNative.svelte';

const mounted = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target });
    flushSync();

    const shown = () =>
        Object.fromEntries([...target.querySelectorAll('output')].map((one) => [one.dataset.k, one.textContent]));

    return { values: instance.values(), shown };
};

const STEPS = [
    ['a row pushed', (values) => values.rows.push({ n: 2 })],
    ['then written', (values) => (values.rows.at(-1).n = 3)],
    ['a nested object replaced', (values) => (values.record.nested = { n: 2 })],
    ['then written', (values) => (values.record.nested.n = 3)],
    ['an array pushed and written', (values) => (values.rows.push({ n: [4] }), (values.rows.at(-1).n = 5))]
];

test('an object put in by JavaScript is followed like the ones Python made, as in Svelte', () => {
    const python = mounted(ViewInsertedData);
    const native = mounted(ViewInsertedDataNative);

    for (const [step, write] of STEPS) {
        write(python.values);
        write(native.values);
        flushSync();

        expect(python.shown(), step).toEqual(native.shown());
    }
});

// A view already handed out, put back inside a new object, is the container it
// stands for and not a copy of it: the object holds the same dict, and a later
// write to the dict is seen through both.
test('a view nested in an object put in stays the container it is, as in Svelte', () => {
    const shared = (values) => {
        values.rows.push({ n: 0, item: values.record });
        const same = values.rows.at(-1).item === values.record;
        values.record.nested = { n: 9 };
        return [same, values.rows.at(-1).item.nested.n];
    };

    expect(shared(mounted(ViewInsertedData).values)).toEqual(shared(mounted(ViewInsertedDataNative).values));
    expect(shared(mounted(ViewInsertedData).values)).toEqual([true, 9]);
});

// The line Svelte draws: a plain object put in comes back as another object, a
// class instance as itself.
test('and only a plain object is taken in: an instance keeps its identity', () => {
    const python = mounted(ViewInsertedData);
    const native = mounted(ViewInsertedDataNative);
    const plain = { n: 6 };
    const instance = new (class Row {
        n = 7;
    })();

    const kept = (values) => {
        values.rows.push(plain);
        const first = values.rows.at(-1) === plain;
        values.rows.push(instance);
        return [first, values.rows.at(-1) === instance];
    };

    expect(kept(python.values)).toEqual(kept(native.values));
});
