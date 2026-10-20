// @vitest-environment node
//
// The one unguarded coupling in the project, made guarded.
//
// `markup.js` writes the calls a compiled template expression makes — `__event`,
// `__truthy`, `__assign` and the rest — and `compile.js` emits their
// definitions. The two files must agree on eleven spellings and share no
// constant for them.
//
// So the agreement is checked, and in **both directions**,
// which is a thing this file did not do at first.
//
// Forwards: every `__name` invented in the markup pass must have a definition in
// the compiler, or be named below as markup-local, which is a deliberate act
// rather than an oversight. That catches the failure that shows: a call to
// something nobody defined.
//
// Backwards: every `__name` the compiler publishes *for the template* must be
// one the markup still writes. That catches the failure that does not show. A
// name the markup stops writing leaves its `bind()` in every component the
// project ever compiles, for ever, and nothing goes red.
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as bryc from '../src/lib/bryc/bryc.js';

const read = (name) =>
    readFileSync(fileURLToPath(new URL(`../src/lib/${name}`, import.meta.url)), 'utf8');

// Names the markup writes for itself, which the compiler never sees.
const MARKUP_LOCAL = new Set([
    // The setter's parameter in the `bind:` pair, consumed by Svelte.
    '__value',
    // The loop variable of a compiled `{#each}` over a range.
    '__range_',
    // The token declared beside a markup cell a `bind:group` writes.
    '__cell_',
    // The row a pattern unpacks by key stands under, `{#each rows as {id}}`.
    '__unpacked_',
    // What a snippet's announcement hands back, its parameters read by
    // position on a server.
    '__snippet_',
    // The plain parameter Svelte hands a snippet's argument by, one per
    // position, which the snippet takes apart itself.
    '__argument_',
    // The read of a select a spread may make multiple, a function of its own
    // per element, named so it hands itself over.
    '__select_',
    // The index an `{#each}` is given for a `bind:group` or a key inside it,
    // which Svelte declares.
    '__index_',
    // What an `{#each}` walks, declared beside it.
    '__rows_',
    // What a `{@debug}` hands Svelte's under each name it logs.
    '__debugged_',
    // A stand-in used by the first, throwaway walk that only collects snippet
    // names; nothing it returns is emitted.
    '__probe'
]);

// Python's own special methods, which the markup calls on a number it reads at a
// key (`bag[-1]`) and which no compiler defines. Named one by one rather than
// by their shape: the compiler generates `__svelthon_all__` too.
const PYTHON_OWN = new Set(['__neg__', '__pos__']);

test('every generated name the markup writes is defined by the compiler', () => {
    const markup = read('markup.js');
    const compiler = read('compile.js');

    const written = [...new Set([...markup.matchAll(/__[a-z][\w]*/g)].map((one) => one[0]))]
        .filter((one) => !MARKUP_LOCAL.has(one) && !PYTHON_OWN.has(one))
        .sort();

    // The list is not written out here on purpose: it is read from the file that
    // invents the names, so a twelfth one cannot arrive unnoticed.
    expect(written.length).toBeGreaterThan(10);

    expect(written.filter((one) => !compiler.includes(one))).toEqual([]);
});

test('and a name the compiler stopped emitting turns this red', () => {
    // The failure this guards against, spelled out: renaming one side only.
    const compiler = read('compile.js').replace(/__event/g, '__handler');

    expect(compiler.includes('__event')).toBe(false);
});

// What the compiler hands the template, and only that. `compile.js` writes many
// other `__` names, and none of them is the template's business: `__proto`,
// `__py`, `__props`, `__fn_x`, `__rev_x`, `__helpers` and the rest are the
// component script talking to itself.
//
// Two shapes carry the template's own set, and both are read off the file rather
// than listed here, for the same reason the forward direction is: a tenth entry
// must not be able to arrive unnoticed.
const published = (compiler) => {
    const at = compiler.indexOf('function templateBridge(');
    const bridge = compiler.slice(at, compiler.indexOf('\n}', at));

    return [
        ...new Set([
            // `bind(__proto, '__truthy', …)` and its seven neighbours.
            ...[...compiler.matchAll(/bind\(__proto, '(__\w+)'/g)].map((one) => one[1]),
            // `const __event = …`, `const __group = group;`, which a directive
            // and a handler are given by name rather than through the namespace.
            ...[...bridge.matchAll(/const (__\w+) =/g)].map((one) => one[1])
        ])
    ].sort();
};

// Whole names, not substrings. `includes` was the first spelling of this and it
// answered true for `__spread` in a file that only wrote `__spreadX`, which is
// exactly the rename this is meant to catch.
//
// Plus what the compiler writes into the template's functions itself: every dot
// of the markup becomes a `__getattr` call there, in Bryc's `templateDots`, so
// the markup pass never spells it. Read off that function's own text, so a
// name it stops writing leaves this list as well.
const written = (markup) =>
    new Set([...`${markup}\n${bryc.templateDots}`.matchAll(/__[a-z][\w]*/g)].map((one) => one[0]));

// The markup pass, with the table of attribute wrappers it reads: `__class`
// and `__truthy` are chosen there, by an attribute's name.
const markupSource = () => `${read('markup.js')}\n${read('attributes.js')}`;

test('every name the compiler publishes to the template is one the markup writes', () => {
    const markup = written(markupSource());
    const names = published(read('compile.js'));

    expect(names.length).toBeGreaterThan(8);

    expect(names.filter((one) => !markup.has(one))).toEqual([]);
});

test('and one the markup stopped writing turns this red', () => {
    // The failure this guards against, and the reason it needed guarding: it
    // costs a dead `bind()` in every compiled component and says nothing.
    const markup = written(markupSource().replace(/__spread\b/g, '__spreadX'));
    const names = published(read('compile.js'));

    expect(names.filter((one) => !markup.has(one))).toEqual(['__spread']);
});
