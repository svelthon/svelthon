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
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { compile as compileSvelte, compileModule } from 'svelte/compiler';
import { python, compileOptionsFor } from '../src/lib/svelthon.js';

const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');

const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));

// The real chain: the markup hook first, because it is what appends the
// expression functions the script hook then compiles.
const warningsFor = (name) => {
    const filename = fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
    const whole = readFileSync(filename, 'utf8');

    // A JavaScript fixture is compiled as it is: the build hands it to Svelte
    // unchanged, and what it says is said on every run all the same.
    if (!whole.includes('<script lang="python">')) {
        return compileSvelte(whole, { name: 'Probe', ...compileOptionsFor(whole) }).warnings.map((one) => one.code);
    }

    const pre = python();
    const markup = pre.markup({ content: whole, filename });

    const { script } = compile(
        whole.match(/<script lang="python">([\s\S]*?)<\/script>/)[1],
        'Probe',
        name,
        { ...pre, sourceContent: whole }
    );

    void script;

    const rewritten = markup.code.replace(
        /<script lang="python">[\s\S]*?<\/script>/,
        `<script>${
            compile(whole.match(/<script lang="python">([\s\S]*?)<\/script>/)[1], 'Probe', name)
                .script
        }</script>`
    );

    // Compiled the way the build compiles it, options included: a guard that
    // reads warnings has to ask the same compiler question the build asks, or
    // it invents them.
    return compileSvelte(rewritten, { name: 'Probe', ...compileOptionsFor(whole) }).warnings.map(
        (one) => one.code
    );
};

describe('the script the compiler emits', () => {
    test('does not read a signal outside its rune', () => {
        expect(warningsFor('InspectWith.svelte')).not.toContain('state_referenced_locally');
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
    test('and no fixture warns when compiled the way the build compiles it', () => {
        const warned = [];

        for (const name of readdirSync(FIXTURES).filter((one) => one.endsWith('.svelte'))) {
            // A fixture with no Python block has nothing for this chain to
            // compile, and one refuses on purpose — `snippet-names.test.js`
            // asserts that refusal.
            let codes;
            try {
                codes = warningsFor(name);
            } catch {
                continue;
            }

            if (codes.length) warned.push(`${name}: ${codes.join(', ')}`);
        }

        expect(warned, 'a fixture the compiler warns about, on every run').toEqual([]);
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
