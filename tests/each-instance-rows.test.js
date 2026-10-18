// **Computing the rows of a block again costs about what the computation
// costs**, when it reads an attribute of each of 2 000 instances. Each read
// of a name of a class and each instance read was a subscription of its own,
// an effect of Svelte's made and destroyed at each computation: a row added
// cost twelve times what filtering them cost, and costs under three times
// now. Timed against the same filter called outside any reaction, the best of
// five each; the rows kept are the few added, so rendering them costs next to
// nothing.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import EachInstanceRows from './fixtures/EachInstanceRows.svelte';

const best = (run) => {
    let least = Infinity;

    for (let round = 0; round < 5; round++) {
        const start = performance.now();

        run();
        least = Math.min(least, performance.now() - start);
    }

    return least;
};

test('rows read from instances are computed again at about the cost of computing them', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(EachInstanceRows, { target });

    flushSync();

    const alone = best(() => instance.work());
    const added = best(() => {
        instance.add();
        flushSync();
    });

    expect(target.querySelectorAll('i').length).toBe(5);
    expect(added).toBeLessThan(5 * alone);
    target.remove();
});
