// @vitest-environment node
//
// The server half of `destructured-plain-fields.test.js`: the server renders
// the fields a pattern unpacks, read where they are read, the positional row
// taken apart by `__pybridge.positional`.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import DestructuredPlainFields from './fixtures/DestructuredPlainFields.svelte';

test('the server renders the fields a pattern unpacks from plain objects', () => {
    const body = render(DestructuredPlainFields, {
        props: { source: { value: 1 }, nested: { item: { value: 1 } }, pair: [1] }
    }).body;

    expect(Object.fromEntries([...body.matchAll(/<output data-k="([^"]*)">([^<]*)<\/output>/g)].map((one) => [one[1], one[2]]))).toEqual({
        'snippet-key': '1',
        'snippet-nested': '1',
        'snippet-index': '1',
        'each-key': '1'
    });
});
