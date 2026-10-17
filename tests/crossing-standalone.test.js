// @vitest-environment node
//
// **Bryntime stands without Svelte and without the runtime**: what
// `src/lib/bryntime/` holds imports the engine and its own files, nothing
// else, and loaded alone, with no host to answer, it still turns JavaScript
// values into Python ones and back. What a host adds, the states it owns and
// how it makes an object one of them, is asked through `host`, which answers
// nothing here.
import { test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import '../src/lib/compile.cjs';
import { host, pyData, plainData, entering, pyBind, refused, NONE } from '../src/lib/bryntime/bryntime.js';

const DIR = 'src/lib/bryntime';
const ENGINE = '../../../vendor/brython_runtime.js';

test('bryntime/ imports the engine and itself, and nothing of Svelte or of the runtime', () => {
    const files = readdirSync(DIR);
    const imports = files.flatMap((file) =>
        [...readFileSync(`${DIR}/${file}`, 'utf8').matchAll(/^(?:import|export)\s+(?:[^'";]*\s+from\s+)?'([^']+)';/gm)].map(
            ([, from]) => `${file}: ${from}`
        )
    );

    expect(files).toContain('bryntime.js');
    expect(imports).toContain(`boot.js: ${ENGINE}`);
    expect(imports.filter((one) => !one.endsWith(`: ${ENGINE}`) && !/: \.\/[\w-]+\.js$/.test(one))).toEqual([]);
});

// And by name: what it writes on the engine, signs its refusals with and
// recognises them by is its own. Its comments may take Svelte for an example;
// a line of code that names Svelthon or Svelte is a contract a page without
// them would have to keep.
test('no line of code of bryntime/ names Svelthon or Svelte', () => {
    const named = readdirSync(DIR).flatMap((file) =>
        readFileSync(`${DIR}/${file}`, 'utf8')
            .split('\n')
            .map((line, index) => [`${file}:${index + 1}`, line.replace(/(^|\s)\/\/.*$/, '')])
            .filter(([, code]) => /svelthon|svelte/i.test(code))
            .map(([where, code]) => `${where}: ${code.trim()}`)
    );

    expect(named).toEqual([]);
});

test('loaded alone, with no host, it crosses data both ways', () => {
    const $B = globalThis.__BRYTHON__;
    const python = pyData({ name: 'a', rows: [1, 2.5, { deep: null }] });

    expect($B.class_name(python)).toBe('dict');
    // `null` comes in as `javascript.NULL` and goes out as `null`.
    expect(plainData(python)).toEqual({ name: 'a', rows: [1, 2.5, { deep: null }] });
    expect(pyBind(undefined)).toBe(NONE);
    expect(host.owns(python)).toBe(false);
    expect($B.class_name(entering({ n: 1 }))).toBe('dict');
});

// With no host to give its name, a refusal is signed with Bryntime's own, and
// known as one by `refused`.
test('alone, it signs its refusals with its own name', () => {
    const $B = globalThis.__BRYTHON__;
    const keys = $B.builtins.dict.$factory();
    let thrown;

    $B.$setitem(keys, 1, 'numeric');
    $B.$setitem(keys, '1', 'text');

    try {
        plainData(keys);
    } catch (error) {
        thrown = error;
    }

    expect(host.name).toBe('bryntime');
    expect(thrown.message).toMatch(/^bryntime — this dict has two keys JavaScript cannot tell apart/);
    expect(refused(thrown)).toBe(true);
    expect(refused(new Error('bryntime — written by hand'))).toBe(false);
});
