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

import { compile as compileSvelte } from 'svelte/compiler';
import { python, compileOptionsFor } from '../src/lib/svelthon.js';

const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');

const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));

// The real chain: the markup hook first, because it is what appends the
// expression functions the script hook then compiles.
const warningsFor = (name) => {
    const filename = fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
    const whole = readFileSync(filename, 'utf8');
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

    // **The class, not the one warning.** The line above names the code it was
    // written for, so the next warning of a different code goes unread — and one
    // did: every green run printed `options_missing_custom_element` about
    // `Stepper.svelte`, because the component declared a custom element and the
    // compile that read the declaration did not enable them.
    //
    // A suite that prints its own noise teaches its reader that its stderr is
    // noise, which is the one habit the instruments built to read the
    // toolchain's output cannot survive. `tests/suite-is-quiet.test.js` says so
    // and counts one cause of it, jsdom reporting a deliberate raise; this is
    // the other, and the two together are what that file's prose claims.
    test('and no fixture warns, whatever the code', () => {
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
});
