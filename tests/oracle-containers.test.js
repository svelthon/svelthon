import { test, expect } from 'vitest';
import { cpython, mounted } from './oracle.js';
import OracleContainers from './fixtures/OracleContainers.svelte';

// The differential oracle's containers: a list, a dict and a set, held by a
// module name, an instance, a class, a dict, a list or a tuple, changed every
// way Python changes them and read four ways, against CPython running the same
// script. See `oracle-attributes.test.js` for the two questions asked.
const expected = cpython('OracleContainers.svelte');

// And changed from JavaScript, through the view the component hands out: the
// fixture writes each operation's Python equivalent under the same name, which
// is what CPython runs.
const FROM_JAVASCRIPT = {
    'js push': (view, step) => view.push(step),
    'js pop': (view) => view.pop(),
    'js shift': (view) => view.shift(),
    'js unshift': (view, step) => view.unshift(step),
    'js splice out': (view) => view.splice(0, 1),
    'js splice in': (view, step) => view.splice(1, 0, step),
    'js index': (view, step) => {
        view[0] = step;
    },
    'js length': (view) => {
        view.length = 0;
    },
    'js reverse': (view) => view.reverse(),
    'js fill': (view, step) => view.fill(step),
    'js key': (view, step) => {
        view[`k${step}`] = step;
    },
    'js overwrite': (view, step) => {
        view.a = step;
    },
    'js delete key': (view) => {
        delete view[Object.keys(view)[0]];
    },
    'js assign': (view, step) => Object.assign(view, { u: step }),
    'js add': (view, step) => view.add(step + 10),
    'js delete': (view, step) => view.delete(step),
    'js clear': (view) => view.clear()
};

test('the oracle has its cases, and every JavaScript write its operation', () => {
    const writes = new Set(Object.keys(expected).map((kind) => kind.split('|')[2]));

    expect(Object.keys(expected).length).toBeGreaterThan(1000);
    expect([...writes].filter((one) => one.startsWith('js ') && !(one in FROM_JAVASCRIPT))).toEqual([]);
});

test.for(Object.keys(expected))('%s', (kind) => {
    const write = kind.split('|')[2];
    const { models, pages } = mounted(OracleContainers, kind, (instance, target, step) =>
        write in FROM_JAVASCRIPT ? FROM_JAVASCRIPT[write](instance.view(), step) : instance.change(step)
    );

    expect(models, 'the model, against CPython').toEqual(expected[kind]);
    expect(pages, 'the page, against the model').toEqual(models);
});
