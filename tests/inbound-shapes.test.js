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
    field_named_type
} from './fixtures/inbound_shapes.py';

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
    // The routing is repaired: such an object is data now, and takes the branch
    // that rebuilds a dict. What it meets there is **Brython's**, and three
    // lines of plain Python are enough to show it, with no Svelthon in sight:
    //
    //     d = {}
    //     d["ob_type"] = "business"
    //     d["value"] = 42     # TypeError
    //
    // A dict keeps its string keys as own JavaScript properties, and that one
    // collides with a name the engine reads back — the same shape as the
    // `__proto__` key, which is fixed upstream and survives here. CPython 3.14.4
    // prints the dict.
    //
    // So this records the limit rather than pretending it is ours to fix. When
    // the engine stops colliding, this test is what says the assertion below can
    // become the value.
    test('crosses as far as the engine allows, and says where it stopped', () => {
        expect(() => field_named_type({ ob_type: 'business', value: 42 })).toThrow(
            /does not support item assignment/
        );
    });
});
