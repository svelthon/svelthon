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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { compile as compileSvelte } from 'svelte/compiler';
import { python } from '../src/lib/svelthon.js';

const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');

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

    return compileSvelte(rewritten, { name: 'Probe' }).warnings.map((one) => one.code);
};

describe('the script the compiler emits', () => {
    test('does not read a signal outside its rune', () => {
        expect(warningsFor('InspectWith.svelte')).not.toContain('state_referenced_locally');
    });
});
