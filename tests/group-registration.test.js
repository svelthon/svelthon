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
import { group } from '../src/lib/runtime.js';
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

// A form reset rebuilds each group's list from its inputs, and finds the list a
// target is rebuilt into through an index of its own, made and dropped with the
// reset. It searched every target rebuilt so far, so a form of n rows, each its
// own group, read n² coordinates. Counted here by the reads of the values each
// binding mentions, for rows that are one group and rows that are many.
test.each([['one shared group', () => 0], ['a group per row', (at) => at]])(
    'a reset of 128 rows in %s reads each row a few times',
    async (_, row) => {
        const form = document.body.appendChild(document.createElement('form'));
        const scope = {};
        const actions = [];
        const written = [];
        let reads = 0;

        for (let at = 0; at < 128; at++) {
            const node = form.appendChild(document.createElement('input'));
            const where = new Proxy([row(at)], {
                get(target, key, receiver) {
                    if (key === '0') reads++;
                    return Reflect.get(target, key, receiver);
                }
            });

            node.type = 'checkbox';
            actions.push(group(node, [[], (value) => written.push(value), 'yes', 'rows', scope, where]));
        }

        await Promise.resolve();
        reads = 0;

        try {
            form.reset();
            await Promise.resolve();

            expect(written.length).toBe(128);
            expect(written.every((one) => Array.from(one).length === 0)).toBe(true);
            expect(reads).toBeLessThanOrEqual(4 * 128);
        } finally {
            actions.forEach((one) => one.destroy());
            form.remove();
        }
    }
);

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
    // Nor is the target it wrote, named by a string: a registry of every row
    // ever seen kept one per string for as long as the component lived.
    expect(out.targets).toBe(0);
    expect(out.scope).toBe('object');
});
