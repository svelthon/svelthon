// A dict handed to JavaScript as a live view, a prop to a JavaScript child or a
// context, showed its string keys only: `{7: 42}` was `{}` to the child, with
// nothing said, where `to_js` writes `{"7": 42}`. The view names every key as
// the copy names it (`propertyKey`), reads, writes and deletes the dict's own
// key through that name, and refuses two keys of one name, `7` and `"7"`, as
// the copy refuses them, where it kept one and dropped the other.
//
// The witness is the copy itself, `plainData`, and the JavaScript object it
// writes.
import { test, expect } from 'vitest';
import { flushSync } from 'svelte';
import { mount } from './mounted.js';
import { __pybridge, plainData, pyBind } from '../src/lib/runtime.js';
import MappingKeys from './fixtures/MappingKeys.svelte';

const $B = globalThis.__BRYTHON__;

const dict = (pairs) => {
    const out = $B.builtins.dict.$factory();

    for (const [key, value] of pairs) $B.$setitem(out, key, value);

    return out;
};

test.for([
    ['an int', () => 7, '7'],
    ['a float', () => pyBind(1.5), '1.5'],
    ['a str', () => 'answer', 'answer']
])('a view of a dict keyed by %s reads as the copy does', ([, key, name]) => {
    const original = dict([[key(), 42]]);
    const copy = plainData(original);

    for (const view of [__pybridge.bound(original), __pybridge.toContext(original)]) {
        expect(Object.keys(view)).toEqual(Object.keys(copy));
        expect(view[name]).toBe(42);
        expect(JSON.parse(JSON.stringify(view))).toEqual(copy);
    }
});

test('a write and a delete through the name reach the dict’s own key', () => {
    const original = dict([[7, 42]]);
    const view = __pybridge.bound(original);

    view['7'] = 43;
    expect([$B.$getitem(original, 7), $B.builtins.len(original)]).toEqual([43, 1]);

    delete view['7'];
    expect($B.builtins.len(original)).toBe(0);
});

test('two keys of one name are refused, as the copy refuses them', () => {
    const original = dict([[7, 42], ['7', 99]]);

    expect(() => plainData(original)).toThrow('two keys JavaScript cannot tell apart');
    expect(() => Object.keys(__pybridge.bound(original))).toThrow('two keys JavaScript cannot tell apart');
});

test('a JavaScript child handed the dict reads its key', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(MappingKeys, { target });
    flushSync();

    expect(target.querySelector('p').textContent).toBe('7|42|{"7":42}');
    target.remove();
});
