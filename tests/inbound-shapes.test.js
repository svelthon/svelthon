// @vitest-environment node
//
// Two questions the inbound crossing asked by *name* and had to ask by type.
//
// **Is this already Python?** was asked as `ob_type === undefined`. That is a
// field name, and data is allowed to carry it: `{"ob_type": "business", "value":
// 42}` is ordinary JSON, and it took the branch meant for Brython's own objects.
// A real Python object carries a class there, so the class is what answers.
//
// **Does this need finishing?** was asked by probing for a method called
// `to_dict` and calling it as a JavaScript function. On a Python instance that
// defines one — an ordinary serialisation helper — it is a bound method, an
// object, and `to_py` raised `toDict is not a function` on a value it was meant
// to leave alone. The test is identity now: `jsobj2pyobj` hands back the same
// object when nothing needed converting, so there is nothing to finish.
import { test, expect, describe } from 'vitest';
import {
    already,
    with_helper,
    helper_is_untouched,
    field_named_type,
    python_mapping_json
} from './fixtures/inbound_shapes.py';
import { plainData } from '../src/lib/bridge.js';
import { tojson } from '../src/lib/helpers.js';

describe('to_py on a value that is already Python', () => {
    test('hands back the same object', () => {
        expect(already()).toBe(true);
    });

    test('and still does when the class defines to_dict', () => {
        expect(with_helper()).toBe(true);
    });

    test('without calling it behind the author’s back', () => {
        expect(helper_is_untouched()).toBe(true);
    });
});

describe('to_py on data whose field is called ob_type', () => {
    // Two halves. The routing was ours and is repaired above. What the rebuild
    // then met was the engine's: a dict keeps its string keys as own JavaScript
    // properties, and that one shadowed the name Brython reads back, so three
    // lines of plain Python were enough to break a dictionary —
    //
    //     d = {}
    //     d["ob_type"] = "business"
    //     d["value"] = 42     # TypeError
    //
    // — the same shape as the `__proto__` key, and the same predicate.
    // The engine Bryntime ships carries the repair, and Bryntime's own tests
    // guard that the bundle still does.
    test('is data, not a Python object', () => {
        expect(field_named_type({ ob_type: 'business', value: 42 })).toEqual(['business', 42]);
    });

    // And when the field holds null: the class is what answers, at every site
    // that reads one, and null is no class. It arrives as `javascript.NULL`,
    // the `null` it is, and goes back as `null`.
    test('holding null, it crosses in, out, and through tojson', () => {
        const data = { ob_type: null, value: 42 };

        expect(Array.from(field_named_type(data))).toEqual([null, 42]);
        expect(plainData(data)).toEqual(data);
        expect(JSON.parse(tojson(data))).toEqual(data);
        expect(JSON.parse(python_mapping_json())).toEqual(data);
    });
});
