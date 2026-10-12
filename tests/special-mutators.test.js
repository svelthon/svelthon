// The indexed statement and the method it compiles to.
//
// `__setitem__` and `__delitem__` were kept out of the followed names on the
// grounds that `rows[0] = 1` and `del rows[0]` compile to their own intercepted
// entry points. That is true of the *statement* and says nothing about an
// author calling the method by name, which is ordinary Python and is what a
// generic helper does: `rows.__setitem__(0, 1)`, the same method taken off the
// object and kept, or reached through the type.
//
// The indexed form is the witness on every line: it repainted throughout, so
// nothing here is about the expression or the handler.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SpecialMutators from './fixtures/SpecialMutators.svelte';
import ExceptionNotes from './fixtures/ExceptionNotes.svelte';

const setup = () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(SpecialMutators, { target });
    flushSync();

    return {
        read: (k = 'rows') => target.querySelector(`p[data-k="${k}"]`).textContent,
        click: (key) => {
            target.querySelector(`button[data-k="${key}"]`).click();
            flushSync();
        }
    };
};

describe.for([
    ['the indexed statement', 'index', '[1]'],
    ['the method called by name', 'method', '[1]'],
    ['the method taken off the object', 'detached', '[1]'],
    ['the method reached through the type', 'type', '[1]'],
    ['and the deletion by name', 'delete', '[]'],
    // The in-place operators and `__init__` by name: `rows += [1]` goes through
    // its own entry point, these through nothing else.
    ['__iadd__ called by name', 'iadd', '[0, 1]'],
    ['__iadd__ taken off the object', 'iadd-detached', '[0, 1]'],
    ['__iadd__ reached through the type', 'iadd-type', '[0, 1]'],
    ['__imul__ called by name', 'imul', '[0, 0]'],
    ['__init__ reached through the type', 'init', '[2]']
])('a list mutated by %s', ([, key, after]) => {
    test('repaints what reads it', () => {
        const { read, click } = setup();

        expect(read()).toBe('[0]');

        click(key);

        expect(read()).toBe(after);
    });
});

test('a dict mutated by __ior__ called by name repaints', () => {
    const { read, click } = setup();
    click('ior');
    expect(read('table')).toBe("{'a': 1}");
});

test('a set mutated by __ior__ called by name repaints', () => {
    const { read, click } = setup();
    click('set-ior');
    expect(read('marks')).toBe('{1}');
});

// `__init__` takes a source: what it yielded is inside the list, so the list
// says what it now holds, and the child grows on the page.
test('a child put in by __init__ is watched', () => {
    const { read, click } = setup();
    click('init-child');
    expect(read()).toBe('[[]]');
    click('grow');
    expect(read()).toBe('[[1]]');
});

// An exception's `add_note()` writes its notes inside the engine, past every
// write the page is told of.
test.for([
    ['by the method', 'method', 'error', '1'],
    ['to notes it already has', 'existing', 'noted', '2'],
    ['by the method kept as a value', 'detached', 'error', '1'],
    ['by the method reached through the type', 'type', 'error', '1']
])('a note added %s repaints its readers', ([, way, key, shown]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(ExceptionNotes, { target });
    flushSync();

    instance.note(way);
    flushSync();

    expect(target.querySelector(`p[data-k="${key}"]`).textContent).toBe(shown);
});
