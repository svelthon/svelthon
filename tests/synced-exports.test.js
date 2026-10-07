import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import * as python from './fixtures/synced_exports.py';
import * as native from './fixtures/synced_exports_native.js';
import SyncedInstanceHost from './fixtures/SyncedInstanceHost.svelte';
import * as held from './fixtures/js_held_instances.py';
import PrintedHost from './fixtures/PrintedHost.svelte';
import PrintedNative from './fixtures/PrintedNative.svelte';
import * as sets from './fixtures/synced_sets.py';
import * as nativeSets from './fixtures/synced_sets_native.js';
import * as iteratedSets from './fixtures/iterated_sets.py';
import * as viewErrors from './fixtures/view_errors.py';
import SetHost from './fixtures/SetHost.svelte';
import StateViewHost from './fixtures/StateViewHost.svelte';
import { stringify } from 'devalue';
import * as presence from './fixtures/presence.py';
import * as presenceNative from './fixtures/presence_native.js';
import * as callables from './fixtures/held_callables.py';
import { key as renamedKey } from './fixtures/renamed_key.js';
import * as moving from './fixtures/moving_keys.py';
import {
    inner,
    first,
    second,
    unseen,
    seen,
    late,
    cleared,
    named,
    conversions,
    resetConversions
} from './fixtures/moving_keys.js';

// What a module exports is its own object, as a JavaScript module's export is
// and as `m.items` is in Python: changed in place by the module, it is changed
// for the importer, under the name and in a reference taken before. A copy
// followed the name alone, and `items.append(1)` left JavaScript reading `[0]`.
// The module written in JavaScript is the witness.
const SHAPES = ['items', 'record', 'nested', 'rows', 'table', 'thing'];

const read = (module) => JSON.parse(JSON.stringify(Object.fromEntries(SHAPES.map((name) => [name, module[name]]))));

test('a container or an instance a module changes in place is changed for its importer', () => {
    const held = { python: { ...python }, native: { ...native } };

    python.mutate();
    native.mutate();

    expect(read(python)).toEqual(read(native));
    expect(read(held.python)).toEqual(read(held.native));
    expect(read(python).items).toEqual([0, 1]);
    expect(python.thing.double()).toBe(native.thing.double());
});

test('and a write from the importer is the module’s', () => {
    python.items.push(5);
    python.record.count = 7;
    python.thing.count = 3;

    expect(python.seen()).toEqual({ items: [0, 1, 5], record: { count: 7 }, thing: 3 });
});

// An instance Python writes into a JavaScript object or array is its view
// there too, as every other Python value written there is converted: the
// object then leaves Python as itself, and what it holds reads, serialises and
// comes back as the instance. Written raw, `config.inst.x` was `undefined` and
// `JSON.stringify` refused a circular structure.
test('an instance written into a JavaScript object reads as itself', () => {
    expect(held.config.inst.x).toBe(1.5);
    expect(held.config.inst.double()).toBe(3);
    expect(JSON.parse(JSON.stringify(held.config))).toEqual({ inst: { x: 1.5 } });
    expect(held.rows[0].x).toBe(2.5);
    expect(held.make().inst.x).toBe(3.5);
    expect(held.same(held.config.inst)).toBe(true);
});

// A set reads as a `Set`, which is how JavaScript holds one: exported, written
// into a JavaScript object and handed as a prop, it was the Brython object, on
// which `has` and `size` do not exist. The module written in JavaScript is the
// witness, `instanceof Set` and the set algebra included.
const setShape = (module) => ({
    set: module.tags instanceof Set,
    has: [module.tags.has('a'), module.tags.has('b'), module.tags.has('z')],
    size: module.tags.size,
    members: [...module.tags].sort(),
    boxed: [module.box.tags instanceof Set, module.box.tags.has?.('b'), [...module.box.tags].sort()],
    frozen: [...module.frozen].sort(),
    union: [...module.tags.union(new Set(['c']))].sort(),
    intersection: [...module.tags.intersection(new Set(['b', 'z']))],
    subset: module.tags.isSubsetOf(new Set(['a', 'b', 'c']))
});

