// **Two variants of one file, which a plugin shifts by lines, each keep their
// own lines.** Where the template begins and where the script stands in the
// file were kept per file, and the variant mounted last replaced the other's:
// a name the short one's template reads, bound in a branch that did not run,
// raised `NameError` instead of rendering empty, and its error named a line
// five below the one written. Kept per namespace, which the code's frames hold.
import { test, expect } from 'vitest';
import { mount, flushSync, unmount } from './mounted.js';
import ShiftedPanels from './fixtures/ShiftedPanels.svelte';

const raised = (call) => {
    try {
        call();
    } catch (error) {
        return String(error?.message ?? error);
    }

    return 'nothing raised';
};

test('two variants of one file shifted by lines each read and place their own lines', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(ShiftedPanels, { target });

    flushSync();
    target.querySelector('[data-k="short"] [data-act="show"]').click();
    flushSync();

    const { short, long } = instance.panels();

    expect(target.querySelector('[data-k="short"] output').outerHTML).toBe('<output data-flag="ok"></output>');
    expect([raised(() => short.fail()), raised(() => long.fail())]).toEqual([
        expect.stringMatching(/ShiftedPanel\.svelte:15\)$/),
        expect.stringMatching(/ShiftedPanel\.svelte:55\)$/)
    ]);

    await unmount(instance);
    target.remove();
});
