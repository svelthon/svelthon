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

test.for([
    ['dict', 'a,b|undefined'],
    ['int', '1,b|undefined'],
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