test('a set reads, follows and is written as a JavaScript Set', () => {
    const held = { python: sets.tags, native: nativeSets.tags };

    sets.mutate();
    nativeSets.mutate();

    expect(setShape(sets)).toEqual(setShape(nativeSets));
    expect(setShape(sets).members).toEqual(['a', 'b']);
    expect([...held.python].sort()).toEqual([...held.native].sort());

    sets.tags.add('c');
    sets.tags.delete('a');
    expect(sets.seen()).toEqual(['b', 'c']);

    // A member that is a tuple reads as a tuple does, and finds itself.
    const [pair] = [...sets.pairs];
    expect([...pair]).toEqual([1, 2]);
    expect(sets.pairs.has(pair)).toBe(true);

    // A frozenset refuses a write with JavaScript's TypeError, in Python's
    // words, as a tuple's view does.
    expect(() => sets.frozen.add(3)).toThrow(new TypeError("'frozenset' object has no attribute 'add'"));

    // A view is not cloned, a set's no more than a list's: a clone of the
    // `Set`'s own storage would be an empty set, given in silence.
    expect(() => structuredClone(sets.tags)).toThrow();
    expect(() => structuredClone(nativeSets.tags)).not.toThrow();
});

// What a method hands back as the set, `add`'s result and `forEach`'s third
// argument, is the view JavaScript holds, as a `Set`'s own method hands back
// the `Set`: the object behind the view keeps its own storage empty, and a
// clone of it was an empty set, given in silence.
test('a set’s methods hand back the view itself', () => {
    const returned = sets.tags.add('w');
    const receivers = [];

    sets.tags.forEach((one, same, set) => receivers.push(set));

    expect(returned).toBe(sets.tags);
    expect(receivers.every((one) => one === sets.tags)).toBe(true);
    expect(() => structuredClone(returned)).toThrow();
    expect(nativeSets.tags.add('w')).toBe(nativeSets.tags);
});

// `in` asks whether an attribute is there without reading it, as it does of a
// JavaScript object with getters: a property is not run, and one that raises
// does not make the question raise. A name a `__getattr__` makes is asked of
// it, the one way to know it is there.
test('in on an instance reads no property', () => {
    const asked = (module) => {
        const before = module.reads();
        const answers = ['field', 'counted', 'raising', 'missing'].map((name) => name in module.config);

        return { answers, reads: module.reads() - before };
    };

    expect(asked(presence)).toEqual(asked(presenceNative));
    expect(asked(presence)).toEqual({ answers: [true, true, true, false], reads: 0 });
    expect(presence.config.counted).toBe(42);
    expect(['made' in presence.dynamic, 'other' in presence.dynamic]).toEqual([true, false]);
});

// A callable read out of a set is the function JavaScript calls, and handed
// back it is the Python callable again, as a `Set` finds the member it handed
// out: it was its wrapper, which the set did not hold, so `delete` kept it and
// `add` made a second one.
test('a set finds the callable it handed out', () => {
    for (const set of [callables.functions, callables.runners]) {
        const [member] = [...set];
        const witness = new Set([member]);

        expect(typeof member()).toBe('string');
        expect(set.has(member)).toBe(witness.has(member));
        expect(set.add(member).size).toBe(witness.add(member).size);
        expect(set.delete(member)).toBe(witness.delete(member));
        expect(set.size).toBe(0);
    }
});

// A dict keyed by a JavaScript object names that key by its `toString` once,
// when it enters, and keeps the name for as long as it is there, as
// JavaScript names an object key when it is written: the object written
// before the rename is the witness, and stays one through a change of the
// other keys. The view stays one object: what it lists, what it reads and
// what it writes out agree.
test('a dict view names a JavaScript key as JavaScript does', () => {
    const witness = {};

    witness[renamedKey] = 42;
    expect(Object.keys(callables.mapping)).toEqual(['before']);

    renamedKey.label = 'after';

    expect(Object.keys(callables.mapping)).toEqual(Object.keys(witness));
    expect(callables.mapping.before).toBe(witness.before);
    expect(JSON.stringify(callables.mapping)).toBe(JSON.stringify(witness));

    callables.touch();
    witness.other = 0;
    expect(Object.keys(callables.mapping)).toEqual(Object.keys(witness));
    expect(callables.mapping.before).toBe(42);
});

