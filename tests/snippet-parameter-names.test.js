// **A snippet's own scope may bind the snippet's name**, as a Python
// function's may: a parameter, by a default, a pattern, both, or a spelling
// Python reads as that name, a value its body declares, or a snippet its body
// declares. Svelte's own snippet renders, and so does Svelthon's. The snippet
// announced itself by its name inside that scope, where the `{const}` or the
// `{let}` hid it, `Cannot access 'row' before initialization`, and where a
// snippet of the same name was announced in its place, its arguments then
// crossing as a JavaScript snippet's.
//
// And a parameter list Python and Svelte refuse is refused: a name bound
// twice, which with every position renamed Svelte no longer saw, one of the
// two values taken silently; and an empty position, which was dropped. One
// key read twice under two names binds two names, and a trailing comma is a
// list's own.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { pythonExpressions, collector } from '../src/lib/markup.js';
import SnippetSelfNamed from './fixtures/SnippetSelfNamed.svelte';
import SnippetSelfNested from './fixtures/SnippetSelfNested.svelte';

const shown = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(Component, { target });
    flushSync();
    return [...target.querySelectorAll('output')].map((one) => one.textContent);
};

test('a snippet whose own scope binds its name renders, as Svelte’s does', () => {
    expect(shown(SnippetSelfNamed)).toEqual(Array(10).fill('ok'));
});

test('a snippet whose body declares a snippet of its name is handed Python values by a Python child', () => {
    expect(shown(SnippetSelfNested)).toEqual(['float', 'Price', 'Label']);
});

const compiled = (markup) =>
    pythonExpressions(markup, collector([]), undefined, { filename: 'Probe.svelte', content: markup, offset: 0 });

test.for([
    ['row(value, value)', 'value'],
    ['row(value, value="fallback")', 'value'],
    ['row(value, {value})', 'value'],
    ['row([value], value)', 'value'],
    ['row({a: {value}}, value)', 'value'],
    ['row(ﬁeld, field)', 'field']
])('a snippet %s binding a name twice is refused', ([head, name]) => {
    expect(() => compiled(`{#snippet ${head}}{/snippet}`)).toThrow(`duplicate argument '${name}' in snippet definition`);
});

test.for([['row(,value)'], ['row(first,,second)'], ['row(value,,)'], ['row(,)'], ['row(,,)'], ['row( , value)']])(
    'a snippet %s with an empty position is refused',
    ([head]) => {
        expect(() => compiled(`{#snippet ${head}}{/snippet}`)).toThrow('empty parameter position in snippet definition');
    }
);

test.for([['row({id: first, id: second})'], ['row()'], ['row(value,)'], ['row(first,second)']])(
    'a snippet %s is accepted',
    ([head]) => {
        expect(() => compiled(`{#snippet ${head}}{/snippet}`)).not.toThrow();
    }
);
