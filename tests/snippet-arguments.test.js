import { test, expect, describe } from 'vitest';
import { createRawSnippet } from 'svelte';
import { mount, unmount, flushSync } from './mounted.js';
import SnippetArgsChild from './fixtures/SnippetArgsChild.svelte';
import SnippetArgsChildNative from './fixtures/SnippetArgsChildNative.svelte';
import SnippetArgsHost from './fixtures/SnippetArgsHost.svelte';
import SnippetArgsPythonHost from './fixtures/SnippetArgsPythonHost.svelte';
import SnippetLocalWhole from './fixtures/SnippetLocalWhole.svelte';
import SnippetAlias from './fixtures/SnippetAlias.svelte';
import SnippetAliasNative from './fixtures/SnippetAliasNative.svelte';
import SnippetAliasTypes from './fixtures/SnippetAliasTypes.svelte';
import SnippetForeignAliasHost from './fixtures/SnippetForeignAliasHost.svelte';
import SnippetAttribute from './fixtures/SnippetAttribute.svelte';
import SnippetAttributeNative from './fixtures/SnippetAttributeNative.svelte';
import SnippetCallee from './fixtures/SnippetCallee.svelte';
import SnippetCalleeNative from './fixtures/SnippetCalleeNative.svelte';
import SnippetPythonParent from './fixtures/SnippetPythonParent.svelte';
import SnippetPythonChildHost from './fixtures/SnippetPythonChildHost.svelte';

const shown = async (Component, props) => {
    const target = document.body.appendChild(document.createElement('div'));
    let instance;

    try {
        instance = mount(Component, { target, props });
        flushSync();
    } catch (error) {
        return `ERROR: ${error.message}`;
    }

    const text = [...target.querySelectorAll('p')].map((one) => `${one.dataset.k}=${one.textContent}`).join(' ');

    await unmount(instance);

    return text;
};

// A Python child renders the snippet its parent gave it. The parent may be
// JavaScript, and then the snippet is handed what a JavaScript child would hand
// it: a number, an absence, a callback it can call with its own arguments.
describe('a snippet a JavaScript parent gives a Python child', () => {
    test('is handed what a Svelte child hands it', async () => {
        expect(await shown(SnippetArgsHost, { Child: SnippetArgsChild })).toBe(
            await shown(SnippetArgsHost, { Child: SnippetArgsChildNative })
        );
    });

    test('the Svelte child is the rule', async () => {
        expect(await shown(SnippetArgsHost, { Child: SnippetArgsChildNative })).toBe(
            'number=number:0.25 absence=true callback=7 ready=ready'
        );
    });
});

// A snippet this markup declares is handed Python values as they are: `1.0`
// is a float, as CPython has it, where a number made JavaScript's would come
// back an int.
test('a snippet of the same markup keeps a whole float', async () => {
    expect(await shown(SnippetLocalWhole)).toBe('own=float:1.0');
});

// The same snippet rendered through an alias, `{alias = row}`, is handed the
// same values: the callable is itself again, as Svelte's is, and the float a
// float.
test('a snippet rendered through an alias is handed what its name is handed', async () => {
    expect(await shown(SnippetAlias)).toBe('row=True|7|float row=True|7|float');
});

test('the Svelte markup is the rule', async () => {
    expect(await shown(SnippetAliasNative)).toBe('row=true|7|number row=true|7|number');
});

// And values a JavaScript number cannot carry, which `0.5` above could not
// tell: the alias was decided by its name, not one of the markup's snippets,
// and its arguments crossed as a prop's, `1.0` an int and a subclass its base.
// What the name renders, CPython's `type(1.0)` among them, is the rule.
test('a snippet rendered through an alias keeps a whole float and subclasses', async () => {
    expect(await shown(SnippetAliasTypes)).toBe(
        'row=float:1.0 row=float:1.0 row=Price:0.5 row=Price:0.5 row=Label:a row=Label:a'
    );
});

// The other half, which the same decision must keep: a snippet the parent gave,
// under an alias beside the markup's own, is still the parent's.
test('a snippet a JavaScript parent gave, through an alias, is handed a number', async () => {
    expect(await shown(SnippetForeignAliasHost)).toBe('own=float:1.0 parent=number:0.50');
});

// `{@render holder.fn()}` read `holder.fn` as a JavaScript property, which a
// Python instance does not have: the snippet it holds was not found. Read as
// Python reads it, by a key too, absent through `?.`, and the markup's own
// snippet under an attribute still handed Python values.
test('a snippet held by an attribute renders as Svelte renders it', async () => {
    expect(await shown(SnippetAttribute)).toBe('raw=ok raw=ok raw=ok own=float:1.0');
});

test('the Svelte markup is the rule for attributes', async () => {
    expect(await shown(SnippetAttributeNative)).toBe('raw=ok raw=ok raw=ok own=number:1');
});

// The call is the last group of the expression, not its first parenthesis: a
// grouped callee was read as an empty one, and a factory's own call as the
// render's, its arguments left JavaScript (`True` was undefined) or crossed.
// What Svelte renders is the rule, CPython's `type(1.0)` and `True` beside it.
test('a snippet reached by a grouped, chosen or returned callee is handed Python values', async () => {
    expect(await shown(SnippetCallee)).toBe('first=float:1.0 first=float:1.0 first=float:1.0 first=bool:True');
});

test('the Svelte markup is the rule for callees', async () => {
    expect(await shown(SnippetCalleeNative)).toBe(
        'first=number:1 first=number:1 first=number:1 first=boolean:true'
    );
});

// A Python parent's snippet is Python's wherever a Python child renders it
// from: it says so as it runs, and is handed what the child handed it, a whole
// float and two subclasses, where it was handed an int, a float and a str. A
// JavaScript parent's, beside it, is handed JavaScript's.
test.for(['bare', 'alias', 'dict'])('a Python parent snippet a Python child renders %s keeps its values', async (kind) => {
    expect(await shown(SnippetPythonParent, { kind })).toBe('parent=float:1.0|Price|Label');
    expect(await shown(SnippetPythonChildHost, { kind })).toBe('parent=number:1|number|string');
});

// A Python parent's snippet rendered by a Python child still reads Python
// values: a float, None and a callable.
test('a snippet a Python parent gives a Python child reads Python values', async () => {
    expect(await shown(SnippetArgsPythonHost)).toBe('python=float:0.5|True|7 ready=ready');
});

// `{@render footer?.()}` renders nothing when the prop is absent, however it is
// absent, as Svelte's does, and renders the snippet when one is given.
describe('an optional snippet', () => {
    const footer = createRawSnippet(() => ({ render: () => '<p data-k="footer">given</p>' }));

    test.each([
        ['omitted', {}],
        ['undefined', { footer: undefined }],
        ['null', { footer: null }],
        ['given', { footer }]
    ])('%s, as Svelte does', async (_, props) => {
        expect(await shown(SnippetArgsChild, props)).toBe(await shown(SnippetArgsChildNative, props));
    });

    test('the Svelte child is the rule', async () => {
        expect(await shown(SnippetArgsChildNative, {})).toBe('ready=ready');
        expect(await shown(SnippetArgsChildNative, { footer })).toBe('footer=given ready=ready');
    });
});