// And a key that holds such an object, a tuple of it, the same way. Two keys
// one of which comes to answer the other's name keep the names they were
// given, through an unrelated change of the keys too, where naming them all
// again at each change made the whole view refuse to be read; a key that
// enters under a name taken is refused, as the copy refuses it. Read whole,
// the view names each key once, a dict of strings beside one such key
// included: taking names afresh at each read was quadratic, 320 400 calls of
// `toString` for 400 keys.
test('a dict view keeps the names it gave, and names them once', () => {
    const witness = {};

    witness[first] = 1;
    witness[second] = 2;
    expect(moving.by_tuple.before).toBe(42);
    expect([moving.pair.first, moving.pair.second]).toEqual([1, 2]);

    inner.label = 'after';
    second.label = 'first';
    moving.touch();
    witness.other = 3;

    expect(Object.keys(moving.by_tuple)).toEqual(['before', 'other']);
    expect(Object.keys(moving.pair)).toEqual(Object.keys(witness));
    expect([moving.pair.first, moving.pair.second, moving.pair.other]).toEqual([1, 2, 3]);

    moving.pair.first = 7;
    expect(moving.values_of_pair()).toEqual([7, 2, 3]);

    moving.enter_third();
    expect(() => moving.pair.first).toThrow(/two keys JavaScript cannot tell apart/);

    for (const dict of [moving.large, moving.mixed]) {
        resetConversions();
        expect(Object.keys(dict).length).toBeGreaterThan(0);
        expect(conversions()).toBeLessThanOrEqual(400);
    }
});

// A key that leaves the dict and comes back is named again, as a JavaScript
// object names a key written again after a `delete`, whoever read the dict
// while it was out: the place it takes in the dict's array of keys is new, and
// the name goes with the place. Kept by key, the name depended on whether a
// reader had looked at the dict while it was out. The one name the view cannot
// have is the one a key answered before the view first looked, Python writing
// a key without asking its name.
test('a dict view names a key that came back as JavaScript does', () => {
    const rename = (key) => {
        key.label = 'after';
    };
    const witness = (key) => {
        const object = {};

        object[key] = 42;
        delete object[key];
        rename(key);
        object[key] = 43;

        return Object.keys(object);
    };

    expect(Object.keys(moving.while_unseen)).toEqual(['before']);
    moving.take_out(moving.while_unseen, unseen);
    rename(unseen);
    moving.put_in(moving.while_unseen, unseen);
    expect(Object.keys(moving.while_unseen)).toEqual(witness(named('before')));
    expect(moving.while_unseen.after).toBe(43);

    expect(Object.keys(moving.while_seen)).toEqual(['before']);
    moving.take_out(moving.while_seen, seen);
    expect(Object.keys(moving.while_seen)).toEqual([]);
    rename(seen);
    moving.put_in(moving.while_seen, seen);
    expect(Object.keys(moving.while_seen)).toEqual(['after']);

    expect(Object.keys(moving.through_clear)).toEqual(['before']);
    moving.empty(moving.through_clear);
    rename(cleared);
    moving.put_in(moving.through_clear, cleared);
    expect(Object.keys(moving.through_clear)).toEqual(['after']);

    rename(late);
    expect(Object.keys(moving.first_read_late)).toEqual(['after']);
});

// A walk of a set is live, as a `Set`'s is: a member deleted before its turn
// is not visited, one added during the walk is, and `clear` ends it. The walk
// went over a copy taken before the first member, and visited what was gone.
test('a walk of a set sees the changes made during it', () => {
    const walks = (make, refill) =>
        [(set) => set.clear(), (set) => set.delete(3), (set) => set.add(4)].map((change) => {
            const set = make();
            const visited = [];

            refill();
            for (const one of set) {
                visited.push(one);
                if (one === 1) change(set);
            }

            const viaForEach = [];

            refill();
            set.forEach((one) => {
                viaForEach.push(one);
                if (one === 1) change(set);
            });

            return [visited, viaForEach];
        });

    const native = new Set();

    expect(walks(() => sets.walked, sets.refill)).toEqual(
        walks(
            () => native,
            () => {
                native.clear();
                [1, 2, 3].forEach((one) => native.add(one));
            }
        )
    );
});

