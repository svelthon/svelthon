// A `bind:group` is one array of its inputs, as in Svelte's `bind_group`: an
// input joins it when it registers and leaves it at teardown, and the inputs
// registering in one turn are put in document order by one sort.
//
// Each input used to queue a sort of its own, so mounting 200 together sorted
// the same 200 two hundred times, 39 800 comparisons where Svelte makes 199.
// And the sorted copy was a second array that teardown never touched: the
// inputs of a block that was gone stayed alive for as long as the group's
// component did.
import { test, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mount, flushSync } from './mounted.js';
import GroupMany from './fixtures/GroupMany.svelte';
import GroupGone from './fixtures/GroupGone.svelte';
import GroupGoneNative from './fixtures/GroupGoneNative.svelte';

// An input whose block is gone is no longer in its group: the next change
// collects the inputs that are left, as Svelte's own group does.
test.each([
    ['Python', GroupGone],
    ['native Svelte', GroupGoneNative]
])('%s: a ticked input whose block is gone leaves the selection', async (_, Component) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(Component, { target });
    flushSync();
    await Promise.resolve();

    target.querySelector('[data-k="gone"]').click();
    flushSync();
    target.querySelector('button').click();
    flushSync();
    target.querySelector('[data-k="kept"]').click();
    flushSync();

    expect(target.querySelector('p').textContent).toBe('kept');
});

test('two hundred inputs mounted together are sorted once', async () => {
    const original = HTMLInputElement.prototype.compareDocumentPosition ?? Node.prototype.compareDocumentPosition;
    let comparisons = 0;

    HTMLInputElement.prototype.compareDocumentPosition = function (...args) {
        comparisons++;
        return original.apply(this, args);
    };

    try {
        const target = document.body.appendChild(document.createElement('div'));

        mount(GroupMany, { target });
        flushSync();
        await Promise.resolve();

        expect(comparisons).toBeLessThanOrEqual(4 * 200);

        // And the order is still the document's: ticked last, listed first.
        const boxes = target.querySelectorAll('input');

        boxes[7].click();
        boxes[3].click();
        flushSync();

        expect(target.querySelector('p').textContent).toBe('3,7');
    } finally {
        delete HTMLInputElement.prototype.compareDocumentPosition;
    }
});

const canSpawn = (() => {
    try {
        execFileSync(process.execPath, ['-e', ''], { stdio: 'ignore' });

        return true;
    } catch {
        return false;
    }
})();

test.skipIf(!canSpawn)('a destroyed input is not kept by its group', () => {
    const out = JSON.parse(
        execFileSync(process.execPath, ['--expose-gc', 'tests/fixtures/group-retention.mjs'], { encoding: 'utf8' })
    );

    expect(out.controls).toBe(0);
    expect(out.registered).toBe(0);
    expect(out.scope).toBe('object');
});
