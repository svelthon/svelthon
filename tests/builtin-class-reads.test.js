// **A reaction follows no name of a builtin class**: no write can change one,
// `str.x = 1` raises. Followed, each `isinstance()` and each lookup the
// comparisons of a `sorted()` make through `tuple` and `object` was an effect
// of Svelte's, made and destroyed at each run: the reaction sorting 500 pairs
// took three times the sort itself. Timed against the same call made outside
// any reaction, the best of five each.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import BuiltinClassReads from './fixtures/BuiltinClassReads.svelte';

const best = (run) => {
    let least = Infinity;

    for (let round = 0; round < 5; round++) {
        const start = performance.now();

        run();
        least = Math.min(least, performance.now() - start);
    }

    return least;
};

test('a reaction reading builtin classes costs about what its work costs', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(BuiltinClassReads, { target });

    flushSync();

    const alone = best(() => instance.work());
    const reacting = best(() => {
        instance.grow();
        flushSync();
    });

    expect(target.textContent).toBe('500');
    expect(reacting).toBeLessThan(2 * alone);
    target.remove();
});
