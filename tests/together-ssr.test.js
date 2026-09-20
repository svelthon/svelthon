// @vitest-environment node
//
// The server half of the integration probe. It runs under Node, where there is
// no DOM, so a rule that quietly reached for one shows here and nowhere else.
//
// It also pins the exact HTML the server produces, because
// `tests/together.test.js` hydrates on that string: the two files cannot drift
// apart in silence, which is the same arrangement `ssr.test.js` and
// `hydration.test.js` already use.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';

import Together from './fixtures/Together.svelte';
import { SERVER_HTML } from './fixtures/together-html.js';

test('the server renders every repair, and renders it once', () => {
    expect(render(Together).body).toBe(SERVER_HTML);
});
