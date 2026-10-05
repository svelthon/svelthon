// `{#each rows as {id, name}}` unpacks a row by key, and the README gives it as
// the shorter spelling of `{row.id}`, `{row.name}`. It was handed to Svelte as
// written, so JavaScript destructured the row: a dict, whose string keys are own
// properties, came out right; an instance, which keeps its attributes under a
// symbol, came out as empty cells; and a misspelt key was `undefined`, rendered
// as nothing, where the dot raises the AttributeError.
//
// Each key is now read by the dot's rule. Svelte's own unpacking is the witness:
// there, `{id, name}` and `{row.id}` agree on every row, and so must ours.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { restOf, pyData } from '../src/lib/runtime.js';
import UnpackByKey from './fixtures/UnpackByKey.svelte';
import UnpackByKeyNative from './fixtures/UnpackByKeyNative.svelte';
import UnpackByKeyTypo from './fixtures/UnpackByKeyTypo.svelte';
import ComputedRest from './fixtures/ComputedRest.svelte';
import ComputedRestNative from './fixtures/ComputedRestNative.svelte';
import { restart } from './fixtures/computed_rest_keys.js';
import RestRows from './fixtures/RestRows.svelte';
import RestRowsNative from './fixtures/RestRowsNative.svelte';
import RestProtocols from './fixtures/RestProtocols.svelte';
import RestProtocolsNative from './fixtures/RestProtocolsNative.svelte';
import { reads } from './fixtures/rest_protocols.js';
import RestKeys from './fixtures/RestKeys.svelte';
import RestKeysNative from './fixtures/RestKeysNative.svelte';
import RestWithoutDict from './fixtures/RestWithoutDict.svelte';
import RestMappingKeys from './fixtures/RestMappingKeys.svelte';
import RestSymbols from './fixtures/RestSymbols.svelte';
import RestSymbolsNative from './fixtures/RestSymbolsNative.svelte';
import { rows as symbolRows, token as symbolToken } from './fixtures/rest_symbols.js';

// Which rule a row takes was read off the row: a field `keys = 3` was called,
// a property `keys` was run, and a JavaScript object's `ob_type` getter ran
// before any field was read, once more than the copy reads it, or refused the
// mount. The class says whether a row is a mapping, and a JavaScript row is
// read as JavaScript's own rest reads it: each property once, the field read
// by the pattern included.
test('a row is a mapping by its class, and a JavaScript row runs no getter twice', () => {
    const read = (Component) => {
        reads.counted = 0;
        const target = document.body.appendChild(document.createElement('div'));
        mount(Component, { target });
        flushSync();
        const found = Object.fromEntries([...target.querySelectorAll('p')].map((one) => [one.dataset.k, one.textContent]));
        target.remove();
        return [found, reads.counted];
    };
    const [python] = read(RestProtocols);
    const [native] = read(RestProtocolsNative);

    expect(python.field).toBe('10|keys,tail');
    expect(python.property).toBe('10|tail');
    expect([python.refusing, python.counting]).toEqual([native.refusing, native.counting]);
});

// The rest itself reads each property of a JavaScript row once, as
// `{...rest} = row` does, its `ob_type` getter included, and runs none that is
// not enumerable.
test('the rest of a JavaScript row reads each property once, as JavaScript does', () => {
    const counted = (enumerable) => {
        const log = { reads: 0 };
        const row = { first: 10, tail: 20 };
        Object.defineProperty(row, 'ob_type', {
            enumerable,
            get() {
                log.reads += 1;
                return 'business';
            }
        });
        return [row, log];
    };

    for (const enumerable of [false, true]) {
        const [native, nativeLog] = counted(enumerable);
        const [python, pythonLog] = counted(enumerable);
        const { ...copy } = native;

        restOf(python, pyData([]));

        expect(Object.keys(copy).length).toBe(enumerable ? 3 : 2);
        expect(pythonLog.reads).toBe(nativeLog.reads);
    }
});

