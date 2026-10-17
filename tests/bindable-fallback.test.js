// **A bindable prop the parent leaves `undefined` reads its default**, as
// Svelte reads its fallback: bound or passed, cleared by the child or by the
// parent. A Python child that wrote `None` to a prop its parent binds read the
// `None` it wrote, where a Svelte child that writes `undefined` reads its
// default again, and so did the page. Without a parent that binds it, a child
// that clears its prop reads it cleared, in both.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import BindableFallback from './fixtures/BindableFallback.svelte';
import BindableFallbackNative from './fixtures/BindableFallbackNative.svelte';
import BindableFallbackHost from './fixtures/BindableFallbackHost.svelte';
import BindableFallbackPyHost from './fixtures/BindableFallbackPyHost.svelte';
import BindableFallbackPyHostNative from './fixtures/BindableFallbackPyHostNative.svelte';
import BindableFallbackPyHeld from './fixtures/BindableFallbackPyHeld.svelte';
import BindableFallbackKept from './fixtures/BindableFallbackKept.svelte';
import BindableFallbackKeptHost from './fixtures/BindableFallbackKeptHost.svelte';

const text = (target, key) => target.querySelector(`[data-k="${key}"]`)?.textContent;

// What the child's page and the parent's show, at mount and after each step.
const steps = (Component, props, actions) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props });
    const seen = [];
    const look = () => seen.push(`${text(target, 'child')}|${text(target, 'parent')}`);

    flushSync();
    look();
    for (const action of actions) {
        if (action === 'clear') instance.clear();
        else instance.set(action);
        flushSync();
        look();
    }

    return seen;
};

test.for([
    ['bound, cleared by the child', true, 'start', ['clear'], ['start|start', 'default|undefined']],
    ['bound, cleared by the parent', true, 'start', [undefined, 'x'], ['start|start', 'default|undefined', 'x|x']],
    ['passed, cleared by the parent', false, 'start', [undefined], ['start|start', 'default|undefined']],
    ['passed, cleared by the child', false, 'start', ['clear'], ['start|start', '|start']],
    ['passed nothing, then a value, then nothing', false, undefined, ['x', undefined], ['default|undefined', 'x|x', 'default|undefined']]
])('%s, the Python child reads what a Svelte child reads', ([, bound, start, actions, expected]) => {
    const native = steps(BindableFallbackHost, { Child: BindableFallbackNative, bound, start }, actions);

    expect(native).toEqual(expected);
    expect(steps(BindableFallbackHost, { Child: BindableFallback, bound, start }, actions)).toEqual(native);
});

// A Python parent holds None where a Svelte one holds `undefined`, and hands it
// on as `undefined`, to a child named by its import or held by a name.
test.for([
    ['cleared by the child', ['clear']],
    ['cleared by the parent', [undefined, 'x']]
])('bound by a Python parent, %s, the Python child reads what a Svelte child reads', ([, actions]) => {
    const native = steps(BindableFallbackPyHostNative, {}, actions);

    expect(native.slice(0, 2)).toEqual(['start|start', 'default|']);
    expect(steps(BindableFallbackPyHost, {}, actions)).toEqual(native);
    expect(steps(BindableFallbackPyHeld, { python: false }, actions)).toEqual(native);
    expect(steps(BindableFallbackPyHeld, { python: true }, actions)).toEqual(native);
});

test('a Python parent binding None to a prop with a default is refused at mount, as Svelte refuses undefined', () => {
    expect(() => steps(BindableFallbackPyHostNative, { empty: true }, [])).toThrow(/props_invalid_value/);
    expect(() => steps(BindableFallbackPyHost, { empty: true }, [])).toThrow(/props_invalid_value/);
});

test('a child with no parent that clears its prop reads it cleared, as a Svelte child does', () => {
    const native = steps(BindableFallbackNative, {}, ['clear']);

    expect(native).toEqual(['default|undefined', '|undefined']);
    expect(steps(BindableFallback, {}, ['clear'])).toEqual(native);
});

test('a parent binding undefined to a prop with a default is refused at mount, as Svelte refuses it', () => {
    const refused = (Child) => () => steps(BindableFallbackHost, { Child, bound: true, start: undefined }, []);

    expect(refused(BindableFallbackNative)).toThrow(/props_invalid_value/);
    expect(refused(BindableFallback)).toThrow(/props_invalid_value/);
});

// The default reads back as Python wrote it, a float as a float and a list as
// that list, and a value the parent passes as the parent's, the integer equal
// to the float included.
test('a default read again is the value Python wrote, and a value the parent passes is its own', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const host = mount(BindableFallbackKeptHost, { target, props: { start: 'x' } });

    flushSync();
    host.clear();
    flushSync();

    expect(text(target, 'child')).toBe('15.0|[1, 2]');
    expect(host.same()).toBe(true);

    const passed = document.body.appendChild(document.createElement('div'));

    mount(BindableFallbackKeptHost, { target: passed, props: { start: 15 } });
    flushSync();

    expect(text(passed, 'child')).toBe('15|15');
});

// The child's own write is what it reads, and not its default: the integer
// equal to the float its default is.
test('a child with no parent that writes the integer its float default crosses as reads that integer', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const child = mount(BindableFallbackKept, { target });

    flushSync();
    child.whole();

    expect(child.held()).toBe('15');
});