// A member deleted and added back during a walk is visited again, as a `Set`
// visits it, whatever the member, wherever it stood and whichever language
// wrote. `-1` and `-2` share a hash, and `-2`, the last of their bucket, is put
// back where it was: its place said nothing, and the walk missed it. Telling it
// by identity visited a float or a tuple again and an int never, and a record
// the view kept of its own writes missed Python's and held the members it
// recorded (`set-view-retention.test.js`).
test('a walk of a set visits a member added back, whoever adds it', () => {
    const walks = (set, refill, changes) =>
        [
            [1, 2, 3],
            [0.5, 1.5, 2.5],
            [-1, -2]
        ].flatMap((members) =>
            [members[0], members.at(-1)].flatMap((target) =>
                changes.flatMap((change) =>
                    [true, false].map((byForOf) => {
                        const visited = [];
                        let changed = false;
                        const visit = (one) => {
                            visited.push(one);
                            if (one === target && !changed) {
                                changed = true;
                                change(target);
                            }
                        };

                        refill(members);
                        if (byForOf) for (const one of set) visit(one);
                        else set.forEach(visit);

                        return visited;
                    })
                )
            )
        );
    const native = new Set();
    const nativeRefill = (members) => {
        native.clear();
        members.forEach((one) => native.add(one));
    };
    const byJavaScript = (set) => [(one) => (set.delete(one), set.add(one)), (one) => (set.clear(), set.add(one))];

    expect(walks(sets.walked, sets.refill, byJavaScript(sets.walked))).toEqual(
        walks(native, nativeRefill, byJavaScript(native))
    );
    expect(walks(sets.walked, sets.refill, [(one) => sets.put_back(false, one), (one) => sets.put_back(true, one)])).toEqual(
        walks(native, nativeRefill, byJavaScript(native))
    );
});

// A subclass that redefines `__iter__` is walked by it, as a list's view is:
// every walk of the view yields what Python's own loop yields, and what the
// class raises, or a protocol it breaks, reaches JavaScript in Python's words.
// The walk read the storage, so a filter of the author's let every member
// through and a refusal went unheard. A subclass that leaves iteration alone,
// and a frozenset, are their members.
test('a set walks as its class says', () => {
    const walks = (set) => {
        const read = (walk) => {
            try {
                return walk();
            } catch (error) {
                return typeof error?.message === 'string' ? error.message : 'no message';
            }
        };

        return [
            read(() => [...set]),
            read(() => [...set.values()]),
            read(() => [...set.keys()]),
            read(() => [...set.entries()].map(([one]) => one)),
            read(() => {
                const rows = [];
                set.forEach((one) => rows.push(one));
                return rows;
            })
        ];
    };
    const answers = Object.fromEntries(Object.keys(iteratedSets.SETS).map((name) => [name, walks(iteratedSets.SETS[name])]));
    const python = Object.fromEntries(Object.keys(iteratedSets.SETS).map((name) => [name, iteratedSets.walked(name)]));

    expect(python).toEqual({
        filtered: [3],
        ordered: [3, 2, 1],
        refuses: 'ValueError: not today',
        plain: "TypeError: iter() returned non-iterator of type 'list'",
        named: [1, 2, 3],
        frozen: [1, 2, 3]
    });

    for (const [name, walked] of Object.entries(python)) {
        const expected = Array.isArray(walked) ? walked : expect.stringContaining(walked);

        expect(answers[name]).toEqual(Array(5).fill(expected));
    }
});

// And what Python raised there is still Python's when it comes back: the
// module that handed a set or a list to JavaScript catches its own
// `ValueError` from the walk, and its `TypeError` from a write, as it catches
// what a call raises. Made a JavaScript `Error`, it came back a
// `JavascriptError`, and the `except` missed it.
test('an error raised in Python while JavaScript walks a view is still Python’s', () => {
    expect(iteratedSets.caught()).toEqual([
        'ValueError: not today',
        'ValueError: not today',
        'ValueError: not today',
        "TypeError: cannot use 'list' as a set element (unhashable type: 'list')"
    ]);
});

