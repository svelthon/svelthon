// A t-string in the template keeps the text it was written with, as Python
// keeps it: its `strings` and each interpolation's `.expression` read
// `row.name`, a debug field's label `row.name=`, where the template's dot,
// rewritten to a call, showed `__brycomp_getattr(row, "name")`. Each value is
// read as the template reads it, a key of a dict among them, and each answer
// is CPython's.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import TemplateStringText from './fixtures/TemplateStringText.svelte';
import TemplateStringWalrus from './fixtures/TemplateStringWalrus.svelte';

// And one a handler writes a name through, `(count := …)`, its field written
// into the component's name: its expression and label stay the author's, and
// a debug field one interpolation, as CPython has them.
test('a t-string a handler writes a name through keeps its text', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const seen = [];

    mount(TemplateStringWalrus, { target });
    flushSync();

    for (const k of ['plain', 'debug', 'converted', 'formatted', 'first', 'last', 'both', 'before', 'after', 'dotted', 'named', 'namedNext']) {
        target.querySelector(`[data-k="${k}"]`).click();
        flushSync();
        seen.push(target.querySelector('[data-k="shown"]').textContent);
    }

    expect(seen).toEqual([
        "('left ', ' right')|[('(count := count + 1)', 1, None, '')]",
        "('(count := count + 1)=', '')|[('(count := count + 1)', 2, 'r', '')]",
        "('(count := count + 1)=', '')|[('(count := count + 1)', 3, 's', '')]",
        "('', '')|[('(count := count + 1)', 4, None, '>3')]",
        // Written next to each other, one `Template`, as Python joins them.
        "('left (count := count + 1)=', ' / ', ' right')|[('(count := count + 1)', 5, 'r', ''), ('caption', 'Ada', None, '')]",
        "('left ', ' / ', ' right')|[('caption', 'Ada', None, ''), ('(count := count + 1)', 6, None, '')]",
        "('', '', '')|[('(count := count + 1)', 7, None, ''), ('(count := count + 1)', 8, None, '')]",
        // A debug field the handler writes nothing through, its label once.
        "('left caption=', ' / (count := count + 1)=', ' right')|[('caption', 'Ada', 'r', ''), ('(count := count + 1)', 9, 'r', '')]",
        "('', ' / caption=', '')|[('(count := count + 1)', 10, None, ''), ('caption', 'Ada', 's', '')]",
        "('row.name=', ' ', '')|[('row.name', 'Grace', 'r', ''), ('(count := count + 1)', 11, None, '')]",
        // A named escape is a character of the text, and no field.
        "('left π caption=', ' / (count := count + 1)=', ' right')|[('caption', 'Ada', 'r', ''), ('(count := count + 1)', 12, 'r', '')]",
        "('• ', ' ', '')|[('(count := count + 1)', 13, None, ''), ('caption', 'Ada', None, '')]"
    ]);
});

test.for([
    ['debug', "('row.name=', '')|[('row.name', 'Ada', 'r', '')]"],
    ['plain', "('a ', ' b')|[('row.name', 'Ada', None, '')]"],
    ['key', "('', '')|[('record.name', 'Grace', None, '')]"],
    ['spaced', "(' row.name = ', '')|[(' row.name ', 'Ada', 'r', '')]"],
    ['converted', "('row.name=', '')|[('row.name', 'Ada', 's', '')]"],
    ['formatted', "('row.name=', '')|[('row.name', 'Ada', None, '>5')]"],
    ['nested', "('', '')|[('row.name', 'Ada', None, '>5')]"],
    // Between triple quotes, which no longer compiled.
    ['triple', "('', '')|[('x', 3, None, '')]"],
    ['lined', "('a\\n', '')|[('x', 3, None, '')]"],
    // A debug field after text, its label and the text one constant to the
    // parser.
    ['texted', "('x: row.name=', '')|[('row.name', 'Ada', 'r', '')]"],
    ['twice', "('row.name=', ' and record.name=', '')|[('row.name', 'Ada', 'r', ''), ('record.name', 'Grace', 'r', '')]"],
    ['joined', "('arow.name=', 'b', '')|[('row.name', 'Ada', 'r', ''), ('record.name', 'Grace', None, '')]"],
    ['escaped', "('• row.name=', '')|[('row.name', 'Ada', 'r', '')]"]
])('t"…" %s is written as Python writes it', ([k, expected]) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(TemplateStringText, { target });
    flushSync();

    expect(target.querySelector(`[data-k="${k}"]`).textContent).toBe(expected);
});
