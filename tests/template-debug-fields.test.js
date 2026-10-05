// A debug field, `f"{row.name=}"`, prints the text of its expression. In the
// template the dot is rewritten, `__getattr(row, "name")`, and the label printed
// the rewrite. Each line against what CPython prints for the same f-string.
import { test, expect } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import TemplateDebugFields from './fixtures/TemplateDebugFields.svelte';

// `python3` on the same expressions, the format spec, the explicit conversion
// and a lambda of the template included.
const CPYTHON = [
    "row.name='ok'",
    "row.name = 'ok'",
    'row.size=   7',
    'row.name=ok',
    'count=3',
    'count + row.size = 10',
    "row.name='ok'",
    "[row.name='ok']"
];

test('each debug field prints its expression as written, as CPython does', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(TemplateDebugFields, { target });

    try {
        flushSync();
        expect([...target.querySelectorAll('p')].map((one) => one.textContent)).toEqual(CPYTHON);
    } finally {
        await unmount(instance);
        target.remove();
    }
});