// `**rest` called `items()` on every row, so a Python instance or a JavaScript
// object, whose fields the pattern reads, stopped the mount with an
// AttributeError as soon as a rest was added. It reads every row the fields are
// read from: a mapping by `keys()` and `__getitem__`, as Python's `{**row}`
// does, an instance by its attributes, `vars(row)`, and a JavaScript object by
// its own enumerable properties, as Svelte's own unpacking does, measured.
test('the rest of a row holds its other fields, for every kind of row', () => {
    const read = (Component) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Component, { target });
        flushSync();
        const found = Object.fromEntries([...target.querySelectorAll('p')].map((one) => [one.dataset.k, one.textContent]));
        target.remove();
        return found;
    };
    const python = read(RestRows);
    const native = read(RestRowsNative);

    expect(python).toEqual({ dict: '10|tail', instance: '10|tail', mapping: '10|tail', record: '10|tail', class: '10|tail' });
    expect([python.record, python.class]).toEqual([native.record, native.class]);
});

// A mapping's `keys` was looked up raw on its class, so a classmethod, a
// staticmethod or a property handing back a function, which `{**row}` calls
// as a method, made the row an instance and its rest came out empty. It is
// read as Python reads `row.keys` now. `python3`'s `{**row}` gives `10|tail`
// for the five; a field `keys = 3` is the row's data, its attributes. And a
// dict keeping the dict's own iteration is its items, whatever `keys` says, as
// CPython's `{**row}` reads it: `10|tail` for both subclasses.
test('a mapping is known by its keys as Python reads them, descriptor bound', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(RestMappingKeys, { target });
    flushSync();

    const found = Object.fromEntries([...target.querySelectorAll('p')].map((one) => [one.dataset.k, one.textContent]));

    expect(found).toEqual({
        'dict, keys shadowed': '10|tail',
        'dict, keys redefined': '10|tail',
        method: '10|tail',
        classmethod: '10|tail',
        staticmethod: '10|tail',
        property: '10|tail',
        instance: '10|tail',
        field: '10|keys'
    });
    target.remove();
});

// The rest of a JavaScript row read `Object.keys`, so a property kept under an
// enumerable symbol was dropped, where JavaScript's own rest keeps it. It is
// read as JavaScript reads it now, symbols included, and a symbol taken by a
// computed key is left out as itself. Svelte is the witness of the symbol kept;
// JavaScript itself of the one taken, which Svelte keeps (it excludes
// `String(key)`).
test('the rest of a JavaScript row keeps its symbols, as JavaScript does', () => {
    const read = (Component) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Component, { target });
        flushSync();
        const found = Object.fromEntries([...target.querySelectorAll('p')].map((one) => [one.dataset.k, one.textContent]));
        target.remove();
        return found;
    };
    const { [symbolToken]: selected, ...rest } = symbolRows[0];
    const { kept, taken } = read(RestSymbols);

    expect({ kept }).toEqual(read(RestSymbolsNative));
    expect(taken).toBe(`${selected}|${Reflect.ownKeys(rest).length}`);
    expect([kept, taken]).toEqual(['10|1|20', '20|1']);
});

// The rest of a JavaScript row compared the keys taken as Python compares them,
// so the int `2024` did not leave out the property "2024", which JavaScript
// spells as a string: the field was read and kept in the rest too. A key is
// compared as the row compares it, and Svelte's own unpacking is the witness;
// on a dict, Python's (`python3`: `then|2025,label`).
test('a key taken is left out of the rest as the row compares its keys', () => {
    const read = (Component) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Component, { target });
        flushSync();
        const found = Object.fromEntries([...target.querySelectorAll('p')].map((one) => [one.dataset.k, one.textContent]));
        target.remove();
        return found;
    };
    const { dict, ...python } = read(RestKeys);
    const native = read(RestKeysNative);

    expect(python).toEqual(native);
    expect(python.year).toBe('then|2025,label');
    expect(dict).toBe('then|2025,label');
});

// A Python row with no `__dict__`, an instance of a class with `__slots__`
// among them, came out as an empty rest, its fields silently gone. The rest of
// a Python row that is not a mapping is `vars(row)`, and it raises what `vars`
// raises; a subclass that adds a `__dict__` gives what is in it. `python3` on
// the same rows: the four raise this TypeError, and `Mixed()` gives `extra`.
test.for(['slots', 'str', 'int', 'none'])('the rest of a %s row raises as `vars` does', (kind) => {
    const target = document.body.appendChild(document.createElement('div'));

    expect(() => mount(RestWithoutDict, { target, props: { kind } })).toThrow(
        /TypeError: vars\(\) argument must have __dict__ attribute/
    );
    target.remove();
});

