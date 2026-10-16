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

    return { values: instance.values(), shown, instance };
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

// A proxy of anyone's but Svelte's is no state of Svelte's, whatever its
// handlers refuse: it is taken in as data, as Svelte makes a proxy of it, and a
// write to it is followed. It was told by asking it to take its own prototype
// back, which a handler refusing that answered for Svelte, and which ran a
// handler Svelte never runs.
test.for([[true], [false]])('a proxy refusing a prototype (%s) is taken in as data, and nothing of it is run, as in Svelte', ([refuses]) => {
    const taken = (Component) => {
        const { values, shown } = mounted(Component);
        let asked = 0;
        const row = new Proxy(
            { n: 1 },
            {
                setPrototypeOf() {
                    asked += 1;
                    return !refuses;
                }
            }
        );

        values.rows.push(row);
        const same = values.rows.at(-1) === row;
        flushSync();
        values.rows.at(-1).n = 9;
        flushSync();

        return [same, values.rows.at(-1).n, shown().rows, asked];
    };

    expect(taken(ViewInsertedData)).toEqual(taken(ViewInsertedDataNative));
    expect(taken(ViewInsertedData)).toEqual([false, 9, '9', 0]);
});

// An object a Svelte state already owns, put in, is that object, as Svelte
// keeps a proxy of its own: copied into a dict, it stopped being the model it
// was shared as, and a write through its owner never reached the page. Put
// in a list, in a dict, and inside a new object; each read as identity, model
// and page.
test('an object a Svelte state owns stays that object, as in Svelte', () => {
    const shared = (Component) => {
        const owner = mounted(ViewInsertedDataNative).values.record.nested;
        const child = mounted(Component);
        const values = child.values;

        values.rows.push(owner);
        const listed = values.rows.at(-1) === owner;
        values.record.nested = owner;
        const keyed = values.record.nested === owner;
        values.rows.push({ inner: owner });
        const inner = values.rows.at(-1).inner === owner;
        values.rows.push(owner);
        flushSync();

        owner.n = 9;
        flushSync();

        return [listed, keyed, inner, values.rows.at(-1).n, child.shown()];
    };

    expect(shared(ViewInsertedData)).toEqual(shared(ViewInsertedDataNative));
    expect(shared(ViewInsertedData)).toEqual([true, true, true, 9, { rows: '9', record: '9' }]);
});

// Every own enumerable property of an object put in is taken, a symbol's
// included, as JavaScript's spread and Svelte's proxy take them: a library's
// metadata kept under a symbol was lost, at the root and one level down, put
// in a list or in a dict.
test('a property under a symbol is taken in with the others, as in Svelte', () => {
    const metadata = Symbol('metadata');
    const kept = (Component) => {
        const { values } = mounted(Component);

        values.rows.push({ n: 2, [metadata]: 'kept' });
        const root = values.rows.at(-1);
        values.record.nested = { n: 2, child: { [metadata]: 'kept' } };
        const nested = values.record.nested.child;

        return [root[metadata], Object.hasOwn(root, metadata), nested[metadata], Object.hasOwn(nested, metadata), root.n];
    };

    expect(kept(ViewInsertedData)).toEqual(kept(ViewInsertedDataNative));
    expect(kept(ViewInsertedData)).toEqual(['kept', true, 'kept', true, 2]);
});

// An object whose property is a getter and a setter forwards what it holds,
// here to a Svelte state: put in, it reads and writes through them, as
// Svelte's proxy of it does. Copied, it read its getter once and kept that
// value, and a write never reached its setter. A change of the source, then a
// write, in a list and in a dict.
test.for([['list'], ['dict']])('an object of a getter and a setter put in a %s reads and writes through them, as in Svelte', ([kind]) => {
    const forwarded = (Component) => {
        const source = mounted(ViewInsertedDataNative).values.record.nested;
        const child = mounted(Component);
        const values = child.values;
        let writes = 0;
        const item = {
            get n() {
                return source.n;
            },
            set n(value) {
                writes += 1;
                source.n = value;
            }
        };
        const read = () => (kind === 'list' ? values.rows.at(-1) : values.record.nested);
        const seen = () => [source.n, read().n, child.shown()[kind === 'list' ? 'rows' : 'record'], writes];

        if (kind === 'list') values.rows.push(item);
        else values.record.nested = item;
        flushSync();

        source.n = 9;
        flushSync();
        const changed = seen();

        read().n = 5;
        flushSync();

        return [changed, seen()];
    };

    expect(forwarded(ViewInsertedData)).toEqual(forwarded(ViewInsertedDataNative));
    expect(forwarded(ViewInsertedData)).toEqual([
        [9, 9, '9', 0],
        [5, 5, '5', 1]
    ]);
});

// And what else such an object holds is followed, as Svelte's proxy of it
// follows it: kept as it was, its getter read and forwarded, but a field of its
// own written by JavaScript never reached the page. An accessor under a
// symbol is an accessor too, and one nothing reads makes the object one.
const KEY = Symbol('forwarded');
const SHAPES = {
    'a getter reading a field of its own': () => ({
        m: 1,
        get n() {
            return this.m;
        },
        set n(value) {
            this.m = value;
        }
    }),
    'an accessor nothing reads': () =>
        Object.defineProperty({ n: 1 }, 'unused', {
            get() {
                return 99;
            }
        }),
    'an accessor under a symbol': () => {
        const item = { n: 1, writes: 0 };

        return Object.defineProperty(item, KEY, {
            get() {
                return item.n;
            },
            set(value) {
                item.writes += 1;
                item.n = value;
            },
            enumerable: true
        });
    }
};

test.for(Object.keys(SHAPES).flatMap((shape) => [[shape, 'list'], [shape, 'dict']]))(
    '%s, put in a %s, is followed as Svelte follows it',
    ([shape, kind]) => {
        const followed = (Component) => {
            const child = mounted(Component);
            const values = child.values;
            const read = () => (kind === 'list' ? values.rows.at(-1) : values.record.nested);
            const shown = () => child.shown()[kind === 'list' ? 'rows' : 'record'];

            if (kind === 'list') values.rows.push(SHAPES[shape]());
            else values.record.nested = SHAPES[shape]();
            flushSync();
            const first = shown();

            if (shape === 'a getter reading a field of its own') read().m = 7;
            else read().n = 7;
            flushSync();
            const second = shown();

            if (shape === 'an accessor under a symbol') read()[KEY] = 5;
            else read().n = 5;
            flushSync();

            return [first, second, shown(), read().writes];
        };

        expect(followed(ViewInsertedData)).toEqual(followed(ViewInsertedDataNative));
    }
);

// Only a getter or a setter the copy would read makes the object Svelte's
// state: one that is not enumerable, which neither the copy nor a spread
// reads, leaves it a dict to Python, its API with it, as the same object
// without that property is. It made it a JavaScript object, which has no
// `get`, `items` or `len`.
test('an object whose only getter is not enumerable is a dict to Python, as the same object without it', () => {
    const readBack = (make) => {
        const { values, instance } = mounted(ViewInsertedData);

        values.rows.push(make());
        values.record.nested = make();
        flushSync();

        return instance.read_back();
    };
    const hidden = () =>
        Object.defineProperty({ n: 2 }, 'hidden', {
            get() {
                return 99;
            }
        });

    expect(readBack(hidden)).toEqual(readBack(() => ({ n: 2 })));
    expect(readBack(() => ({ n: 2 }))).toBe('dict:2 dict:2');
});
