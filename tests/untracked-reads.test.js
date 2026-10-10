// A read follows the name it reads on the classes it is looked up through only
// where Svelte follows reads: in a reaction. A handler's reads subscribe
// nothing, and walking the classes there would add a quarter to the cost of
// every attribute read, and half to a class's read through a watched instance.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import UntrackedReads from './fixtures/UntrackedReads.svelte';

test('a read in a handler asks no class for its name, a read in the template does', () => {
    const $B = globalThis.__BRYTHON__;
    const search = $B.search_in_dict;
    const asked = { template: { size: 0, kind: 0 }, handler: { size: 0, kind: 0 } };
    let now = 'template';

    $B.search_in_dict = function (obj, attr, ...rest) {
        if (Object.hasOwn(asked[now], attr) && Array.isArray(obj.tp_mro)) asked[now][attr] += 1;
        return Reflect.apply(search, this, [obj, attr, ...rest]);
    };

    try {
        const target = document.body.appendChild(document.createElement('div'));
        mount(UntrackedReads, { target });
        flushSync();

        now = 'handler';
        target.querySelector('button').click();
        flushSync();
    } finally {
        $B.search_in_dict = search;
    }

    expect(asked.template.size).toBeGreaterThan(0);
    expect(asked.template.kind).toBeGreaterThan(0);
    expect(asked.handler).toEqual({ size: 0, kind: 0 });
});
