// @vitest-environment node
//
// The server half of `namespace-receiver.test.js`: a function of a JavaScript
// namespace called alone in the template reads the namespace on the server
// too, where it read no receiver.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import NamespaceReceiver from './fixtures/NamespaceReceiver.svelte';

test('the server calls a function of a namespace on the namespace', () => {
    const body = render(NamespaceReceiver).body;

    expect([...body.matchAll(/<output data-k="([^"]*)">([^<]*)<\/output>/g)].map((one) => `${one[1]}=${one[2]}`)).toEqual([
        'dot=actions',
        'getattr=actions',
        'script=actions'
    ]);
});
