// Eight ways a list subclass can answer *what does iterating you mean*, and the
// four things this project owes each answer.
//
// A Brython list is a JavaScript array, so anywhere the runtime walks elements
// it can walk the storage with no conversion at all, and for a list that is
// exactly right. It stops being right the moment a subclass says otherwise, and
// the repairs came one at a time: first the **order** in the loop
// (`[x for x in rows]` answered `[3, 2, 1]` in Python while `{#each}` beside it
// showed `123`), then, in the branch written for it, the **watch** on the rows
// it yields and the **refusal** of a class that is wrong about its own protocol.
// Then, sweeping for the same question asked elsewhere, the **crossing**: one
// component could render `[3, 2, 1]` and publish `[1, 2, 3]`, for one object.
// One rule, four obligations, and three of them found after the first repair.
//
// So the rows here are the shapes of `__iter__` and the columns are those four
// obligations. The reference in every cell is the same and it is not a literal:
// it is what Python itself does with the very same object, `[x for x in rows]`,
// error included. A site that disagrees with the script beside it is the defect,
// whatever the two of them say.
//
// **The cell that is a hole, on purpose.** `halts` raises on its *second* step,
// where a loop has already rendered a row. The template refuses the whole list
// rather than showing the first row and stopping, because `{#each}` is given an
// array and not an iterator; Python's `for` shows nothing either, since the
// comprehension is what builds the list. They agree, and the agreement is the
// assertion — but a streaming loop would be a fifth column, and there is none.
//
// **How to use it.** A new shape of `__iter__` is a row. A site that walks a
// Python sequence is a column, and if its answer cannot be phrased as *the
// script and this agree*, that is the signal it invented a rule of its own.
import { test, expect, describe, vi } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { walked, serialised, crossed, nested } from './fixtures/iterated_rows.py';
import IteratedRows from './fixtures/IteratedRows.svelte';
import IteratedChild from './fixtures/IteratedChild.svelte';
import ForeignRows from './fixtures/ForeignRows.svelte';
import { batch } from '../src/lib/helpers.js';
import { plainData } from '../src/lib/runtime.js';

const render = (props) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(IteratedRows, { target, props });
    flushSync();

    return target.querySelector('[data-k="rows"]').textContent;
};

describe('the rows a subclass yields are the rows that render', () => {
    test.for([
        // `__iter__`, what it hands back, and what the loop shows.
        ['real', 'an iterator', '321'],
        ['generated', 'a generator', '321'],
        ['itself', 'the object itself', '321'],
        // The control, and the reason the fast path is still there: a subclass
        // that leaves `__iter__` alone is walked through its storage.
        ['tagged', 'nothing, it adds a name', '123']
    ])('%s returns %s', ([name, , shown]) => {
        expect(render({ name })).toBe(shown);
        // Read as `[3, 2, 1]` or `[1, 2, 3]`: the script is the reference, and
        // this is the same object seen from the other side.
        expect(walked(name)).toBe('[' + [...shown].join(', ') + ']');
    });
});

describe('a subclass wrong about its own protocol is refused', () => {
    test.for([
        ['plain', 'a list, which is iterable and is not an iterator', 'TypeError'],
        ['foreign', 'an int', 'TypeError'],
        ['refuses', 'nothing, it raises', 'ValueError'],
        ['halts', 'an iterator that raises on the second step', 'ValueError']
    ])('%s returns %s', ([name, , error]) => {
        // The script refuses it, so the template has to: rendering it anyway is
        // a bug in the author's class that only the page is silent about.
        expect(walked(name)).toBe(error);

        // Brython's `iter()` dumps the class object to the console on its way to
        // raising, hundreds of lines of it, which is its own defect and not this
        // one. Silenced here so a green run stays readable.
        const quiet = vi.spyOn(console, 'log').mockImplementation(() => {});

        try {
            expect(() => render({ name })).toThrow();
        } finally {
            quiet.mockRestore();
        }
    });
});

