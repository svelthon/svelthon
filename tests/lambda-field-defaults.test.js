// **A bare lambda is a field's default, its colon the lambda's own**:
// `unpackByKey` took the first colon of `cb=lambda x: x + 1` for the one that
// renames a key, so the target was part of the lambda's body, and the template
// it made did not compile, `js_parse_error`, in an `{#each}` as in a snippet.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import LambdaFieldDefaults from './fixtures/LambdaFieldDefaults.svelte';

test('a field unpacked by key takes a bare lambda as its default', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(LambdaFieldDefaults, { target });
    flushSync();

    expect(Object.fromEntries([...target.querySelectorAll('output')].map((one) => [one.dataset.k, one.textContent]))).toEqual({
        'each-none': '1',
        'each-one': '3',
        'each-two': '6',
        'each-renamed': '1',
        'snippet-none': '1',
        'snippet-one': '3',
        'snippet-two': '6'
    });
});
