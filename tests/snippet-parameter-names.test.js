// **A snippet's parameter may carry the snippet's name**, as a Python
// function's may: Svelte's own snippet renders, and so does Svelthon's, by a
// default, a pattern, both, or a spelling Python reads as that name. The
// snippet announced itself by its name inside its own scope, where the
// parameter's `{const}` hid it: `Cannot access 'row' before initialization`.
//
// And a name a parameter list binds twice is refused, as Python refuses it
// and Svelte does: with every position renamed, Svelte saw no clash, and one
// of the two values was taken silently. One key read twice under two names
// binds two names.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { pythonExpressions, collector } from '../src/lib/markup.js';
import SnippetSelfNamed from './fixtures/SnippetSelfNamed.svelte';

test('a snippet whose parameter carries its name renders, as Svelte’s does', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(SnippetSelfNamed, { target });
    flushSync();

    expect([...target.querySelectorAll('output')].map((one) => one.textContent)).toEqual(Array(7).fill('ok'));
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

test('a snippet reading one key twice under two names is accepted', () => {
    expect(() => compiled('{#snippet row({id: first, id: second})}{first}{second}{/snippet}')).not.toThrow();
});
