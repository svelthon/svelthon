// @vitest-environment node
//
// The export boundary, exercised the way a route module is: a plain `.py` whose
// functions the framework calls by name. Node rather than jsdom, because that is
// where a `load()` actually runs.
import { test, expect, describe } from 'vitest';
import { one, nested, looping, empty, mixed, dumped, indented, plain } from './fixtures/objects.py';

// Brython keeps an instance's attributes under a private symbol rather than as
// JavaScript properties. Walking the object's own keys therefore found almost
// nothing and wandered into the class, until the stack gave out — a
// `RangeError: Maximum call stack size exceeded` naming neither the file nor the
// value. Returning a Python object from a `load()` has to work.
describe('a Python object crossing the boundary', () => {
    test('arrives as its fields', () => {
        expect(one()).toEqual({ number: 703, tags: ['gil'] });
    });

    test('a @property is not a field, exactly as in JavaScript', () => {
        // `JSON.stringify(new Pep())` does not serialise a getter on the
        // prototype either. The rule is the host's, not ours.
        expect(one()).not.toHaveProperty('url');
    });

    test('nested inside containers, at any depth', () => {
        expect(nested()).toEqual({
            pep: { number: 750, tags: ['strings'] },
            rows: [
                { number: 1, tags: [] },
                { number: 20, tags: [] }
            ]
        });
    });

    test('an object with no attribute is an empty object, not a crash', () => {
        expect(empty()).toEqual({});
    });

    test('alongside plain values, and shared is not circular', () => {
        // The same object twice in one list is shared, not looping: both
        // occurrences have to come out. Tracking every value ever converted,
        // rather than the branch being walked, would blank the second one.
        expect(mixed()).toEqual({
            count: 2,
            peps: [
                { number: 484, tags: ['typing'] },
                { number: 484, tags: ['typing'] }
            ],
            none: null
        });
    });
});

describe('a graph that loops back', () => {
    test('terminates instead of exhausting the stack', () => {
        // The guard is what turns an unbounded recursion into a value. What the
        // loop becomes matters less than the fact that the call returns at all.
        const seen = looping();

        expect(seen.number).toBe(8);
        expect(seen.itself).toBeNull();
    });
});

// Jinja's `|tojson`: the same need, and the same reason it cannot be
// `json.dumps` — an instance's fields are not where a Python dump looks.
describe('to_json', () => {
    test('an instance becomes its fields', () => {
        expect(JSON.parse(dumped())).toEqual({ number: 703, tags: ['gil'] });
    });

    test('an indent is honoured', () => {
        expect(indented()).toBe('{\n  "a": 1\n}');
    });

    test('and None, True and a list keep JSON\'s spelling', () => {
        expect(plain()).toBe('[1,"two",null,true]');
    });
});
