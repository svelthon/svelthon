// **An action's `update` runs at each change inside a state handed to it**, as
// Svelte reads an action's value through before comparing it. Svelthon hands
// Svelte the value inside the directive's array, which Svelte does not read
// into: a state of the parent's changed in place, as the value or inside a
// Python list, dict or instance, left the action on its first value while the
// page moved on. The witness is the same child in Svelte, its containers
// states and its instance a class's.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ActionState from './fixtures/ActionState.svelte';
import ActionStateNative from './fixtures/ActionStateNative.svelte';
import ActionStateHost from './fixtures/ActionStateHost.svelte';

// An instance holds its field in its `__dict__`, in its slots, or, a subclass
// with a `__dict__` of its own, in the slot it inherits; and inside a list, a
// dict or a tuple, where the walk of the container stopped at it. Or it reads
// the state by a property, which the walk did not run, as Svelte runs the
// getters of the prototype; one of a base's it does not, and neither does this.
// And a builtin's subclass of the author's, a container, a number, a string or
// bytes, whose property the walk did not run. A container's view shows its
// class's property to a JavaScript action too, as a subclass of Array shows
// its getter; a number, a string or bytes crosses as what it holds, and is read
// by the Python action alone.
const CONTAINERS = ['list', 'dict', 'set', 'tuple'].map((base) => `counted${base}`);
const SCALARS = ['int', 'float', 'str', 'bytes', 'bytearray'].map((base) => `counted${base}`);
const COUNTED = [...CONTAINERS, ...SCALARS];
const KINDS = [
    'direct', 'list', 'dict', 'nested', 'instance', 'slots', 'mixed', 'local', 'listbox', 'dictbox', 'tuplebox', 'listslots',
    'gauged', 'inherited', ...COUNTED
];

const READS = {
    direct: (value) => value.n,
    list: (value) => value[0].n,
    dict: (value) => value.child.n,
    nested: (value) => value.child.inner.n,
    instance: (value) => value.model.n,
    slots: (value) => value.model.n,
    mixed: (value) => value.model.n,
    local: (value) => value[0].n,
    listbox: (value) => value[0].model.n,
    dictbox: (value) => value.child.model.n,
    tuplebox: (value) => value[0].model.n,
    listslots: (value) => value[0].model.n,
    gauged: (value) => value[0].amount,
    inherited: (value) => value[0].amount,
    ...Object.fromEntries(COUNTED.map((kind) => [kind, (value) => value[0].amount]))
};

const LAST = { local: ['local', 'update', 2], inherited: ['inherited', 'install', 1] };

const run = (Child, python_action) => {
    const target = document.body.appendChild(document.createElement('div'));
    const log = [];
    const report = (...args) => log.push(args);
    const read = (kind, value) => READS[kind](value);
    const observe = (node, value) => {
        const kind = node.dataset.k;

        report(kind, 'install', read(kind, value));

        return {
            update(given) {
                report(kind, 'update', read(kind, given));
            }
        };
    };
    const host = mount(ActionStateHost, { target, props: { Child, observe, report, python_action } });

    flushSync();
    host.bump();
    flushSync();
    host.bump();
    flushSync();
    host.local();
    flushSync();

    return { log, page: target.querySelector('p').textContent };
};

test.for(KINDS.flatMap((kind) => [...(SCALARS.includes(kind) ? [] : [['JavaScript', kind]]), ['Python', kind]]))(
    'a %s action handed a state (%s) is updated at each change inside it, as in Svelte',
    ([action, kind]) => {
        const native = run(ActionStateNative, false);
        const python = run(ActionState, action === 'Python');
        const of = (seen) => seen.log.filter(([one]) => one === kind);

        expect(of(python)).toEqual(of(native));
        expect(python.page).toBe(native.page);
        expect(of(native).at(-1)).toEqual(LAST[kind] ?? [kind, 'update', 3]);
    }
);
