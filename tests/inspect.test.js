import { test, expect, describe, vi, afterEach } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { compile } from '../src/lib/compile.js';
import Inspect from './fixtures/Inspect.svelte';
import InspectWithCounts from './fixtures/InspectWithCounts.svelte';
import InspectLines from './fixtures/InspectLines.svelte';
import InspectWithLines from './fixtures/InspectWithLines.svelte';

// The logger of `inspect_with` was cut off the values by its end column alone,
// counted as if on one line: on a line of its own, the cut fell elsewhere and the
// call was refused as invalid syntax, or read another name.
test('inspect_with laid out by a formatter hands its logger the values', () => {
    globalThis.inspectWithLines = [];
    const target = document.body.appendChild(document.createElement('div'));
    mount(InspectWithLines, { target });
    flushSync();

    target.querySelector('button').click();
    flushSync();

    expect(Array.from(globalThis.inspectWithLines)).toEqual(['init 0', 'update 1']);
    target.remove();
});

// The call was recognised on one line only: laid out over three, as a
// formatter writes it, it stayed a call to the injected identity, wired to
// nothing and said nothing. The same logs as the one-line form.
test('inspect over several lines logs as on one line', () => {
    const logged = vi.spyOn(console, 'log').mockImplementation(() => {});
    const target = document.body.appendChild(document.createElement('div'));
    mount(InspectLines, { target });
    flushSync();

    expect(logged).toHaveBeenCalledWith(0, 'hello');

    target.querySelector('button').click();
    flushSync();

    expect(logged).toHaveBeenCalledWith(1, 'hello');
    logged.mockRestore();
    target.remove();
});

// The values and the logger are two roles Svelte evaluates apart:
// `$inspect(read_value()).with(make_logger())` reads the value twice on mount
// and makes the logger once, then as many again after a change. The same here,
// and the same records.
test('inspect_with evaluates its values and its logger as Svelte does', () => {
    globalThis.__inspectRecords = [];
    globalThis.__inspectReads = [];
    globalThis.__inspectLoggers = [];
    const target = document.body.appendChild(document.createElement('div'));
    mount(InspectWithCounts, { target });
    flushSync();

    expect(Array.from(globalThis.__inspectReads)).toEqual([0, 0]);
    expect(Array.from(globalThis.__inspectLoggers)).toEqual(['made']);

    target.querySelector('button[data-k="bump"]').click();
    flushSync();

    expect(Array.from(globalThis.__inspectReads)).toEqual([0, 0, 1, 1]);
    expect(Array.from(globalThis.__inspectLoggers)).toEqual(['made', 'made']);
    expect(globalThis.__inspectRecords.map((row) => Array.from(row))).toEqual([
        ['init', 0],
        ['update', 1]
    ]);
});

// `inspect(count, message)` is a console.log that reruns on its own — Svelte's
// `$inspect`, whose production build drops it entirely.
//
// The values must be read *again* on every change, so they cannot be handed over
// already read. Svelte compiles `$inspect(x)` into `$.inspect(() => [x], …)`; the
// same trick works one level down, with the arguments in a lambda whose call
// re-reads them through the namespace accessors.
describe('inspect', () => {
    afterEach(() => vi.restoreAllMocks());

    const setup = () => {
        const logged = vi.spyOn(console, 'log').mockImplementation(() => {});
        const target = document.body.appendChild(document.createElement('div'));
        mount(Inspect, { target });
        flushSync();

        return {
            logged,
            bump: () => {
                target.querySelector('button').click();
                flushSync();
            }
        };
    };

    // One argument per value, as Svelte does — its `inspect` calls the logger
    // with `...values` and keeps `"init"` / `"update"` for the `.with` form,
    // which is not ported.
    test('it logs once on mount, with every value it was given', () => {
        const { logged } = setup();

        expect(logged).toHaveBeenCalledWith(0, 'hello');
    });

    // The point of the rune over a console.log: nobody writes it again.
    test('and again whenever one of them changes', () => {
        const { logged, bump } = setup();

        bump();
        expect(logged).toHaveBeenCalledWith(1, 'hello');
    });

    describe('the emission', () => {
        const script = (src) => compile(src, 'Probe', 'probe.svelte', {}).script;

        // The call, not its result: Svelte wraps what it is given in a thunk of
        // its own, so the lambda is what gets re-run.
        test('hands Svelte the call', () => {
            expect(script('count = 0\n\ninspect(count)\n')).toContain('$inspect(...__brycomp_invoke(__brycomp_fn___brycomp_inspect_0));');
        });

        // Over several lines, `inspect_with` as well, and every line after the
        // call keeps its number: an error below it names its own line.
        test.for([
            ['inspect', 'count = 0\n\ninspect(\n    count,\n)\nboom = 1 / 0\n'],
            ['inspect_with', 'count = 0\n\ninspect_with(print,\n    count)\n\nboom = 1 / 0\n'],
            ['inspect_with as a formatter lays it out', 'count = 0\ninspect_with(\n    print,\n    count,\n)\nboom = 1 / 0\n']
        ])('hands Svelte a call to %s laid out over lines', ([, src]) => {
            const out = compile(src, 'Probe', 'probe.svelte', {});

            expect(out.script).toContain('$inspect(');
            expect(out.module.split('\n').some((line) => line.includes('set_lineno(frame, 6)'))).toBe(true);
        });

        test('and leaves a component that does not use it alone', () => {
            expect(script('count = 0\n')).not.toContain('$inspect');
        });

        // A line at the left margin inside open brackets, or after a backslash,
        // continues a statement: it is not the rune, whatever it starts with.
        // The call stays inside its expression, where it declares nothing, and
        // is refused there.
        test.for([
            ['open brackets', 'total = sum([\ninspect(1)])\n'],
            ['a backslash', 'total = 1 + \\\ninspect(1)\n']
        ])('and reads no rune on a line continued by %s', ([, src]) => {
            expect(() => script(src)).toThrow(/`inspect\(…\)` is read only as the whole value of an assignment/);
        });
    });
});