describe('and every other walk over the same object agrees', () => {
    // The loop was the site the audit found, and the question is asked at two
    // more: what a module publishes, and what `tojson` writes. Both walked the
    // storage, so one component could render `[3, 2, 1]` and hand its parent
    // `[1, 2, 3]` for one list. CPython's `json.dumps` of a list subclass is its
    // `__iter__` too; `repr` is the storage, and stays so — `str(rows)` below is
    // Python's own and nothing of ours reads it.
    // The module publishes the list itself, walked as Python walks it and
    // indexed as Python indexes it.
    test('what the module publishes', () => {
        expect([...crossed]).toEqual([3, 2, 1]);
        expect(crossed[0]).toBe(1);
    });

    test('one level down, where a callable would also be adapted', () => {
        expect([...nested[0]]).toEqual([3, 2, 1]);
    });

    test('and what tojson writes', () => {
        expect(serialised('real')).toBe('[3,2,1]');
        // The control: a subclass that leaves iteration alone.
        expect(serialised('tagged')).toBe('[1,2,3]');
    });
});

describe('a JavaScript iterable is walked too, and its errors stay its own', () => {
    // The last row family, and the only one whose source is not Python: a parent
    // hands a generator in as a prop, so nothing has converted it on the way.
    //
    // Python materialises every foreign iterable there is — an array, a Set, a
    // Map, a generator, a NodeList, a class of one's own with `[Symbol.iterator]`
    // — which is why the fallback beside it exists for almost nothing, and why
    // what it was really catching was **the author's own exception**. A
    // generator that threw on its second step read as *not Python's to convert*:
    // the spent generator went back to Svelte, the loop rendered nothing, and
    // `batch` answered `[]` with the message gone.
    const rendered = (items) => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(ForeignRows, { target, props: { items } });
        flushSync();

        return target.querySelector('[data-k="rows"]').textContent;
    };

    const broken = function* () {
        yield 1;
        throw new Error('iterator failure');
    };

    test('a generator renders its values', () => {
        expect(rendered((function* () { yield 1; yield 2; })())).toBe('12');
    });

    test('and so does a Set, which has no length to fall back on', () => {
        expect(rendered(new Set([1, 2]))).toBe('12');
    });

    test('and an error it raises reaches the author, with its own message', () => {
        expect(() => rendered(broken())).toThrow('iterator failure');
    });

    // A field spelled like the engine's mark, on an array this time. Read as a
    // class, the business string was handed to Brython, which tried to write a
    // slot on it: *Cannot create property 'tp_iter' on string 'business'*, a
    // JavaScript accident where the author wrote `{#each rows}`. One cause, six
    // crossings — the loop and the helper below, and four more the converters'
    // own tests hold.
    test('and one carrying a field spelled like the engine’s mark still renders', () => {
        const rows = [1, 2];

        rows.ob_type = 'business';

        expect(rendered(rows)).toBe('12');
        expect(plainData(batch(rows, 1))).toEqual([[1], [2]]);
    });

    test('including through a helper, which used to answer an empty list', () => {
        expect(() => batch(broken(), 2)).toThrow('iterator failure');
        // The control: the same helper, the same shape, nothing raised. Read
        // through the crossing, since `batch` answers in Python lists.
        expect(plainData(batch((function* () { yield 1; yield 2; })(), 2))).toEqual([[1, 2]]);
    });
});

describe('the watch reaches a row the container never held', () => {
    const grown = (shape) => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(IteratedChild, { target, props: { shape } });
        flushSync();

        const size = () => target.querySelector('[data-k="size"]').textContent;
        const before = size();

        target.querySelector('button').click();
        flushSync();

        return [before, size()];
    };

    // One child, one mutation, one loop, and four ways of handing it over. The
    // storage is empty in the first two, so the watch cannot be found by walking
    // it: the rows the loop is *given* are the rows to hand it down to, whatever
    // the source was. Written as a list because the rule was attached to the
    // source's representation twice running, and each time the shape that fell
    // outside it rendered its child and never watched it.
    test.for([
        ['subclass', 'a list subclass, whose rows come from its __iter__'],
        ['composed', 'a plain class holding no list at all'],
        // The two that always worked, and the reason: the initial walk finds the
        // child in the container's own storage, so nothing depends on the loop.
        ['stored', 'the same class, with the child in an attribute too'],
        ['list', 'an ordinary list holding it']
    ])('%s: %s', ([shape]) => {
        expect(grown(shape)).toEqual(['0', '1']);
    });
});
