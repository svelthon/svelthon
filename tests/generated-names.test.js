// @vitest-environment node
//
// The names a compiled template expression calls, `__brycomp_event`,
// `__brycomp_truthy`, `__brycomp_assign` and the rest: `markup.js` writes the
// calls, `compile.js` binds the names, and `bridge.js` tells an attribute's
// wrapper by one. All three spell them through one table, `CALLS`
// (`template-names.js`), so a rename is made in one place.
//
// What the table cannot hold is checked here, and in **both directions**.
//
// Forwards: every other `__brycomp_name` invented in the markup pass must have
// a definition in the compiler, or be named below as markup-local, which is a
// deliberate act rather than an oversight. That catches the failure that
// shows: a call to something nobody defined.
//
// Backwards: every name the compiler publishes *for the template* must be one
// the markup still writes. That catches the failure that does not show. A name
// the markup stops writing leaves its `bind()` in every component the project
// ever compiles, for ever, and nothing goes red.
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CALLS } from '../src/lib/template-names.js';

const read = (name) =>
    readFileSync(fileURLToPath(new URL(`../src/lib/${name}`, import.meta.url)), 'utf8');

// Names the markup writes for itself, which the compiler never sees.
const MARKUP_LOCAL = new Set([
    // The setter's parameter in the `bind:` pair, consumed by Svelte.
    '__brycomp_value',
    // The value a walrus through a receiver writes, evaluated before it and
    // handed to the lambda that writes it.
    '__brycomp_given',
    // The functions the halves of a function binding gave where the binding
    // is made, handed to its read and its write.
    '__brycomp_get',
    '__brycomp_put',
    // The loop variable of a compiled `{#each}` over a range.
    '__brycomp_range_',
    // The token declared beside a markup cell a `bind:group` writes.
    '__brycomp_cell_',
    // The row a pattern unpacks by key stands under, `{#each rows as {id}}`.
    '__brycomp_unpacked_',
    // What a snippet's announcement hands back, its parameters read by
    // position on a server.
    '__brycomp_snippet_',
    // The plain parameter Svelte hands a snippet's argument by, one per
    // position, which the snippet takes apart itself.
    '__brycomp_argument_',
    // The read of a select a spread may make multiple, a function of its own
    // per element, named so it hands itself over.
    '__brycomp_select_',
    // The index an `{#each}` is given for a `bind:group` or a key inside it,
    // which Svelte declares.
    '__brycomp_index_',
    // What an `{#each}` walks, declared beside it.
    '__brycomp_rows_',
    // What a `{@debug}` hands Svelte's under each name it logs.
    '__brycomp_debugged_',
    // The row an element's instance keeps of what its attributes and spreads
    // gave, which its last spread settles, declared beside it.
    '__brycomp_slot_',
    // A stand-in used by the first, throwaway walk that only collects snippet
    // names; nothing it returns is emitted.
    '__brycomp_probe',
    // The token a positional pattern's default is taken under, the parameter
    // of the function that takes it (`initializing`).
    '__brycomp_token'
]);

// Python's own special methods, which the markup calls on a number it reads at a
// key (`bag[-1]`) and which no compiler defines. Named one by one rather than
// by their shape: the compiler generates `__brycomp_all__` too.
const PYTHON_OWN = new Set(['__neg__', '__pos__']);

// Svelte's own hidden property, where it keeps the value of an element it sees a
// group binding on, which the markup's prose names.
const SVELTE_OWN = new Set(['__value']);

const SHARED = new Set(Object.values(CALLS));

// Each entry of the table a source reaches, `CALLS.truthy`, by the name it
// stands for.
const reached = (source) => new Set([...source.matchAll(/\bCALLS\.(\w+)/g)].map((one) => CALLS[one[1]]));

