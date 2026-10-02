import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { pythonExpressions, collector } from '../src/lib/markup.js';
import SnippetNames from './fixtures/SnippetNames.svelte';

// A snippet is a value, which is what makes it more than the slot it replaced:
// it can be written once and handed to a child, to two children, or chosen
// between. Reaching for it means reading its name in an expression, and a
// template expression is Python here, so the name has to exist on that side.
//
// Its parameters always did. Its own name did not, because the parameters live
// inside the block and the name lives around it.
const rewrite = (markup) => {
    const defs = [];
    const out = pythonExpressions(markup, collector(defs));
    return { out, defs };
};

// The name reaches an expression only as an argument: nothing is looked up in
// the component's Python namespace, where a snippet never exists.
const takes = (defs, ...names) =>
    defs.some((one) => one.startsWith(`def __expr_`) && one.includes(`(${names.join(', ')}):`));

describe('a snippet name in a template expression', () => {
    test('is passed to the expression that reads it', () => {
        const { out, defs } = rewrite('{#snippet row(x)}<b>{x}</b>{/snippet}<Card {row} />');

        expect(out).toContain('<Card row={__expr_1(__follow(row))} />');
        expect(takes(defs, 'row')).toBe(true);
    });

    test('even above its own declaration, which Svelte hoists', () => {
        const { defs } = rewrite('<Card {row} />{#snippet row(x)}<b>{x}</b>{/snippet}');

        expect(defs[0].startsWith('def __expr_0(row):\n')).toBe(true);
    });

    test('under whichever prop name the child gives it', () => {
        const { out } = rewrite('{#snippet row(x)}<b>{x}</b>{/snippet}<Card header={row} />');

        expect(out).toContain('<Card header={__expr_1(__follow(row))} />');
    });

    // Only the names the expression reads: `{item}` reads neither the snippet's
    // own name nor its second parameter, so neither is passed.
    test('alongside its own parameters, when it reads them', () => {
        expect(takes(rewrite('{#snippet row(item, n)}<b>{item}</b>{/snippet}').defs, 'item')).toBe(true);
        expect(takes(rewrite('{#snippet row(item, n)}<b>{n + item}</b>{/snippet}').defs, 'item', 'n')).toBe(true);
    });

    test('and alongside the names of the block holding it', () => {
        const { defs } = rewrite('{#each xs as x}{#snippet row(n)}<b>{n}</b>{/snippet}{row + x}{/each}');

        expect(takes(defs, 'row', 'x')).toBe(true);
    });

    test('several of them, each in scope', () => {
        const { defs } = rewrite(
            '{#snippet a(n)}<b>{n}</b>{/snippet}{#snippet b(n)}<b>{n}</b>{/snippet}<Card head={a or b} />'
        );

        expect(takes(defs, 'a', 'b')).toBe(true);
    });

    // Svelte scopes a snippet to what encloses it, so a name read outside that
    // resolves to nothing on either side. Seeding it wider would swap a Python
    // NameError for a JavaScript ReferenceError, the same failure with a worse
    // message.
    test('but not outside the block it was declared in', () => {
        const { defs } = rewrite('{#each xs as x}{#snippet row(n)}<b>{n}</b>{/snippet}{/each}{row}');

        expect(defs.some((one) => one === 'def __expr_2():\n    return __text(row)')).toBe(true);
    });

    // Measured on Svelte itself: a snippet written in a `<div>` compiles to a
    // `const` inside a JavaScript block, exactly as one written in a `<Card>`
    // does. An element body is a scope, whether or not it is a component.
    test('nor outside the element it was declared in', () => {
        const { defs } = rewrite('<div>{#snippet row(n)}<b>{n}</b>{/snippet}</div>{row}');

        expect(defs.some((one) => one === 'def __expr_1():\n    return __text(row)')).toBe(true);
    });

    test('and inside that element it is', () => {
        const { defs } = rewrite('<div>{#snippet row(n)}<b>{n}</b>{/snippet}<Card {row} /></div>');

        expect(takes(defs, 'row')).toBe(true);
    });

    // The form that already worked, and must keep working: a snippet written
    // straight into a component's tag is that component's prop, and its name
    // belongs to nobody else.
    test('and one written into a child tag stays that child s own', () => {
        const { defs } = rewrite('<Card>{#snippet row(n)}<b>{n}</b>{/snippet}</Card>{row}');

        expect(defs.some((one) => one === 'def __expr_1():\n    return __text(row)')).toBe(true);
    });

    // A void element opens no body, so it must not open a scope either: one
    // counted wrongly would pop the scope of whatever came next.
    test('and a void element does not open a scope', () => {
        const { defs } = rewrite('{#snippet row(n)}<b>{n}</b>{/snippet}<br /><img src="x">{row}');

        expect(takes(defs, 'row')).toBe(true);
    });

    // `{@render row(x)}` names the snippet on Svelte's own side, and only its
    // arguments are Python. Putting the name in scope must not change that: the
    // name stays where Svelte reads it, outside the compiled expression.
    test('and a {@render} still names it in JavaScript', () => {
        const { out } = rewrite('{#snippet row(n)}<b>{n}</b>{/snippet}{@render row(1)}');

        expect(out).toContain('{@render row(__expr_py_1(');
    });
});

describe('a snippet handed to a child', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(SnippetNames, { target });
        flushSync();

        return (k) => [...target.querySelectorAll(`p[data-k="${k}"]`)].map((p) => p.textContent.trim());
    };

    test('renders where the child renders it', () => expect(setup()('named')).toEqual(['row A']));

    test('even when the tag comes first in the file', () =>
        expect(setup()('hoisted')).toEqual(['row A']));

    test('under the name the child chose', () => expect(setup()('renamed')).toEqual(['row B']));

    // The reason the form exists at all: written once, used more than once.
    test('to two children at once', () => expect(setup()('twice')).toEqual(['row A row A']));

    // And chosen by a Python expression, which is the other half of being a
    // value rather than a hole in a tag.
    test('or picked between two by an expression', () =>
        expect(setup()('chosen')).toEqual(['row A']));

    test('declared inside a block, closing over that block', () =>
        expect(setup()('cell')).toEqual(['xA', 'yA']));

    // The name now has two possible owners, and the answer is not ours to
    // invent: a module-level Python name emits a `let` of its own, so Svelte
    // sees the two declarations it always saw and refuses them in its own
    // words. Nothing silently shadows anything.
    test('and a name a Python global already holds is refused', async () => {
        await expect(import('./fixtures/SnippetShadow.svelte')).rejects.toThrow(
            /`label` has already been declared/
        );
    });
});
