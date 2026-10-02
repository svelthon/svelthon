// **A callable at the root of a template expression arrives as well adapted as
// the same callable one level down.** Template expressions are converted by
// `pyNumbers`, which adapts the callables *inside* a value and walked a bound
// method as if it were a config, replacing its `im_func`; and the boundary of a
// prop handed a raw function on. So `config={{'cb': run}}` reached a JavaScript
// child as a callback and `cb={run}` as something that raised.
//
// The rows are the shapes; the positions are a prop, a handler, an attachment,
// and what an attachment hands back, which Svelte keeps as its cleanup only when
// `typeof` says function.
import { test, expect, describe } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import TemplateCallables from './fixtures/TemplateCallables.svelte';

const SHAPES = ['function', 'bound', 'classmethod', 'staticmethod', 'instance'];

const setup = (kind = 'function') => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(TemplateCallables, { target, props: { kind } });
    flushSync();

    return { instance, at: (k) => target.querySelector(`[data-k="${k}"]`) };
};

describe.for(SHAPES)('%s', (kind) => {
    test('is called by a JavaScript child as a prop, as it is one level down', () => {
        const { at } = setup(kind);

        expect(at('direct').textContent).toBe('0.25');
        expect(at('nested').textContent).toBe('0.25');
    });
});

test.for([
    ['a bound method', 'bound-handler'],
    ['a classmethod', 'classmethod-handler']
])('%s is a handler', ([, key]) => {
    const { instance, at } = setup();

    at(key).click();
    flushSync();

    expect(instance.hit_count()).toBe(1);
});

test.for([
    ['a bound method', 'attach-bound'],
    ['a callable instance', 'attach-instance']
])('an attachment handing back %s is cleaned up', ([, key]) => {
    const { instance, at } = setup();
    const node = at(key);

    expect(node.getAttribute('data-installed')).toBe('yes');

    unmount(instance);
    flushSync();

    expect(node.getAttribute('data-cleaned')).toBe('yes');
});
