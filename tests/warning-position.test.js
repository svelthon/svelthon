// @vitest-environment node
//
// The generated script takes as many lines as the Python it replaces, so a
// Svelte warning about the markup below it lands on the line it is about.
// Neither vite-plugin-svelte nor svelte-check maps a warning back through the
// preprocessor.
import { test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { preprocess, parse, compile as compileSvelte } from 'svelte/compiler';
// `parse` wraps the script in a tag of its own, which is the only way Svelte's
// parser reads JavaScript; runes and all, it is what the build reads.
import { python } from '../src/lib/svelthon.js';

test('a Svelte warning on the markup names the line written', async () => {
    // In a directory of its own: it warns on purpose, and the guard that no
    // fixture warns reads `tests/fixtures` alone.
    const filename = fileURLToPath(new URL('./fixtures/warned/WarnedImage.svelte', import.meta.url));
    const source = readFileSync(filename, 'utf8');
    const written = source.split('\n').findIndex((line) => line.startsWith('<img')) + 1;

    const processed = await preprocess(source, [python()], { filename });
    const { warnings } = compileSvelte(processed.code, { filename });
    const image = warnings.find((one) => one.code === 'a11y_missing_attribute');

    expect(image.start.line).toBe(written);
    expect(processed.code.split('\n')).toHaveLength(source.split('\n').length);
});

// And the markup's own expressions: one written over several lines was
// rewritten on one, `{__expr_0()}`, and every warning below it named a line as
// many too high, the image on line 17 reported on 13. The lines are given back
// inside the rewrite's braces.
test('a Svelte warning below an expression written over several lines names the line written', async () => {
    const filename = fileURLToPath(new URL('./fixtures/warned/WarnedAfterExpressions.svelte', import.meta.url));
    const source = readFileSync(filename, 'utf8');
    const written = source.split('\n').findIndex((line) => line.startsWith('<img')) + 1;

    const processed = await preprocess(source, [python()], { filename });
    const { warnings } = compileSvelte(processed.code, { filename });

    expect(warnings.find((one) => one.code === 'a11y_missing_attribute').start.line).toBe(written);
    expect(processed.code.split('\n')).toHaveLength(source.split('\n').length);
});

// The fold itself, proven rather than argued: on every fixture, the generated
// script and the same script with every line joined parse to one tree,
// positions aside. No line break in it means anything, so no partial fold can.
test('joining the generated lines changes nothing Svelte parses', () => {
    const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');
    const tree = (code) =>
        JSON.stringify(parse(`<script>${code}</script>`, { modern: true }).instance.content, (key, value) =>
            key === 'start' || key === 'end' || key === 'loc' ? undefined : value
        );
    const differ = [];

    for (const name of readdirSync('tests/fixtures').filter((one) => one.endsWith('.svelte'))) {
        const found = readFileSync(`tests/fixtures/${name}`, 'utf8').match(/<script lang="python">([\s\S]*?)<\/script>/);
        if (!found) continue;

        let script;
        try {
            ({ script } = compile(found[1], 'P', `tests/fixtures/${name}`, {}));
        } catch {
            continue; // a fixture written to be refused
        }

        if (tree(script.split('\n').join(' ')) !== tree(script)) differ.push(name);
    }

    expect(differ).toEqual([]);
});

// What lets the script share lines: no line comment, and every line ends a
// statement or opens one. Held on every fixture, so a generator change that
// breaks it says so here rather than as a syntax error in one component.
test('every generated line can be joined to the next', () => {
    const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');
    const bad = [];

    for (const name of readdirSync('tests/fixtures').filter((one) => one.endsWith('.svelte'))) {
        const found = readFileSync(`tests/fixtures/${name}`, 'utf8').match(/<script lang="python">([\s\S]*?)<\/script>/);
        if (!found) continue;

        let script;
        try {
            ({ script } = compile(found[1], 'P', `tests/fixtures/${name}`, {}));
        } catch {
            continue; // a fixture written to be refused
        }

        for (const line of script.split('\n')) {
            const code = line.trim();
            if (code === '') continue;
            if (code.startsWith('//') || !/[;{},(\[]$/.test(code)) bad.push(`${name}: ${code.slice(0, 60)}`);
        }
    }

    expect(bad).toEqual([]);
});
