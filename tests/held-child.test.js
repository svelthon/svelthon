// A component a tag holds rather than names by its import, one the script
// assigned or one a snippet's parameter reaches, is read once, as Svelte reads
// a tag, and each prop crosses for the child it turned out to be. `bind:group`
// on a component crosses as any other binding does.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import AssignedChildParent from './fixtures/AssignedChildParent.svelte';
import HeldChildGetter from './fixtures/HeldChildGetter.svelte';
import GroupPropParent from './fixtures/GroupPropParent.svelte';
import ShadowedPythonChild from './fixtures/ShadowedPythonChild.svelte';
import ShadowedNativeChild from './fixtures/ShadowedNativeChild.svelte';

test('a name the script assigned hands each child the values of its language', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(AssignedChildParent, { target });
    flushSync();

    const read = (child, kind) => target.querySelector(`[data-r="${child}"] [data-k="${kind}"]`).textContent;

    for (const kind of ['named', 'short', 'spread', 'bound']) {
        expect(read('python', kind)).toBe('float|15.0');
        expect(read('native', kind)).toBe('number|15');
    }
});

test.for([
    ['Python', ShadowedPythonChild, 'float|15.0'],
    ['JavaScript', ShadowedNativeChild, 'number|15']
])('the %s child a getter gives is read once for two props', ([, Child, shown]) => {
    let reads = 0;
    const holder = {
        get Child() {
            reads += 1;
            if (reads > 1) throw new Error('read twice');
            return Child;
        }
    };
    const target = document.body.appendChild(document.createElement('div'));
    mount(HeldChildGetter, { target, props: { holder } });
    flushSync();

    expect(target.querySelector('[data-k="held"]').textContent.trim()).toBe(shown);
    expect(reads).toBe(1);
});

test.for([
    ['short', 'float', 'number|0.25'],
    ['long', 'float', 'number|0.25'],
    ['short', 'none', 'undefined|undefined'],
    ['long', 'none', 'undefined|undefined']
])('bind:group on a component crosses both ways, %s form, %s', ([form, kind, shown]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const parent = mount(GroupPropParent, { target, props: { form, kind } });
    flushSync();

    expect(target.textContent.trim()).toBe(shown);

    parent.write();
    flushSync();

    expect(parent.model()).toBe('float|0.25');
    expect(target.textContent.trim()).toBe('number|0.25');
});
