// @vitest-environment node
//
// The emitted script is assembled from named sections, and their order carries
// four rules that no section can state on its own. They used to live in four
// comments, which nothing reads. These read the script instead.
//
// Asserted on the output rather than on `COMPONENT_SECTIONS`: a list compared
// against itself passes whatever it says, and moving a section would move the
// assertion with it. A position in the emitted text cannot be moved that way.
import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { compile } = require('../src/lib/compile.cjs');
const { INJECTED } = require('../src/lib/injected.cjs');

// One of each thing a section emits: a prop, plain state, a derived, an effect,
// a plain function and an exported one.
const SOURCE = `count: int = 0
total = 0

@derived
def doubled():
    return count * 2

@effect
def watch():
    print(total)

@export
def focus():
    pass

def bump():
    global count
    count = count + 1
`;

const DECLARED = ['count', 'total', 'doubled', 'watch', 'focus', 'bump'];

const positions = (script, needles) => needles.map((one) => script.indexOf(one));

describe('the order the sections are assembled in', () => {
    const { script } = compile(SOURCE, 'Ordered', 'src/Ordered.svelte');

    test('every name the author declared is bound', () => {
        // The rest of this file compares positions, and a position of -1 would
        // quietly satisfy "comes first". This is what stops that.
        for (const one of DECLARED) expect(script).toContain(`bind(__proto, '${one}',`);
        expect(script).toContain(`init(__py);`);
    });

    test('the injections bind after the author’s names, so they cannot take one', () => {
        const author = Math.max(
            ...positions(script, DECLARED.map((one) => `bind(__proto, '${one}',`))
        );

        const injected = INJECTED.map((one) => script.indexOf(`bind(__proto, '${one.name}',`))
            .filter((at) => at !== -1);

        // Not a handful: the whole injected table lands after the last of them.
        expect(injected.length).toBeGreaterThan(10);
        expect(injected.filter((at) => at < author)).toEqual([]);
    });

    test('init() comes after every binding, since it is what fills them', () => {
        const last = script.lastIndexOf('bind(__proto, ');

        expect(script.indexOf('init(__py);')).toBeGreaterThan(last);
    });

    test('the exported wrappers come after init(), so they call something', () => {
        const init = script.indexOf('init(__py);');

        // `__pyComponent`, and not a wrapper written out by the compiler: the
        // three call boundaries are one file's business now, so a rule added to
        // one of them can reach this one.
        expect(script.indexOf('const bump = __pyComponent(')).toBeGreaterThan(init);
        expect(script.indexOf('export { focus };')).toBeGreaterThan(init);
    });

    test('the effects come last, since an effect runs its body on creation', () => {
        const wrappers = Math.max(
            ...positions(script, ['const bump = __pyComponent(', 'export { focus };'])
        );

        expect(script.indexOf('$effect(() => {')).toBeGreaterThan(wrappers);
    });
});

// A `.py` has no template and no runes, so only three of the four rules reach
// it — there are no effects to come last.
describe('and in a plain module', () => {
    const { script } = compile(
        `TITLE = "x"\n\ndef load(event):\n    return TITLE\n`,
        'Route',
        'src/route.py',
        { plain: true }
    );

    test('the injections bind after the author’s names', () => {
        const author = Math.max(
            ...positions(script, [`bind(__proto, 'TITLE',`, `bind(__proto, 'load',`])
        );

        const injected = INJECTED.map((one) => script.indexOf(`bind(__proto, '${one.name}',`))
            .filter((at) => at !== -1);

        expect(injected.length).toBeGreaterThan(10);
        expect(injected.filter((at) => at < author)).toEqual([]);
    });

    test('init() comes after every binding, and the exports after init()', () => {
        const init = script.indexOf('init(__py);');

        expect(init).toBeGreaterThan(script.lastIndexOf('bind(__proto, '));
        // `__pyExport`, and not a boundary written out here: the wrapper a
        // module's functions get is the runtime's own, `pyHandler`'s, so a rule
        // added to it holds on this route too. It was spelled out inline, and a
        // callback returned by one of these functions then crossed with no
        // policy at all. Published live, as every exported name is.
        expect(script.indexOf('__export_load = __pyExport(')).toBeGreaterThan(init);
        expect(script.indexOf('export { __export_load as load };')).toBeGreaterThan(init);
    });
});
