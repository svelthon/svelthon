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
import { plainData, pyExport } from '../src/lib/runtime.js';
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

    // And the export, which writes a mapping out at the second site.
    //
    // The branch that adapts a dict holding a function spelled its keys by
    // handing the Python object to `defineProperty` and letting JavaScript
    // coerce it, which skipped both halves of the rule above: a float key was
    // fine by luck, and a collision crossed silently as one entry of two. The
    // dict *without* the function raised, for the same Python values, which is
    // what makes this a bypass rather than a limit.
    const withFunction = (entries) => [...entries, ['fn', () => 0]];

    // The export is the dict's view, which refuses the name when it is read.
    test('a function in the dict does not buy a way past the refusal', () => {
        const entries = [[1, 'numeric'], ['1', 'text']];

        for (const exported of [pyExport(dict(entries), 'm'), pyExport(dict(withFunction(entries)), 'm')]) {
            expect(() => Object.keys(exported)).toThrow(/two keys JavaScript cannot tell apart/);
            expect(() => exported['1']).toThrow(/two keys JavaScript cannot tell apart/);
        }
    });

    // A JavaScript symbol is a key like any other since `symbol-hash`, and the
    // copy and the export wrote it as its description, `"Symbol(tail)"`: the key
    // the dict was asked by never arrived, and two symbols of one name folded
    // into one. It crosses as itself, as JavaScript's `{[token]: 1}` keeps it
    // and as a spread already wrote it. JSON has no notation for one, and the
    // serialiser refuses it as it refuses a symbol value, where `JSON.stringify`
    // drops it in silence; CPython's `json.dumps` refuses any key that is not a
    // str, an int, a float, a bool or None.
    test('a symbol key crosses as itself, and has no JSON', () => {
        const [token, twin] = [Symbol('tail'), Symbol('tail')];
        const copied = plainData(dict([[token, 1], [twin, 2], ['a', 3]]));
        const exported = pyExport(dict(withFunction([[token, 1]])), 'm');

        expect([copied[token], copied[twin], copied.a, Object.keys(copied)]).toEqual([1, 2, 3, ['a']]);
        expect(exported[token]).toBe(1);
        expect(() => tojson(dict([[token, 1]]))).toThrow('tojson(): Symbol(tail) is a symbol, and a symbol has no JSON');
    });

    // A key "ob_type" is the author's, whatever it holds. Holding a class, it
    // was taken for the engine's mark: `{"ob_type": float, "value": 42, "label":
    // "kept"}` crossed as the number 42, its label gone. `python3` keeps the
    // three entries.
    test('a key "ob_type" holding a class crosses as an entry', () => {
        const classy = () => dict([['ob_type', _b_.float], ['value', 42], ['label', 'kept']]);
        const copied = plainData(classy());
        const exported = pyExport(classy(), 'm');

        expect([Object.keys(copied), copied.label]).toEqual([['ob_type', 'value', 'label'], 'kept']);
        expect([Object.keys(exported), exported.label]).toEqual([['ob_type', 'value', 'label'], 'kept']);
    });

    // A Brython float is an object, so this is the half that coercion could not
    // spell at all: `[object Object]`. An int key survived it by luck, which is
    // why the bypass stayed invisible.
    test('and a float key crosses as the name it reads as, not as an object', () => {
        const out = pyExport(dict(withFunction([[1, 'one'], [_b_.float.$factory(2.5), 'half']])), 'm');

        expect(Object.keys(out).sort()).toEqual(['1', '2.5', 'fn']);
        expect(out['2.5']).toBe('half');
    });
});
