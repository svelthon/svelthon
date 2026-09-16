// @vitest-environment node
//
// `{1: "janvier", 2: "février"}` crossed to JavaScript as `{}`.
//
// A Brython dict keeps its string keys as ordinary properties and everything
// else in a hash table, and this converter read the properties alone — under a
// comment saying a dict keeps its keys there, which is true of the string ones
// and of nothing else. No error, no warning, no partial result: an empty object,
// through `to_js`, through `tojson`, and through every Python function's return
// value.
//
// `pyEntries` was already written, already correct, already used at five sites.
// The sixth is the one that crosses the boundary.
//
// `tests/numeric-keys.test.js` was green throughout: it asks what a template
// *renders*, which is Python's own repr, and never what crosses. A green suite
// says nothing about the questions it does not ask.
import { test, expect, describe } from 'vitest';
import { plainData } from '../src/lib/runtime.js';
import { tojson } from '../src/lib/helpers.js';

const $B = globalThis.__BRYTHON__;
const _b_ = $B.builtins;

const dict = (entries) => {
    const out = _b_.dict.$factory();

    for (const [key, value] of entries) $B.$setitem(out, key, value);

    return out;
};

describe('a dict whose keys are not strings', () => {
    test('crosses with its entries', () => {
        const months = dict([
            [1, 'janvier'],
            [2, 'février']
        ]);

        expect(plainData(months)).toEqual({ 1: 'janvier', 2: 'février' });
        expect(JSON.parse(tojson(months))).toEqual({ 1: 'janvier', 2: 'février' });
    });

    test('mixed with string keys, which were the half that worked', () => {
        expect(plainData(dict([[1, 'a'], ['b', 2]]))).toEqual({ 1: 'a', b: 2 });
    });

    test('nested one level down', () => {
        expect(plainData(dict([['mois', dict([[1, 'janvier']])]]))).toEqual({
            mois: { 1: 'janvier' }
        });
    });

    // A JavaScript property name is a string, and a Brython float is an object,
    // so the key crosses through the converter too.
    test.for([
        ['a float', () => _b_.float.$factory(1.5), '1.5'],
        ['a bool', () => true, 'true'],
        ['and __proto__, a key like any other', () => '__proto__', '__proto__']
    ])('%s becomes the name it reads as', ([, make, name]) => {
        const out = plainData(dict([[make(), 'x']]));

        expect(Object.keys(out)).toEqual([name]);
        expect(out[name]).toBe('x');
    });

    // The control the audit used: a string key was never lost, which is what
    // made the rest look like nothing at all.
    test('while a string key is untouched', () => {
        expect(plainData(dict([['a', 1], ['b', 2]]))).toEqual({ a: 1, b: 2 });
    });

    // Two keys Python keeps apart that a property name cannot. The narrowing is
    // JavaScript's; the silence would have been ours, and the project's rule for
    // this moment is written one file over — a serialiser meeting something it
    // cannot serialise owes the author a sentence.
    test.for([
        ['an int beside its own spelling', () => [[1, 'a'], ['1', 'b']]],
        ['a bool beside its own spelling', () => [[true, 'a'], ['true', 'b']]]
    ])('%s says so instead of dropping one', ([, entries]) => {
        expect(() => plainData(dict(entries()))).toThrow(/two keys JavaScript cannot tell apart/);
        expect(() => tojson(dict(entries()))).toThrow(/two keys JavaScript cannot tell apart/);
    });
});
