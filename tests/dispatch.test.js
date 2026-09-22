// @vitest-environment node
//
// The second unguarded coupling in the project, made guarded.
//
// `walk()` dispatches on a chain of `startsWith` branches, and four lists,
// `BLOCKS`, `CLAUSES`, `TAGS` and `ATTACHMENTS`, name what it accepts so that a
// refusal can say what it knows. Nothing ties the two together: a branch added
// without its entry leaves the message wrong, and an entry with no branch names
// a construct that does not compile.
//
// It is not hypothetical. `TAGS` used to be the union of the two positions,
// which are disjoint, so every refusal of a `{@…}` listed the very word the
// author had just written. Found on 2026-09-10 by reading the message, not by a
// test. This is that test.
//
// Read the same way `tests/generated-names.test.js` reads its eleven names:
// off the file that declares them, so a sixth block cannot arrive unnoticed.
import { test, expect, describe } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { pythonExpressions, collector } from '../src/lib/markup.js';

const source = readFileSync(fileURLToPath(new URL('../src/lib/markup.js', import.meta.url)), 'utf8');

const list = (name) => {
    const found = source.match(new RegExp(`^const ${name} = \\[([^\\]]*)\\]`, 'm'));

    expect(found, `${name} is declared as a literal array`).not.toBeNull();
    return [...found[1].matchAll(/'([^']+)'/g)].map((one) => one[1]);
};

// Every keyword the chain compares against, wherever it sits and whichever
// sigil opened it. Which *position* a word belongs to is what the behavioural
// rows below decide; this reading answers one question only, and it is the one
// no behaviour can answer: was a branch added without its entry.
//
// It is written as an equality rather than as a subset on purpose. The chain
// used to be a row of `startsWith('#if ')`, and a reading that only looked for
// that spelling would have come back **empty** the day the chain stopped using
// it, and passed — a guard that names its means goes quiet when the means
// changes, which is the worst way for one to break. An equality cannot go
// quiet: a reading that finds nothing fails as loudly as one that finds a word
// nobody listed.
const dispatched = [
    ...new Set([
        ...[...source.matchAll(/\b(?:opens|holds)\('(\w+)'\)/g)].map((one) => one[1]),
        ...[...source.matchAll(/\.name === '(\w+)'/g)].map((one) => one[1])
    ])
];

const BLOCKS = list('BLOCKS');
const CLAUSES = list('CLAUSES');
const TAGS = list('TAGS');
const ATTACHMENTS = list('ATTACHMENTS');

const rewrite = (markup) => pythonExpressions(markup, collector([]));

// The property under test is "this position knows this word", so the assertion
// is about the refusal alone. A construct may fail for its own reasons and that
// is not what this file is watching.
const knows = (markup) => expect(() => rewrite(markup)).not.toThrow(/is not a (tag|block) Svelthon knows/);
const refuses = (markup) => expect(() => rewrite(markup)).toThrow(/is not a (tag|block) Svelthon knows/);

describe('the dispatch chain and the lists that describe it', () => {
    test('the lists are not empty, and none was left as a stub', () => {
        for (const [name, one] of [['BLOCKS', BLOCKS], ['CLAUSES', CLAUSES], ['TAGS', TAGS], ['ATTACHMENTS', ATTACHMENTS]]) {
            expect(one, name).not.toHaveLength(0);
        }
    });

    // Catches the branch added without its entry. It cannot say which of the two
    // tag positions the word belongs to, which is what the two tests below are
    // for, but it does say that nobody forgot the list entirely.
    //
    // `CLAUSES` is absent from the right-hand side because the chain names none
    // of its words: it reads the list itself. Writing them out instead would
    // put `else`, `then` and `catch` on the left, where no list on the right
    // names them, and this row would fail — so the duplication is caught here
    // too, without this file having to name the call the chain makes.
    test('every word the chain dispatches on is named by a list', () => {
        expect([...dispatched].sort()).toEqual([...BLOCKS, ...TAGS, ...ATTACHMENTS].sort());
    });

    // And the other direction, which the text cannot answer: an entry with no
    // branch behind it names a construct that does not compile.
    const sample = {
        if: '{#if a}x{/if}',
        each: '{#each a as b}x{/each}',
        key: '{#key a}x{/key}',
        await: '{#await a}x{/await}',
        snippet: '{#snippet a()}x{/snippet}'
    };

    test.for(BLOCKS)('{#%s} compiles', (name) => {
        expect(sample[name], `a sample for {#${name}} is written above`).toBeDefined();
        knows(sample[name]);
    });

    test('an unknown block is still refused', () => {
        refuses('{#nope x}y{/nope}');
    });

    // The two `{@…}` positions are disjoint, and this is the pair that used to
    // share one list. Each word must be known where Svelte puts it and refused
    // where it does not belong.
    test.for(TAGS)('{@%s} is a text tag, and only that', (name) => {
        knows(`<p>{@${name} x}</p>`);
        refuses(`<div {@${name} x}></div>`);
    });

    test.for(ATTACHMENTS)('{@%s} sits inside a tag, and only there', (name) => {
        knows(`<div {@${name} f}></div>`);
        refuses(`<p>{@${name} f}</p>`);
    });

    test('so the two lists share nothing', () => {
        expect(TAGS.filter((one) => ATTACHMENTS.includes(one))).toEqual([]);
    });

    // A refusal must never name the word it is refusing. This is the defect
    // itself, stated once rather than through the lists.
    test.for([...TAGS.map((n) => [n, `<div {@${n} x}></div>`]), ...ATTACHMENTS.map((n) => [n, `<p>{@${n} x}</p>`])])(
        'refusing {@%s} does not list it among the tags it knows',
        ([name, markup]) => {
            expect(() => rewrite(markup)).toThrow(/is not a tag Svelthon knows/);
            expect(() => rewrite(markup)).not.toThrow(new RegExp(`the tags are[^.]*\\b${name}\\b`));
        }
    );

    test.for(CLAUSES)('{:%s} is accepted inside its block', (name) => {
        expect(() => rewrite(`{#await a}x{:${name} b}y{/await}`)).not.toThrow(
            /is not a clause Svelthon knows/
        );
    });

    test('an unknown clause is still refused', () => {
        expect(() => rewrite('{#if a}x{:nope}y{/if}')).toThrow(/is not a clause Svelthon knows/);
    });
});
