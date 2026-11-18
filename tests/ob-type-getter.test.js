// `ob_type` is the mark Brython puts on its own values, and a field name any
// JavaScript object may hold, a getter of its author's among them. Every site
// asking "is this the engine's?" read it through that getter: `to_py` ran it
// where no copy would have, ran it twice where the copy reads it too, and a
// getter that throws refused the whole record, and `to_js` and `to_json` asked
// the same way. It is read off the descriptors now (`ownType`), where Brython
// only ever writes it as data.
//
// The witness is JavaScript's own copy, `Object.fromEntries(Object.entries(row))`:
// each conversion runs the getter as many times as it does, and no more.
import { test, expect } from 'vitest';
import { plainData, pyData } from '../src/lib/bridge.js';
import { to_json, urlencode } from '../src/lib/helpers.js';

// A record with a getter `ob_type` that counts its runs, hidden or enumerable,
// and one that throws.
const record = ({ enumerable = false, throwing = false } = {}) => {
    const counted = { reads: 0 };
    const row = { answer: 42 };

    Object.defineProperty(row, 'ob_type', {
        enumerable,
        get() {
            counted.reads++;
            if (throwing) throw new Error('the business getter ran');
            return 'business';
        }
    });

    return { row, counted };
};

const native = (options) => {
    const { row, counted } = record(options);

    return { copy: Object.fromEntries(Object.entries(row)), reads: counted.reads };
};

test.for([
    ['hidden', {}],
    ['enumerable', { enumerable: true }],
    ['throwing and hidden', { throwing: true }]
])('to_py reads a %s getter as the copy does', ([, options]) => {
    const { row, counted } = record(options);
    const witness = native(options);

    expect(plainData(pyData(row))).toEqual(witness.copy);
    expect(counted.reads).toBe(witness.reads);
});

test.for([
    ['hidden', {}],
    ['enumerable', { enumerable: true }]
])('to_js hands a %s getter on unread, to_json and urlencode read it as the copy does', ([, options]) => {
    const copied = record(options);
    const serialised = record(options);
    const encoded = record(options);
    const witness = native(options);

    // A JavaScript record is JavaScript's already, and `to_js` hands it on.
    expect(plainData(copied.row)).toBe(copied.row);
    expect(copied.counted.reads).toBe(0);
    expect(JSON.parse(to_json(serialised.row))).toEqual(witness.copy);
    expect(serialised.counted.reads).toBe(witness.reads);
    expect(urlencode(encoded.row)).toBe(new URLSearchParams(witness.copy).toString());
    expect(encoded.counted.reads).toBe(witness.reads);
});

// `to_py` hands a value that is already Python back as itself. A dict keeps its
// class under a symbol, which the question did not read, so it was copied: two
// names stopped being one dict, and a key that is not a string, kept in the
// dict's table, never arrived, `to_py({7: 42})` coming back empty. `python3`
// has no `to_py`; the contract is the identity, at the root and inside a
// JavaScript object, beside a JavaScript object it does convert.
test.for([['answer'], [7]])('to_py keeps a Python dict keyed %s as itself', async ([key]) => {
    const { kept } = await import('./fixtures/to_py_identity.py');

    expect(kept(key)).toEqual([true, true, true]);
});

test('to_py keeps a Python dict inside a JavaScript object, and converts the object', async () => {
    const { converted } = await import('./fixtures/to_py_identity.py');
    const $B = globalThis.__BRYTHON__;
    const original = $B.builtins.dict.$factory();

    $B.$setitem(original, 'answer', 42);

    expect($B.$getitem(pyData({ child: original }), 'child')).toBe(original);
    expect(converted()).toEqual(['dict', 42]);
});

// What a `toJSON` hands back is asked the walk's refusals again, a set among
// them, and `JSON.stringify` runs a hidden getter of it no more than it runs
// one of the record itself.
test('to_json reads what a toJSON hands back as JSON.stringify does', () => {
    const python = record();
    const witness = record();

    expect(JSON.parse(to_json({ toJSON: () => python.row }))).toEqual(
        JSON.parse(JSON.stringify({ toJSON: () => witness.row }))
    );
    expect(python.counted.reads).toBe(witness.counted.reads);
});
