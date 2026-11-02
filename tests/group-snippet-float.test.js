// Two checkboxes bound to one list by a float a snippet is handed, `row(0.5)`. The
// snippet reads its parameter once per input, and a float is an object rebuilt
// at each read, so the two inputs were held as two targets: a click on one took
// away what the other had chosen, as radio buttons do. A target is held by its
// values' keys, as a keyed `{#each}` holds its rows.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import GroupSnippetFloat from './fixtures/GroupSnippetFloat.svelte';
import GroupSnippetFloatNative from './fixtures/GroupSnippetFloatNative.svelte';

const clicked = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));
    const seen = [];

    try {
        mount(Component, { target });
        flushSync();

        for (const row of target.querySelectorAll('div')) {
            const [a, b] = row.querySelectorAll('input');

            for (const input of [b, a, b, a]) {
                input.click();
                flushSync();
                seen.push(`${row.querySelector('output').textContent}:${a.checked}${b.checked}`);
            }
        }

        return seen;
    } finally {
        target.remove();
    }
};

test('a float handed to a snippet keys one group, as in Svelte', () => {
    const native = clicked(GroupSnippetFloatNative);

    expect(native).toEqual(['b:falsetrue', 'a,b:truetrue', 'a:truefalse', ':falsefalse', 'b:falsetrue', 'a,b:truetrue', 'a:truefalse', ':falsefalse']);
    expect(clicked(GroupSnippetFloat)).toEqual(native);
});
