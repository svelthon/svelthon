// **A name a branch does not take is not read**, as Python reads a branch:
// a template expression is handed the names it reads as functions, and reads
// one only where the branch it sits in runs. Read before the expression ran,
// `{7 if True else y}` ran `y`'s derived, and a snippet's parameter its
// default, and the page failed on what the branch excluded, where Svelte, in
// production, reads nothing for `true ? 7 : y`. In development Svelte reads a
// `{@const}` and a snippet's parameter ahead for its own checks, so the
// answers are CPython's. A branch that is taken still reads, and still fails.
//
// Only a name whose read runs code is handed so, a derived, a default, a name
// a pattern unpacks, a snippet's parameter, bare or not, which Svelte hands as
// a function of the `{@render}` argument: a row or an index is read ahead for
// nothing, and a call at each of its reads cost a row's update a fifth more.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { pythonExpressions, collector } from '../src/lib/markup.js';
// The parser the names an expression reads are read with, which the plugin
// has loaded before any markup is read.
import '../src/lib/compile.cjs';
import UntakenBranch from './fixtures/UntakenBranch.svelte';

const shown = (kind) => {
    const target = document.body.appendChild(document.createElement('div'));

    try {
        mount(UntakenBranch, { target, props: { kind } });
        flushSync();

        return target.querySelector('output').textContent;
    } catch (error) {
        return String(error?.message ?? error).includes('branch-was-read') ? 'read' : String(error);
    }
};

test.for([
    ['if true', '7'],
    ['if false', '7'],
    ['and', '9'],
    ['or', '7'],
    ['lambda', '7'],
    ['each index', '7'],
    // Svelte's own bare parameter is read in development as in production,
    // where its branch reads it: the `{@render}` argument runs nowhere here.
    ['bare snippet parameter', '7'],
    // A default and a name a pattern unpacks are derived as the markup
    // declares one, which nothing reads ahead, development included: CPython's
    // answer, and Svelte's in production.
    ['snippet default', '7'],
    ['snippet pattern default', '7'],
    ['each pattern default', '7'],
    ['taken', 'read']
])('a branch %s shows %s', ([kind, answer]) => {
    expect(shown(kind)).toBe(answer);
});

// None of them is a `{@const}`, which Svelte calls legacy and reads ahead in
// development: a component whose author wrote none would stop compiling the
// day Svelte drops it.
test('the markup declares no {@const}', () => {
    const defs = [];
    const out = pythonExpressions(
        '{#snippet row([x, z], y=1)}{y}{/snippet}{#each rows as {a = 1}}{a}{/each}' +
            '{#await load() then {b}}{b}{/await}{#if True}{@debug rows}{/if}',
        collector(defs)
    );

    expect(out).toContain('$derived(');
    expect(out).not.toContain('{@const');
});

// A default and a name a pattern unpacks Svelte reads ahead itself in
// development, so what is held for them is how each is handed: as a function,
// read by a call (`_late`), where its read runs code, and as itself where it
// does not.
const handedLate = (markup) => {
    const defs = [];

    pythonExpressions(markup, collector(defs));

    return defs.filter((one) => one.includes('7 if True else')).map((one) => /^def __expr_\w*_late\(/.test(one));
};

test.for([
    ['a default an {#each} pattern holds', '{#each rows as {a = fail()}}{7 if True else a}{/each}', true],
    ['a name a snippet pattern unpacks', '{#snippet card({x = fail()})}{7 if True else x}{/snippet}', true],
    ['a snippet parameter holding a default', '{#snippet plain(x = fail())}{7 if True else x}{/snippet}', true],
    ['a derived', '{#if True}{y => fail()}{7 if True else y}{/if}', true],
    ['a bare snippet parameter', '{#snippet plain(x)}{7 if True else x}{/snippet}', true],
    ['a row', '{#each rows as row}{7 if True else row}{/each}', false],
    ['an index', '{#each rows as row, i}{7 if True else i}{/each}', false],
    ['a state cell', '{#if True}{z = 1}{7 if True else z}{/if}', false]
])('%s, read in a branch, is handed late: %s', ([, markup, late]) => {
    expect(handedLate(markup)).toEqual([late]);
});
