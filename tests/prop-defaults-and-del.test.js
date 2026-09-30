// A container a component owns through a prop's default is its own state:
// Python mutates it in place and the page follows, and a `bindable` one stays
// the Python object it is. Svelte keeps its own copy of what a child writes
// into a bindable prop the parent did not bind, and wraps an array or a plain
// object it keeps in a state proxy, which a Brython list is; Python is handed
// its object back. And `del` removes a name the component or the module
// publishes, as it removes any global.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import PropDefaults from './fixtures/PropDefaults.svelte';
import PropDefaultsHost from './fixtures/PropDefaultsHost.svelte';
import { drop, read, restore } from './fixtures/deleted_globals.py';

const setup = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target });
    flushSync();
    return { instance, text: (key) => target.querySelector(`[data-k="${key}"]`).textContent };
};

test('defaults, bindable or not, are Python containers the page follows', () => {
    const { instance, text } = setup(PropDefaults);

    expect(instance.snapshot()).toBe('[]|{}|list');

    instance.mutate();
    flushSync();

    expect(instance.snapshot()).toBe("[1]|{'k': 2}|list");
    expect([text('rows'), text('table'), text('nested')]).toEqual(['[1]', "{'k': 2}", '[9]']);
});

test('an unbound bindable prop rebound by Python stays a list', () => {
    const { instance, text } = setup(PropDefaults);

    instance.reassign();
    flushSync();

    expect(instance.snapshot()).toBe('[5]|{}|list');
    expect(text('rows')).toBe('[5]');
});

test('a Python parent binding it sees the child mutate and rebind it, as a list', () => {
    const { instance, text } = setup(PropDefaultsHost);

    instance.child_mutate();
    flushSync();
    expect(instance.parent_view()).toBe('[1, 1]|list');
    expect(text('parent')).toBe('[1, 1]');

    instance.child_reassign();
    flushSync();
    expect(instance.parent_view()).toBe('[5]|list');
    expect(text('parent')).toBe('[5]');
});

test('del removes a name; rebinding it brings it back, and the page follows', () => {
    const { instance, text } = setup(PropDefaults);

    expect(instance.delete_then_rebind()).toBe('missing');
    flushSync();
    expect(text('count')).toBe('7');
});

test('del twice raises NameError, and a function can be deleted too', () => {
    const { instance } = setup(PropDefaults);

    expect(instance.delete_twice()).toBe('NameError');
    expect(instance.delete_function()).toBe('missing');
});

test('in a plain module too', () => {
    drop();
    expect(read()).toBe('missing');

    restore();
    expect(read()).toBe('4');
});
