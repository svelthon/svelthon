// **A name of the module is the module's, whatever JavaScript calls by it.** The
// generated code reached JavaScript's `Object`, `Symbol` and `Error` by those
// names, the global object by `globalThis` and an unlimited arity by `Infinity`,
// in the scope where the module's own names are bound: a component binding
// `Object` or `Symbol` stopped loading, one binding `globalThis` made `js` its
// value, one binding `Infinity` cut a handler's arguments to its number. It
// reaches them through the runtime now (`__global`), and `1 / 0`. `undefined`,
// which it writes everywhere, is refused at its line, as a reserved word is.
// Each value is what Python makes of the same module.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import JavascriptGlobals from './fixtures/JavascriptGlobals.svelte';
import GlobalsBindable from './fixtures/GlobalsBindable.svelte';
import GlobalsBindableFunction from './fixtures/GlobalsBindableFunction.svelte';
import GlobalsBindableNative from './fixtures/GlobalsBindableNative.svelte';
import * as names from './fixtures/global_names.py';
import { compile } from '../src/lib/compile.js';

test('a name JavaScript gives its globals is the module’s own', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(JavascriptGlobals, { target });
    flushSync();
    target.querySelector('button').click();
    flushSync();

    expect({
        sum: target.querySelector('p').textContent,
        js: target.querySelector('output').textContent,
        calls: target.querySelector('span').textContent,
        module: [names.Object, names.raised()]
    }).toEqual({ sum: '21', js: '2', calls: '[1]', module: [10, 'Error: mine'] });
});

// The setter of a bindable prop compared what crossed with `Object.is`, by that
// name: a module binding `Object` to a number stopped it mounting, or writing
// the prop, and one exporting a function under it stopped it mounting, the
// function's binding not made yet. The Svelte child binding `Object` is the
// witness.
test('a bindable prop is written beside a module binding Object, as in Svelte', () => {
    const shown = (Component) => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(Component, { target });

        flushSync();
        const initial = target.textContent.trim();

        instance.change(9);
        flushSync();

        return [initial, target.textContent.trim()];
    };

    expect(shown(GlobalsBindableNative)).toEqual(['7', '9']);
    expect(shown(GlobalsBindable)).toEqual(shown(GlobalsBindableNative));
    expect(shown(GlobalsBindableFunction)).toEqual(['', '9']);
});

test('undefined bound by a module is refused at its line', () => {
    let error;

    try {
        compile('x = 1\nundefined = 5\n', 'Probe', 'src/probe.svelte', {});
    } catch (thrown) {
        error = thrown;
    }

    expect(error?.message).toMatch(/`undefined` is JavaScript's own value/);
    expect(error.start.line).toBe(2);
});
