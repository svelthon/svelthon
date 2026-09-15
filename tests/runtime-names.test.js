import { createRequire } from 'node:module';

import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import RuntimeNames from './fixtures/RuntimeNames.svelte';

const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');

// The third list of names, and the one the project had never written down.
//
// `JS_RESERVED` refuses what JavaScript will not take as a binding; the locked
// words refuse Svelthon's own vocabulary. Neither covers **a name the generated
// code uses for itself** — `group` is a fine JavaScript name and none of
// Svelthon's words — and the preamble brought twenty-two of them bare into the
// component's own scope. `group: str = "a"` then gave `Identifier 'group' has
// already been declared`, and `init`, `track`, `follow` and `schedule` did the
// same, each in the form a Python author writes it.
//
// The repair was already in the file, one line above the wound:
// `helpers as __helpers`. Every one of them now arrives under a `__` spelling,
// which costs nothing at run time — generated code is their only reader.
describe('a name the runtime lends the generated code', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(RuntimeNames, { target });
        flushSync();

        return {
            read: (k) => target.querySelector(`[data-k="${k}"]`).textContent,
            click: (k) => {
                target.querySelector(`[data-k="${k}"]`).click();
                flushSync();
            }
        };
    };

    test('is an author name like any other', () => {
        const { read } = setup();

        expect(read('group')).toBe('aucun');
        expect(read('follow')).toBe('False');
        expect(read('schedule')).toBe('[]');
        expect(read('track')).toBe('1');
        expect(read('none')).toBe('pas None');
        expect(read('rest')).toBe('123');
    });

    test('including one an author calls', () => {
        const { read } = setup();

        expect(read('bind')).toBe('42');
    });

    // `init` is the commonest setup function name there is, and it is the one
    // the component imports from its own generated module.
    test('and one the component imports for itself', () => {
        const { read, click } = setup();

        click('init');

        expect(read('group')).toBe('prêt');
    });

    // The agreement itself: nothing the preamble imports arrives bare. Read off
    // the emitted import rather than listed here, so a twenty-third name cannot
    // slip in unnoticed.
    test('every name the preamble imports arrives under a generated spelling', () => {
        const line = compile('x = 1\n', 'C', 'src/C.svelte')
            .script.split('\n')
            .find((one) => one.includes("from 'svelthon/runtime'"));

        const imported = line
            .slice(line.indexOf('{') + 1, line.indexOf('}'))
            .split(',')
            .map((one) => one.trim());

        expect(imported.length).toBeGreaterThan(20);
        expect(imported.filter((one) => !/(^__| as __)/.test(one))).toEqual([]);
    });
});
