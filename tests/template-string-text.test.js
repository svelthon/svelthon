// A t-string in the template keeps the text it was written with, as Python
// keeps it: its `strings` and each interpolation's `.expression` read
// `row.name`, a debug field's label `row.name=`, where the template's dot,
// rewritten to a call, showed `__brycomp_getattr(row, "name")`. Each value is
// read as the template reads it, a key of a dict among them, and each answer
// is CPython's.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import TemplateStringText from './fixtures/TemplateStringText.svelte';

test.for([
    ['debug', "('row.name=', '')|[('row.name', 'Ada', 'r', '')]"],
    ['plain', "('a ', ' b')|[('row.name', 'Ada', None, '')]"],
    ['key', "('', '')|[('record.name', 'Grace', None, '')]"],
    ['spaced', "(' row.name = ', '')|[(' row.name ', 'Ada', 'r', '')]"],
    ['converted', "('row.name=', '')|[('row.name', 'Ada', 's', '')]"],
    ['formatted', "('row.name=', '')|[('row.name', 'Ada', None, '>5')]"],
    ['nested', "('', '')|[('row.name', 'Ada', None, '>5')]"]
])('t"…" %s is written as Python writes it', ([k, expected]) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(TemplateStringText, { target });
    flushSync();

    expect(target.querySelector(`[data-k="${k}"]`).textContent).toBe(expected);
});
