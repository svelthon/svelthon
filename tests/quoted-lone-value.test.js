import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import QuotedLoneValue from './fixtures/warned/QuotedLoneValue.svelte';
import QuotedLoneValueNative from './fixtures/warned/QuotedLoneValueNative.svelte';

// `data="{value}"` is `data={value}` to Svelte 5: one interpolation between
// quotes, and nothing else, is the value itself. Only a directive, an attribute
// read for truth and a group's `value` were read so; any other went through the
// text branch, and every child read a `str`, a JavaScript one a string.
const shown = (Component, kind) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target, props: { kind } });
    flushSync();
    return target;
};

const read = (target, k) => target.querySelector(`[data-k="${k}"] output`).textContent;

test.for([
    ['int', 'int'],
    ['none', 'NoneType'],
    ['list', 'list'],
    ['function', 'function']
])('a lone interpolation between quotes hands a child the value itself: %s', ([kind, type]) => {
    const page = shown(QuotedLoneValue, kind);
    const native = shown(QuotedLoneValueNative, kind);

    for (const written of ['bare', 'double', 'single']) {
        expect(read(page, `python-${written}`)).toBe(type);
        expect(read(page, `js-${written}`)).toBe(read(native, `js-${written}`));
    }
});

// And the DOM: an `<option>` keeps the number its `<select>` is bound to, and
// None leaves an attribute out, as `undefined` does in Svelte's own.
test('a lone interpolation between quotes hands the DOM the value itself', () => {
    const page = shown(QuotedLoneValue, 'int');
    const native = shown(QuotedLoneValueNative, 'int');

    expect(page.querySelector('select').selectedIndex).toBe(0);
    expect(page.querySelector('select').selectedIndex).toBe(native.querySelector('select').selectedIndex);

    for (const name of ['href', 'title']) {
        expect(page.querySelector('a').hasAttribute(name)).toBe(false);
        expect(native.querySelector('a').hasAttribute(name)).toBe(false);
    }
});
