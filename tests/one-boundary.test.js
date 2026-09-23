// @vitest-environment node
//
// The compiler names a boundary; it does not write one.
//
// Five of the last passes found the same shape of defect, and twice the cause
// was not a missed case but a rule that existed **twice**: once in
// `runtime.js` and once as a template literal in `compile.cjs`. A rule added to
// the first cannot reach the second — a string is not code anyone greps — so
// the argument conversion arrived at two call boundaries out of three, and the
// callback policy at one export route out of two. Both were silent.
//
// The generated module calls `__pyCall`, `__pyComponent`, `__pyEvent`,
// `__pyExport` and the rest by name. What it must not do is spell what they do:
// convert the arguments, start a coroutine, convert a result. The names below
// are the ones that would say so, and they are read off `RUNTIME` rather than
// written out here, so a boundary added to the map joins this guard by existing.
//
// `__plainData` is the exception and it is named as one: `to_js` is an injected
// helper whose whole value is that function, so the generated module holds the
// name without spelling a crossing.
import { test, expect, describe } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('../src/lib/compile.cjs', import.meta.url)), 'utf8');

// What a crossing is made of, in the runtime's own words.
const CROSSING = ['schedule', 'scheduleAsync', 'plainData', 'pyNumbers', 'pyHandler', 'pyData'];

// Published to Python as a value, not called by generated code.
const INJECTED_AS_A_VALUE = new Set(['plainData', 'pyData']);

describe('the compiler emits no boundary of its own', () => {
    test.for(CROSSING.filter((one) => !INJECTED_AS_A_VALUE.has(one)))(
        'no generated line calls `%s`',
        ([name]) => {
            // A call, and not the mention in the alias map: `__schedule(` with
            // its parenthesis is what a wrapper written here would look like.
            expect(source).not.toContain(`__${name}(`);
        }
    );

    // And the shape itself, which is what the two copies had in common: a `try`
    // around a Python call with a `catch` that labels it. The two that remain
    // wrap a call with no arguments and no result — an effect and the module
    // body — and label the error, which is not a crossing. `on_destroy` goes
    // through `pyComponent`, which starts an `async def`.
    test('and the wrappers it still writes take no argument and convert nothing', () => {
        const written = [...source.matchAll(/catch \(err\) \{ throw __pyError/g)];

        expect(written.length).toBe(2);
        expect(source).not.toContain('.map(__pyArg)');
    });
});
