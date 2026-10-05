// A spread copied a Python dict as a JavaScript object: its child was handed
// the engine's storage beside the dict's keys (`OB_TYPE`, `VERSION`, and with
// an int key `TABLE`, `KEYS`, `VALUES`, `HASHES`), a key that is not a string
// never arrived, and a mapping that is not a dict arrived empty. `**rest` and a
// spread asked "what are a mapping's entries?" and answered it two ways.
//
// One answer now, what `**` takes of a value in the markup: a mapping's entries
// as Python's `{**value}` reads them, each key written as the copy writes it, a
// symbol kept as itself; an instance's attributes, as its rest holds them; a
// JavaScript object's own enumerable properties, as JavaScript's `...` takes
// them. `python3` gives the keys of each mapping below, and Svelte the rest of
// a JavaScript row.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SpreadEntries from './fixtures/SpreadEntries.svelte';
import SpreadEntriesNative from './fixtures/SpreadEntriesNative.svelte';

const read = (Component, props) => {
    const target = document.body.appendChild(document.createElement('div'));

    try {
        mount(Component, { target, props });
        flushSync();

        return target.querySelector('p')?.textContent ?? target.querySelector('i')?.outerHTML;
    } finally {
        target.remove();
    }
};

// A symbol key arrives as itself, as JavaScript's `{first: 10, [token]: 20}`
// spreads it.
test.for([
    ['dict', 'a,b|undefined'],
    ['int', '1,b|undefined'],
    ['symbol-dict', 'first,sym:tail|20'],
    ['mapping', 'first,tail|undefined']
])('a %s spread hands its child its entries and nothing else', ([kind, expected]) => {
    expect(read(SpreadEntries, { kind })).toBe(expected);
});

test('the rest of a JavaScript row spreads its symbol, as Svelte does', () => {
    expect(read(SpreadEntries, { kind: 'symbol' })).toBe(read(SpreadEntriesNative));
    expect(read(SpreadEntries, { kind: 'symbol' })).toBe('sym:tail|20');
});

test('a mapping spread on an element gives its attributes', () => {
    expect(read(SpreadEntries, { kind: 'element' })).toBe('<i first="10" tail="20"></i>');
});

// An instance spread its engine's slots; it spreads its attributes now, what
// `**rest` takes of one too.
test('an instance spreads its attributes, as its rest holds them', () => {
    expect(read(SpreadEntries, { kind: 'plain' })).toBe('first|undefined');
});

// A function was taken for a JavaScript one, the engine's own included, and a
// Python function spread the engine's fields, `$function_infos`, `ob_type`,
// `__annotate__`. A Python function spreads its attributes, `vars(f)` in
// `python3`: `mark`. A JavaScript function its own properties, as
// JavaScript's `{...counted}` takes them: `calls`.
test.for([
    ['function', 'mark|undefined'],
    ['js-function', 'calls|undefined']
])('a %s spreads what its language spreads of it', ([kind, expected]) => {
    expect(read(SpreadEntries, { kind })).toBe(expected);
});

// A value with neither entries nor attributes raised a TypeError about
// `vars()`, a function the author never wrote, and a str, an int or a bool
// were spread as JavaScript spreads them, past the rule a rest keeps: a str
// handed its child one prop per character, and on an element raised the DOM's
// `"0" did not match the Name production`. Each raises what Python's own
// `{**value}` raises, naming the class, on a component and on an element alike.
// `python3`, `{**value}` on each: `'NoneType' object is not a mapping`,
// `'list'`, `'str'`, `'int'`, `'bool'`, `'Slotted'`.
test.for([
    ['none', 'NoneType'],
    ['list', 'list'],
    ['str', 'str'],
    ['number', 'int'],
    ['bool', 'bool'],
    ['slots', 'Slotted'],
    ['element-none', 'NoneType'],
    ['element-str', 'str']
])('a %s spread raises as `{**value}` does', ([kind, type]) => {
    expect(() => read(SpreadEntries, { kind })).toThrow(
        `TypeError: '${type}' object is not a mapping, and has no attributes for ** to take`
    );
});

// `{1: "a", "1": "b"}` handed its child one value and lost the other, and the
// same dict written the other way round was refused: a string key was written
// as it stood, so the check saw it only after its twin. Every key is written as
// the copy writes it, and both orders are refused, as the copy refuses them.
test.for(['int-first', 'str-first'])('a dict with %s twin keys is refused', (kind) => {
    expect(() => read(SpreadEntries, { kind })).toThrow('two keys JavaScript cannot tell apart');
});
