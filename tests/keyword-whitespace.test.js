// @vitest-environment node
//
// **A keyword and what follows it are parted by whitespace, not by a space.**
//
// The dispatch asked `trimmed.startsWith('#if ')`, a literal space, so a
// condition wrapped over two lines — which is how `prettier-plugin-svelte`
// writes a long one — was turned away by a sentence listing `if` among the
// blocks it knows. Nothing was wrong with the expression and nothing was wrong
// with the block; the gate in front of it read one character too narrowly.
//
// The rule was already written at the four inner sites that needed a regular
// expression for another reason — the body of an `{#each}`, the `then` of an
// `{#await}`, `{:else if}`, a snippet's name — and spelled as a literal space
// at the eight gates standing in front of them, so `{#each\n  rows as row}` was
// refused before the body that would have read it correctly.
//
// The reference is Svelte executed: its own compiler, on the JavaScript twin of
// each markup, decides what a separator may be, and the table below is read off
// it at run time rather than written out here. Only an *absent* separator is
// refused, and `{@debug}` and `{/if}` take nothing at all.
import { test, expect, describe } from 'vitest';
import { compile } from 'svelte/compiler';
import { pythonExpressions, collector } from '../src/lib/markup.js';

// `§` marks the one place the separator varies. Everything else in a row is
// identical across the rows, which is what lets the outputs be compared.
const CONSTRUCTS = [
    ['#if', '{#if§ready}<p>yes</p>{/if}'],
    ['#each', '{#each§rows as row}<p>{row}</p>{/each}'],
    ['#each … as', '{#each rows§as row}<p>{row}</p>{/each}'],
    ['#key', '{#key§ready}<p>yes</p>{/key}'],
    ['#await', '{#await§later}<p>wait</p>{/await}'],
    ['#await … then', '{#await later§then value}<p>{value}</p>{/await}'],
    ['#snippet', '{#snippet§row(value)}<p>{value}</p>{/snippet}'],
    ['@html', '{@html§text}'],
    ['@render', '{#snippet row(value)}<p>{value}</p>{/snippet}{@render§row(1)}'],
    ['@debug', '{@debug§ready}'],
    [':else if', '{#if ready}<p>a</p>{:else§if other}<p>b</p>{/if}'],
    [':else … if', '{#if ready}<p>a</p>{:else if§other}<p>b</p>{/if}'],
    [':then', '{#await later}<p>wait</p>{:then§value}<p>{value}</p>{/await}'],
    [':catch', '{#await later}<p>wait</p>{:catch§problem}<p>{problem}</p>{/await}'],
    ['@attach', '<div {@attach§decorate}></div>']
];

const SEPARATORS = [['a tab', '\t'], ['a newline', '\n'], ['two spaces', '  ']];

const DECLARED =
    '<script>let ready = true, other = false, text = "", rows = [];' +
    'let later = Promise.resolve(1); function decorate() {}</script>';

// Our pass rebuilds a block with a single space and hands a clause through as
// the author wrote it, so the two spellings differ by exactly the whitespace
// the row varies. Collapsing it is what makes them comparable, and it is the
// only difference the comparison forgives.
const collapse = (text) => text.replace(/\s+/g, ' ');

const rewrite = (markup) => pythonExpressions(markup, collector([]));

describe.for(CONSTRUCTS)('%s', ([, shape]) => {
    const written = (separator) => shape.replace('§', separator);

    test.for(SEPARATORS)('Svelte takes %s after the keyword', ([, separator]) => {
        expect(() => compile(DECLARED + written(separator), { generate: 'client' })).not.toThrow();
    });

    test.for(SEPARATORS)('and so do we, for the same block: %s', ([, separator]) => {
        expect(collapse(rewrite(written(separator)))).toBe(collapse(rewrite(written(' '))));
    });
});

// The gate is wider, not open. What it refused before it still refuses, and
// each of these is a construct Svelte refuses too.
describe('and what is still not a block', () => {
    test.for([
        ['a keyword with nothing after it', '{#if}<p>a</p>{/if}', 'not a block'],
        ['a block nobody has', '{#unless ready}<p>a</p>{/unless}', 'not a block'],
        ['a clause nobody has', '{#if ready}<p>a</p>{:otherwise}<p>b</p>{/if}', 'not a clause'],
        ['a tag nobody has', '{@paste text}', 'not a tag'],
        // `{@debug}` is the one tag that stands alone, and the gate used to be
        // its whole name with no end to it, so a longer word starting with it
        // crossed as JavaScript inside a component that promised Python.
        ['a tag whose name only starts like one', '{@debugger text}', 'not a tag'],
        // Inside a tag the refusal names the attachments, since that is the
        // only `{@…}` Svelte reads there.
        ['an attachment nobody has', '<div {@attend decorate}></div>', 'the tags are attach']
    ])('%s', ([, markup, said]) => {
        expect(() => rewrite(markup)).toThrow(said);
    });

    // And the one that takes nothing keeps taking nothing.
    test('while {@debug} on its own is a tag', () => {
        expect(() => rewrite('{@debug}')).not.toThrow();
    });
});
