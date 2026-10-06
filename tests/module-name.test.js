// A module's `__name__`, and the `__module__` of everything it defined, was
// the path of the file with its dots made underscores,
// `tests/fixtures/module_names_py`, which a class's `repr` and so a message or
// a log showed. A module is named as `import` finds it, as CPython names it,
// and its errors still point at its file.
//
// `python3` on the fixtures, from `tests/fixtures`: the lists below.
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { report, fail } from './fixtures/module_names.py';
import { report as readerReport } from './fixtures/module_names_reader.py';
import { report as storeReport } from './fixtures/module_names_store.svelte.py';

test('a module calls itself, and what it defines, by its import name', () => {
    expect(report()).toEqual([...Array(8).fill('module_names'), 'module_names.Kept']);
});

test('another module reads the same name', () => {
    expect(readerReport()).toEqual(['module_names', 'module_names', 'module_names', 'module_names.Kept']);
});

test('a reactive module is named as `import` finds it', () => {
    expect([...storeReport()]).toEqual(['module_names_store', 'module_names_store', 'module_names_store']);
});

test('an error raised in the module still names its file and line', () => {
    const text = readFileSync('tests/fixtures/module_names.py', 'utf8');
    const line = text.slice(0, text.indexOf('    raise ValueError')).split('\n').length;

    expect(() => fail()).toThrow(`tests/fixtures/module_names.py:${line}`);
});
