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

    // `str.find` handed its `start` straight to `indexOf`. One counts code
    // points, the other UTF-16 units, so an emoji before `start` moved the
    // search backwards and the same match came back for ever. The tutorial's
    // prose scanner walks the rendered HTML with exactly that loop, and the
    // page carrying the three wise monkeys pegged a core until the tab was
    // killed.
    test('str.find honours its start argument past an astral character', () => {
        // `$B.String` is the factory the compiler emits for a literal: it is
        // what records where the surrogate pairs are. A bare JavaScript string
        // carries none, and would not exercise the conversion at all.
        const find = (text, sub, start) => $B.$getattr(text, 'find')(sub, start);

        // 'a', an emoji, 'b', 'X', 'b', 'X' — the second X is at 5 in Python
        // and at 6 in JavaScript.
        const s = $B.String('a\u{1f600}bXbX');

        expect(find(s, 'X', 0)).toBe(3);
        expect(find(s, 'X', 4)).toBe(5);

        // The loop the defect used to make endless.
        let at = find(s, 'X', 0);
        const seen = [];
        while (at !== -1 && seen.length < 4) {
            seen.push(at);
            at = find(s, 'X', at + 1);
        }

        expect(seen).toEqual([3, 5]);
    });
});
