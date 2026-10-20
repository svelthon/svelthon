// @vitest-environment node
//
// What the compiler *says*, which thirty-two readings of what it refuses never
// looked at. The suite printed a warning of our own on every build:
//
//   InspectWith.svelte:70:54 This reference only captures the initial value of
//   `__fn___inspect_0`. Did you mean to reference it inside a closure instead?
//
// The file is 31 lines long. The position is a line of the emitted script, so an
// author reading their terminal is sent past the end of their own file, to an
// identifier they never typed, twice per `inspect_with` call.
//
// The `.with(…)` argument was the one place the lambda was read outside the
// rune — an ordinary expression, evaluated once, outside any tracking context.
// Reading it inside the handler answers the warning and is the same call.
import { test, expect, describe } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { compile as compileSvelte, compileModule, preprocess } from 'svelte/compiler';
import { python, compileOptionsFor } from '../src/lib/svelthon.js';
import { compile } from '../src/lib/compile.js';

const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));

// The real chain: Svelte's own `preprocess`, which runs the markup hook, the one
// that collects the expression functions, and then the script hook that compiles
// them. A JavaScript fixture comes out of it unchanged, as the build hands it to
// Svelte, and what it says is said on every run all the same.
const warningsFor = async (name) => {
    const filename = fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
    const whole = readFileSync(filename, 'utf8');
    const { code } = await preprocess(whole, [python()], { filename });

    // Compiled the way the build compiles it, options included: a guard that
    // reads warnings has to ask the same compiler question the build asks, or
    // it invents them.
    return compileSvelte(code, { name: 'Probe', ...compileOptionsFor(whole) }).warnings.map(
        (one) => one.code
    );
};

describe('the script the compiler emits', () => {
    test('does not read a signal outside its rune', async () => {
        expect(await warningsFor('InspectWith.svelte')).not.toContain('state_referenced_locally');
    });

    // Every code rather than the one above, which names the code it was written
    // for and so leaves the next one unread. One did go unread: every green run
    // printed `options_missing_custom_element` about `Stepper.svelte`.
    //
    // **Its reach is the rule, not the wiring, and the name says so.** To
    // compile a fixture this file has to decide *how*, and it decides by calling
    // the project's own `compileOptionsFor` — which makes it a good test of that
    // rule and no test at all of whether the build calls it. Cut
    // `dynamicCompileOptions` in `vite.config.js` and this stays green while
    // every run prints the warning; `tests/custom-element.test.js` stays green
    // too, all eleven. **Nothing inside `npm test` tells the two builds apart.**
    //
    // The half that does is `scripts/quiet-check.mjs`, which runs the suite and
    // reads its output, and it is outside `npm test` for the reason
    // `browser-check.sh` is: it starts a second full run. So this file is not
    // sufficient on its own and is not meant to be — deleting that script as
    // redundant would leave a guard that looks like the class and is the rule.
    test('and no fixture warns when compiled the way the build compiles it', async () => {
        const warned = [];
        const refused = [];

        for (const name of readdirSync(FIXTURES).filter((one) => one.endsWith('.svelte'))) {
            // Some fixtures refuse on purpose, and the test that owns each one
            // asserts its refusal: `snippet-names.test.js` for one of them.
            let codes;
            try {
                codes = await warningsFor(name);
            } catch {
                refused.push(name);
                continue;
            }

            if (codes.length) warned.push(`${name}: ${codes.join(', ')}`);
        }

        expect(warned, 'a fixture the compiler warns about, on every run').toEqual([]);

        // A chain that refuses everything warns about nothing: the refusals are
        // a handful of fixtures written for a refusal or for another `path`,
        // not the fixtures at large.
        expect(refused.length, refused.join(', ')).toBeLessThan(10);
    });

    // Quotes around a lone interpolation on a component are Svelte's to warn
    // about, `attribute_quoted`, and the author reads the warning Svelte gives
    // the same component written in JavaScript: the value crosses as itself,
    // between the quotes the author wrote.
    test('and Svelte warns about a quoted prop as it does about its own', async () => {
        const codes = async (name) => [...new Set(await warningsFor(name))].sort();

        expect(await codes('warned/QuotedLoneValue.svelte')).toContain('attribute_quoted');
        expect(await codes('warned/QuotedLoneValue.svelte')).toEqual(await codes('warned/QuotedLoneValueNative.svelte'));
    });

    // A store is the other half of what the build hands Svelte: a `.svelte.py`
    // compiled to module-scope runes and then by `compileModule`, under the
    // `.svelte.js` identity the plugin serves it with. Its named exports read
    // the function cells at the top of the module, and every store printed
    // `state_referenced_locally` about a `__fn_` name its author never typed.
    test('and no store fixture warns when Svelte compiles it as a module', () => {
        const warned = [];

        for (const name of readdirSync(FIXTURES).filter((one) => one.endsWith('.svelte.py'))) {
            const source = readFileSync(`${FIXTURES}${name}`, 'utf8');
            let codes;
            try {
                const { script } = compile(source, 'Store', name, { store: true, sourceContent: source });

                codes = compileModule(script, { filename: name.replace(/\.py$/, '.js') }).warnings.map(
                    (one) => one.code
                );
            } catch {
                continue;
            }

            if (codes.length) warned.push(`${name}: ${codes.join(', ')}`);
        }

        expect(warned, 'a store fixture the compiler warns about, on every run').toEqual([]);
    });
});