// Every read of a view relays what Python raises the same way: an index, a
// property, a size, a membership and an entry reach JavaScript with Python's
// message, and come back to the module that handed the value over as its own
// `ValueError`. Thrown as it came, the exception carried no message for
// JavaScript; caught by `has`, a refusal of the class's went unheard, where an
// unhashable value is still a no, as `Set.prototype.has` answers any value.
test('what Python raises under a view reaches the reader, in Python’s words', () => {
    const read = (run) => {
        try {
            run();
            return 'no error';
        } catch (error) {
            return error.message;
        }
    };

    expect(
        [
            () => viewErrors.rows[0],
            () => viewErrors.box.value,
            () => viewErrors.bag.size,
            () => viewErrors.bag.has(1),
            () => viewErrors.table.a,
            () => viewErrors.type_bag.has(1),
            () => String(viewErrors.text_box)
        ].map(read)
    ).toEqual([
        expect.stringContaining('ValueError: no row'),
        expect.stringContaining('ValueError: no value'),
        expect.stringContaining('ValueError: no size'),
        expect.stringContaining('ValueError: no answer'),
        expect.stringContaining('ValueError: no entry'),
        expect.stringContaining('TypeError: membership failed'),
        expect.stringContaining('ValueError: no text')
    ]);
    // A value whose class has no hash is a no, decided by the class.
    expect(iteratedSets.SETS.named.has([])).toBe(false);
    expect(iteratedSets.SETS.named.has(viewErrors.compared)).toBe(false);
    expect(viewErrors.caught()).toEqual([
        'ValueError: no row',
        'ValueError: no value',
        'ValueError: no size',
        'ValueError: no answer',
        'ValueError: no entry',
        false,
        'TypeError: membership failed',
        'ValueError: no text'
    ]);
});

// A member that never left is not visited again, whatever became of its
// bucket: `intersection_update` builds the buckets anew for the members it
// keeps, and a walk telling arrivals by bucket visited them twice.
test('a walk of a set visits once a member that stayed', () => {
    const walk = (set, refill, keep) => {
        const visited = [];

        refill([1, 2, 3]);
        for (const one of set) {
            visited.push(one);
            if (visited.length === 1) keep([1, 3]);
        }

        return visited;
    };
    const native = new Set();
    const nativeRefill = (members) => {
        native.clear();
        members.forEach((one) => native.add(one));
    };

    expect(walk(sets.walked, sets.refill, sets.keep_only)).toEqual(walk(native, nativeRefill, () => native.delete(2)));
    expect(walk(native, nativeRefill, () => native.delete(2))).toEqual([1, 3]);
});

// The same, where the intersection keeps every member but holds them as other
// objects: the other set's floats, equal and rebuilt. A member is the value
// Python keeps, whatever object holds it; told by identity, `0.5` was visited
// again, and an intersection made at every step kept the walk on it.
test('a walk of a set visits once a member held anew by an equal one', () => {
    const walk = (members, how, everyStep) => {
        const visited = [];

        sets.refill(members);
        for (const one of sets.walked) {
            visited.push(one);
            if (visited.length > 2 * members.length) break;
            if (everyStep || visited.length === 1) sets.keep_only(members, how);
        }

        return visited;
    };

    for (const members of [
        [0.5, 1.5, 2.5],
        [1, 2, 3]
    ]) {
        for (const how of ['method', 'dunder', 'augmented']) {
            expect(walk(members, how, false)).toEqual(members);
            expect(walk(members, how, true)).toEqual(members);
        }
    }
});

// `difference` asks of the members as they were, as the specification walks
// its copy: a `has` that changes the set did not change what was asked, and a
// member it excludes stayed in the result. And the argument's `has` is read
// and refused before its `keys` is read.
test('a set’s difference and its argument follow the specification', () => {
    const outcome = (set, refill) => {
        refill();
        const asked = [];
        const result = set.difference({
            size: 10,
            has(one) {
                asked.push(one);
                if (one === 1) set.delete(3);
                return one === 3;
            },
            *keys() {
                yield 3;
            }
        });
        const read = [];
        let refusal;

        try {
            set.union({
                get size() {
                    read.push('size');
                    return 1;
                },
                get has() {
                    read.push('has');
                    return 42;
                },
                get keys() {
                    read.push('keys');
                    throw new Error('keys read');
                }
            });
        } catch (error) {
            refusal = error.constructor.name;
        }

        return { asked, result: [...result], read, refusal };
    };
    const native = new Set();

    expect(outcome(sets.walked, sets.refill)).toEqual(
        outcome(native, () => {
            native.clear();
            [1, 2, 3].forEach((one) => native.add(one));
        })
    );
});

