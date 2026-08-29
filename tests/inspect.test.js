import { test, expect, describe, vi, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import { mount, flushSync } from 'svelte';
import Inspect from './fixtures/Inspect.svelte';

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
        const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');
        const script = (src) => compile(src, 'Probe', 'probe.svelte', {}).script;

        // The call, not its result: Svelte wraps what it is given in a thunk of
        // its own, so the lambda is what gets re-run.
        test('hands Svelte the call', () => {
            expect(script('count = 0\n\ninspect(count)\n')).toContain('$inspect(...__fn___inspect_0());');
        });

        test('and leaves a component that does not use it alone', () => {
            expect(script('count = 0\n')).not.toContain('$inspect');
        });
    });
});