test('the rest of an instance with slots and a `__dict__` is what `vars` holds', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(RestWithoutDict, { target, props: { kind: 'mixed' } });
    flushSync();

    expect(target.querySelector('[data-k="mixed"]').textContent).toBe('extra');
    target.remove();
});

// A computed key was evaluated twice, once to read the field and once to leave
// it out of `**rest`: a key that answers otherwise the second time read
// `first` and left out `second`, so one field was in both and one in neither.
// Svelte's own unpacking calls the key as often, and its field and its rest
// still split the row; so must ours.
test.for([
    ['Python', ComputedRest],
    ['native Svelte', ComputedRestNative]
])('%s: the field read by a computed key is the one left out of the rest', ([, Component]) => {
    restart();
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target });
    flushSync();

    const row = { first: '1', second: '2', third: '3' };
    const selected = target.querySelector('[data-k="selected"]').textContent;
    const rest = target.querySelector('[data-k="rest"]').textContent.split(',');
    const taken = Object.keys(row).find((one) => row[one] === selected);

    expect(rest).not.toContain(taken);
    expect([...rest, taken].sort()).toEqual(Object.keys(row));
    target.remove();
});

const mounted = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target });
    flushSync();

    const read = () =>
        Object.fromEntries([...target.querySelectorAll('p')].map((one) => [one.dataset.k, one.textContent]));
    const click = (name) => {
        target.querySelector(`.${name}`).click();
        flushSync();
    };
    const keyed = () => [...target.querySelectorAll('[data-k="keyed"] b')];

    return { read, click, keyed };
};

// What both languages say, row by row: `rest` is Python's alone, since a
// JavaScript object has no dict to hand back.
const shared = (rows) => Object.fromEntries(Object.entries(rows).filter(([k]) => k !== 'rest'));

describe('a row unpacked by key', () => {
    test('reads what the dot reads, on a dict and on an instance, as in Svelte', async () => {
        const ours = mounted(UnpackByKey);
        const theirs = mounted(UnpackByKeyNative);

        await Promise.resolve();
        flushSync();

        expect(theirs.read()['instance-key']).toBe(theirs.read()['instance-dot']);
        expect(shared(ours.read())).toEqual(theirs.read());
        expect(ours.read()['instance-key']).toBe('2:Felix;3:Garfield;');
    });

    test('follows the row when a key of it changes', () => {
        const ours = mounted(UnpackByKey);
        const theirs = mounted(UnpackByKeyNative);

        ours.click('rename');
        theirs.click('rename');

        expect(ours.read()['dict-key']).toBe('1:Thomas');
        expect(shared(ours.read())).toEqual(theirs.read());
    });

    // The key of a keyed block is computed outside the block, from the
    // pattern's names: the rows keep their nodes when the list turns.
    test('keys a block by an unpacked name, keeping each row its node', () => {
        const ours = mounted(UnpackByKey);
        const theirs = mounted(UnpackByKeyNative);
        const before = [ours.keyed(), theirs.keyed()];

        ours.click('turn');
        theirs.click('turn');

        expect(ours.keyed().map((one) => one.textContent)).toEqual(['Garfield', 'Felix']);
        expect(ours.keyed()).toEqual([...before[0]].reverse());
        expect(theirs.keyed()).toEqual([...before[1]].reverse());
    });

    test('takes a default only for a key the row does not have', () => {
        expect(mounted(UnpackByKey).read().default).toBe('4:anon');
    });

    test('and hands the keys it did not name back as a dict', () => {
        expect(mounted(UnpackByKey).read().rest).toBe("1:{'name': 'Tom'}");
    });

    // The dot raises on a name the row does not have, and so does the
    // unpacking, with the same sentence.
    test('raises on a misspelt key, as the dot does', () => {
        const target = document.body.appendChild(document.createElement('div'));

        expect(() => {
            mount(UnpackByKeyTypo, { target });
            flushSync();
        }).toThrow("AttributeError: 'dict' object has no attribute 'nmae'");
    });
});
