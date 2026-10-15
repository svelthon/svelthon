// **A write Svelte refuses changes nothing.** Svelte refuses a write to state
// made while the template renders (`state_unsafe_mutation`), and refuses it
// before it stores it. A write of Python's was made first and refused when its
// readers were told: the model held the write the page refused, and an author
// who caught the error read the new value beside the old one. Now the
// container is put back as it was, a list, a dict and an instance alike.
//
// Put back whole: the type of a dict stays the class it was, and the attributes
// of a list's or a set's subclass, of a function and of a class come back with
// the rest. And only a write is saved before: a read made where a write would
// be refused copies nothing, where each `get` once copied the whole dict.
//
// Put back as it was, in place: a key deleted comes back where it stood, not
// after the others; the bytes of a bytearray and a function's name and
// defaults, which the engine changes in place, come back too; and the elements
// of a JavaScript array are copied by their descriptors, so that a getter is
// never run and stays a getter, and a hole stays a hole.
//
// A class is refused before it is written, read by its name or watched alike:
// written, it changed its subclasses too, `sub()` answering 99 after `Base`
// was put back, and its bases' lists of subclasses, which no copy of the class
// put back.
//
// The witness is the same template over Svelte's `$state`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { held } from './fixtures/kept.js';
import { stop } from './fixtures/enumerated.js';
import { after } from './fixtures/refused_rows.js';
import RefusedWrite from './fixtures/RefusedWrite.svelte';
import RefusedWriteNative from './fixtures/RefusedWriteNative.svelte';
import RefusedKeeps from './fixtures/RefusedKeeps.svelte';
import RefusedKeepsNative from './fixtures/RefusedKeepsNative.svelte';
import RefusedReads from './fixtures/RefusedReads.svelte';
import RefusedReadsNative from './fixtures/RefusedReadsNative.svelte';
import RefusedPutBack from './fixtures/RefusedPutBack.svelte';
import RefusedPutBackNative from './fixtures/RefusedPutBackNative.svelte';
import RefusedRows from './fixtures/RefusedRows.svelte';
import RefusedRowsNative from './fixtures/RefusedRowsNative.svelte';

// What the page showed, or whether it was refused, and what the model holds
// after.
const outcome = (Component, kind, catching) => {
    const target = document.body.appendChild(document.createElement('div'));
    const model = () => (kind === 'list' ? held().length : held().n);

    try {
        mount(Component, { target, props: { kind, catching } });
        flushSync();

        return { shown: [target.querySelector('p').textContent, target.querySelector('output').textContent], model: model() };
    } catch (error) {
        return { refused: /state_unsafe_mutation/.test(String(error?.message ?? error)), model: model() };
    }
};

test.for(['list', 'dict', 'instance'].flatMap((kind) => [false, true].map((catching) => [kind, catching])))(
    'a write to a %s refused while rendering, caught %s, leaves the model as it was',
    ([kind, catching]) => {
        const mine = outcome(RefusedWrite, kind, catching);

        expect(mine).toEqual(outcome(RefusedWriteNative, kind === 'instance' ? 'dict' : kind, catching));
        expect(mine).toEqual(catching ? { shown: ['0', '0'], model: 0 } : { refused: true, model: 0 });
    }
);

// What the page showed, then the value held and whether every type is the one
// it had.
const kept = (Component, kind) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props: { kind } });
    flushSync();

    return { shown: [target.querySelector('p').textContent, target.querySelector('output').textContent], model: Array.from(instance.model()) };
};

test.for(['dict', 'dict subclass', 'instance', 'list subclass', 'set subclass', 'function', 'class'])(
    'a write to the n of a %s refused while rendering leaves its value and its types as they were',
    (kind) => {
        const mine = kept(RefusedKeeps, kind);

        expect(mine).toEqual(kept(RefusedKeepsNative, kind));
        expect(mine).toEqual({ shown: ['0', 'refused'], model: [0, true] });
    }
);

// The sum shown, and how many of the container's keys were enumerated while the
// page rendered. A write that changes nothing, known before it is made, copies
// nothing either: each one once copied the whole container, a cost growing
// with the square of the rows.
const read = (Component, kind, n) => {
    const target = document.body.appendChild(document.createElement('div'));
    let keys;

    try {
        mount(Component, { target, props: { kind, n } });
        flushSync();
    } finally {
        keys = stop();
    }

    return { shown: target.querySelector('output').textContent, keys };
};

test.for([
    ['get', 10],
    ['get', 200],
    ['setdefault', 200],
    ['same value', 200],
    ['add', 200]
])('%s, %i times where a write would be refused, enumerates no key', ([kind, n]) => {
    const mine = read(RefusedReads, kind, n);

    expect(mine).toEqual(read(RefusedReadsNative, kind, n));
    expect(mine).toEqual({ shown: String((n * (n - 1)) / 2), keys: 0 });
});

// What the page showed, and what the model holds after.
const putBack = (Component, kind) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props: { kind } });
    flushSync();

    return { shown: [target.querySelector('p').textContent, target.querySelector('output').textContent], held: instance.held() };
};

test.for([
    ['del', 'a b c'],
    ['pop', 'a b c'],
    ['subclass', 'a b c'],
    ['attributes', 'a b c'],
    ['class', '0'],
    ['special method', '1'],
    ['bytearray item', '97 98 99'],
    ['bytearray append', '97 98 99'],
    ['function name', 'handler'],
    ['function defaults', '1'],
    ['subclass call', 'True 1 1 1'],
    ['bases', 'True 1 1 True True']
])('a write refused while rendering, %s, is put back as it was: %s', ([kind, before]) => {
    const mine = putBack(RefusedPutBack, kind);

    expect(mine).toEqual(putBack(RefusedPutBackNative, kind));
    expect(mine).toEqual({ shown: [before, 'refused'], held: before });
});

// What the page showed, then the array after.
const rows = (Component, kind) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(Component, { target, props: { kind } });
    flushSync();

    return { shown: [target.querySelector('p').textContent, target.querySelector('output').textContent], after: after() };
};

test.for([
    ['getter', 'getter'],
    ['raising', 'getter'],
    ['hole', 'hole']
])('a write to a JavaScript array whose first element is a %s, refused while rendering, leaves that element as it was', ([kind, first]) => {
    const mine = rows(RefusedRows, kind);

    expect(mine).toEqual(rows(RefusedRowsNative, kind));
    expect(mine).toEqual({ shown: ['2', 'refused'], after: { reads: 0, first, second: 43, length: 2 } });
});