test('every generated name the markup writes is defined by the compiler', () => {
    const markup = read('markup.js');
    const compiler = read('compile.js');

    const written = [...new Set([...markup.matchAll(/__[a-z][\w]*/g)].map((one) => one[0]))]
        .filter((one) => !MARKUP_LOCAL.has(one) && !PYTHON_OWN.has(one) && !SVELTE_OWN.has(one) && !SHARED.has(one))
        .sort();

    // The list is not written out here on purpose: it is read from the file that
    // invents the names, so a new one cannot arrive unnoticed.
    expect(written.length).toBeGreaterThan(3);

    expect(written.filter((one) => !compiler.includes(one))).toEqual([]);
});

test('and a name the compiler stopped emitting turns this red', () => {
    // The failure this guards against, spelled out: renaming one side only.
    const compiler = read('compile.js').replace(/__brycomp_pybridge/g, '__bridge');

    expect(compiler.includes('__brycomp_pybridge')).toBe(false);
});

// What the compiler writes into the template's functions itself: every dot of
// the markup becomes a call there, written by Brycomp's `templateDots` under
// the names the compiler's runtime gives `readAttr` and `writeAttr`, and a
// t-string it rewrote under `templateText`'s, so the markup pass never spells
// them. Read off those entries of `compile.js`, so a name it stops giving
// leaves this list as well.
const dots = () => [...read('compile.js').matchAll(/^\s*(?:readAttr|writeAttr|templateText): CALLS\.(\w+),?$/gm)].map((one) => CALLS[one[1]]);

test('the dots of the template are written under three names of the runtime', () => {
    expect(dots()).toEqual(['__brycomp_getattr', '__brycomp_setattr', '__brycomp_tstring']);
});

// The markup pass, with the table of attribute wrappers it reads: `CALLS.class`
// and `CALLS.truthy` are chosen there, by an attribute's name.
const markupSource = () => `${read('markup.js')}\n${read('attributes.js')}`;

const written = (markup) => new Set([...reached(markup), ...dots()]);

test('every name of the table is one the compiler binds and the markup writes', () => {
    const compiler = reached(read('compile.js'));
    const markup = written(markupSource());

    expect([...SHARED].filter((one) => !compiler.has(one))).toEqual([]);
    expect([...SHARED].filter((one) => !markup.has(one))).toEqual([]);
});

// What the compiler hands the template, and only that. `compile.js` writes many
// other `__` names, and none of them is the template's business: `__brycomp_proto`,
// `__brycomp_py`, `__props`, `__brycomp_fn_x`, `__brycomp_rev_x`, `__brycomp_helpers` and the rest are the
// component script talking to itself.
//
// Two shapes carry the template's own set, and both are read off the file rather
// than listed here, for the same reason the forward direction is: a new entry
// must not be able to arrive unnoticed.
const published = (compiler) => {
    const at = compiler.indexOf('function templateBridge(');
    const bridge = compiler.slice(at, compiler.indexOf('\n}', at));
    const from = compiler.indexOf('const ADAPTERS = {');
    const adapters = compiler.slice(from, compiler.indexOf('\n};', from));

    return [
        ...new Set([
            // `[CALLS.truthy]: '__brycomp_pybridge.truthy'` and its neighbours,
            // and those bound under their own names, each in the namespace.
            ...reached(adapters),
            // `const ${CALLS.event} = …`, which a directive and a handler are
            // given by name rather than through the namespace.
            ...[...bridge.matchAll(/const \$\{CALLS\.(\w+)\} =/g)].map((one) => CALLS[one[1]])
        ])
    ].sort();
};

test('every name the compiler publishes to the template is one the markup writes', () => {
    const markup = written(markupSource());
    const names = published(read('compile.js'));

    expect(names.length).toBeGreaterThan(8);

    expect(names.filter((one) => !markup.has(one))).toEqual([]);
});

test('and one the markup stopped writing turns this red', () => {
    // The failure this guards against, and the reason it needed guarding: it
    // costs a dead `bind()` in every compiled component and says nothing.
    const markup = written(markupSource().replace(/\bCALLS\.spread\b/g, 'CALLS.spreadX'));
    const names = published(read('compile.js'));

    expect(names.filter((one) => !markup.has(one))).toEqual(['__brycomp_spread']);
});