// The set algebra is the specification's: the argument is refused as
// `Set.prototype` refuses it, and an intersection keeps the order of the
// smaller side.
test('a set’s algebra answers as Set.prototype does', () => {
    sets.refill();
    const native = new Set([1, 2, 3]);
    const smaller = new Set([3, 1]);
    const invalid = { size: Number.NaN, has: () => true, *keys() {} };
    const methods = ['union', 'intersection', 'difference', 'symmetricDifference', 'isSubsetOf', 'isSupersetOf', 'isDisjointFrom'];
    const answers = (set) =>
        methods.map((name) => {
            const answer = set[name](smaller);
            return typeof answer === 'boolean' ? answer : [...answer];
        });
    const refusals = (set) =>
        methods.map((name) => {
            try {
                set[name](invalid);
                return 'accepted';
            } catch (error) {
                return error.constructor.name;
            }
        });

    expect(answers(sets.walked)).toEqual(answers(native));
    expect(refusals(sets.walked)).toEqual(refusals(native));
    expect([...sets.walked.intersection(smaller)]).toEqual([3, 1]);
});

// A copy made by the constructor, `new data.constructor(data)` as lodash's
// `cloneDeep` makes one, is a `Set` of the members, as of a `Set`.
test('a set view is copied by its constructor', () => {
    sets.refill();
    const native = new Set([1, 2, 3]);
    const copies = (set) => {
        const byArgument = new set.constructor(set);
        const byAdd = new set.constructor();

        set.forEach((one) => byAdd.add(one));

        return [[...byArgument], [...byAdd], byArgument instanceof Set];
    };

    expect(copies(sets.walked)).toEqual(copies(native));
});

test('a JavaScript child reads and follows a set it is given', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const host = mount(SetHost, { target });
    flushSync();

    const shown = () => target.querySelector('[data-k="picked"]').textContent;

    expect(shown()).toBe('a 1 false');

    host.pick('b');
    flushSync();
    expect(shown()).toBe('a,b 2 true');
});

// A dict's or an instance's view is kept as it is in a JavaScript `$state`,
// as a list's is, so a write from either side is seen by both: Svelte wrapped
// a dict's view in its own proxy, which kept the JavaScript write to itself
// and missed the next Python one. And SvelteKit's serialiser writes either out
// as the object it reads as, where it refused an instance's view as an object
// of a class of its own.
test('a dict or an instance a JavaScript child keeps in its $state is synced both ways', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(StateViewHost, { target });
    flushSync();

    const read = () =>
        ['python', 'javascript'].map((key) => target.querySelector(`[data-k="${key}"]`).textContent);

    expect(read()).toEqual(['1|1', '1|1']);

    target.querySelector('[data-k="js"]').click();
    flushSync();
    expect(read()).toEqual(['5|5', '5|5']);

    target.querySelector('[data-k="py"]').click();
    flushSync();
    expect(read()).toEqual(['15|15', '15|15']);
});

test('SvelteKit’s serialiser writes a dict’s and an instance’s view out', () => {
    expect(stringify(python.record)).toBe(stringify({ count: python.record.count }));
    expect(stringify(python.thing)).toBe(stringify({ count: python.thing.count }));
});

// The same instance prints alike in the Python template and in a JavaScript
// child: a class with a `__str__` prints by it, as a JavaScript class with a
// `toString` does, and one with neither prints as an object on both sides. A
// change Python makes repaints the child.
test('an instance prints in a JavaScript child as its class says', () => {
    const shown = (Component) => {
        const target = document.body.appendChild(document.createElement('div'));
        const host = mount(Component, { target });
        flushSync();

        const text = (key) => target.querySelector(`[data-k="${key}"]`).textContent;

        return { host, text, all: ['python', 'price', 'literal', 'plain'].map(text) };
    };

    const python = shown(PrintedHost);

    expect(python.all).toEqual(shown(PrintedNative).all);
    expect(python.all).toEqual(['1.50 EUR', '1.50 EUR', '1.50 EUR', '[object Object]']);

    python.host.raise_price();
    flushSync();
    expect(python.text('price')).toBe('2.50 EUR');
});

// The instance's view is also what a JavaScript child reads of a prop: handed
// raw, it read nothing, the attributes being under a symbol of Brython's.
test('a JavaScript child reads, follows and writes an instance it is given', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const host = mount(SyncedInstanceHost, { target });
    flushSync();

    const shown = () => target.querySelector('[data-k="count"]').textContent;

    expect(shown()).toBe('0');

    host.bump();
    flushSync();
    expect(shown()).toBe('1');

    target.querySelector('[data-k="add"]').click();
    flushSync();
    expect(host.count()).toBe(11);
    expect(shown()).toBe('11');
});
