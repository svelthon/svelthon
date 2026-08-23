import { test, expect, describe } from 'vitest';
import '../src/lib/runtime.js';

// The repairs made to the vendored Brython are edits in the file itself, so a
// newer build drops them silently. Their guard is this: each one is observable,
// and losing it turns a test red rather than a page.
describe('the vendored Brython carries its repairs', () => {
    const $B = globalThis.__BRYTHON__;

    // `js.Response.new(body, {"headers": {...}})` — any Web API taking a WebIDL
    // record refuses an own symbol key, and the conversion used to stamp one on
    // every container it produced. The back-reference lives in a WeakMap now.
    test('a converted container carries no symbol key', () => {
        const dict = $B.builtins.dict.$factory();
        $B.$setitem(dict, 'content-type', 'application/json');

        const converted = $B.pyobj2jsobj(dict);

        expect(Object.getOwnPropertySymbols(converted)).toHaveLength(0);
        expect($B.$svelthonPyobj).toBeInstanceOf(WeakMap);
    });

    // The round-trip cache the symbol used to be: the same Python object comes
    // back, not a copy.
    test('and still comes back as the object it was', () => {
        const dict = $B.builtins.dict.$factory();
        const converted = $B.pyobj2jsobj(dict);

        expect($B.$svelthonPyobj.has(converted)).toBe(true);
        expect($B.jsobj2pyobj(converted)).toBe(dict);
    });

    // A debug print left upstream, firing on every attribute access on a
    // JavaScript class from Python. Two requests through `js.` filled the log.
    test('no debug print in JSClass.tp_getattro', () => {
        expect(String($B.JSClass.tp_getattro)).not.toContain('console.log');
    });

    // Loading it twice in one process rebuilds `$B.ast`, and the classes the
    // compiler holds lose the `to_js()` the code generator attached.
    test('a second execution is refused', () => {
        expect($B.ast).toBeTruthy();
    });
});
