// @vitest-environment node
//
// The server half of `prefixed-string-keys.test.js`: the server reads a field
// by the key a prefixed string spells too.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import PrefixedStringKeys from './fixtures/PrefixedStringKeys.svelte';

test('the server reads a field unpacked by a prefixed string key by the key Python spells', () => {
    const body = render(PrefixedStringKeys).body.replaceAll('&quot;', '"');

    expect(Object.fromEntries([...body.matchAll(/<output data-k="([^"]*)">([^<]*)<\/output>/g)].map((one) => [one[1], one[2]]))).toEqual({
        'each-r': '42',
        'each-R': '42',
        'each-u': '42',
        'each-U': '42',
        'each-default': '42',
        'each-backslash': '5',
        'each-rest': '42:extra,r"name"',
        'snippet-r': '42',
        'await-u': '42'
    });
});
