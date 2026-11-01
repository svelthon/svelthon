// A name only `globals()["x"] = …` binds, read by the template. The template read
// it through the namespace and nothing told it of a change, since a cell is given
// to what the compiler sees bound: the page kept the first value where Python
// held another. A name the template reads and no statement binds has a cell.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import GlobalsWritten from './fixtures/GlobalsWritten.svelte';

test('the template follows a name only globals() binds', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(GlobalsWritten, { target });
    const view = () => {
        flushSync();
        return target.querySelector('[data-k="view"]').textContent;
    };
    const first = view();

    instance.write();

    expect([first, view()]).toEqual(['1|6||1', '2|60|7|1']);
});
