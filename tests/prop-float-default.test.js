// A default that is a float of an integral value, `1.0`, crosses as the `1` a
// parent may pass: Python reads its float while the parent passes nothing,
// and the int the parent passes when it does, a written prop as one it never
// writes.
import { test, expect } from 'vitest';
import { mount, flushSync, unmount } from './mounted.js';
import PropFloatDefaultHost from './fixtures/PropFloatDefaultHost.svelte';

test('a float default reads as the float, and an int passed as the int', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    const host = mount(PropFloatDefaultHost, { target });
    const seen = [];
    const step = (change) => {
        change();
        flushSync();
        seen.push([host.model(), target.querySelector('p').textContent]);
    };

    step(() => {});
    step(() => host.give({ scale: 1, ratio: 2 }));
    step(() => host.give({ scale: 3, ratio: 3 }));
    step(() => host.give({ scale: undefined, ratio: undefined }));
    step(() => host.write(5));
    step(() => host.give({ ratio: 6 }));
    step(() => host.give({ ratio: undefined }));

    expect(seen.map(([model, page]) => (model === page ? model : `${model} != ${page}`))).toEqual([
        'float 1.0|float 2.0',
        'int 1|int 2',
        'int 3|int 3',
        'float 1.0|float 2.0',
        'float 1.0|int 5',
        'float 1.0|int 6',
        'float 1.0|float 2.0'
    ]);

    await unmount(host);
    target.remove();
});
