// **A generator whose target is a key or an attribute of the row reads the
// row where it resumes**: `readLater` took the `row` of `row["flag"]` for a
// name the comprehension bound, and the target was never read late, so the
// row was handed as it was when the generator was made. Resumed after the row
// was replaced, it read `first` where Python reads `second`, and wrote into
// the row the list no longer held.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import GeneratorTargets from './fixtures/GeneratorTargets.svelte';

test('a generator whose target is a key or an attribute of the row reads and writes the row it resumes on', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(GeneratorTargets, { target });
    flushSync();

    const shown = () => ['item', 'attribute'].map((key) => target.querySelector(`[data-k="${key}"]`).textContent);
    const step = () => {
        const answers = [0, 1, 2, 3].map((at) => instance.resume(at));

        flushSync();
        return [answers.map(String), shown()];
    };

    const before = step();

    instance.replace();
    flushSync();

    expect([before, step()]).toEqual([
        [['first', '0', 'first', '0'], ['first:1', 'first:1']],
        [['second', '0', 'second', '0'], ['second:2', 'second:2']]
    ]);
});
