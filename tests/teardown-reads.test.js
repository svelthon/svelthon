// **A teardown reads a name as Svelte hands it, and a container as it is
// now**, as the README says. Svelte hands a teardown the value a name had
// before the change that runs the effect again; a dict changed in place is one
// value, already changed, a Python container keeping no old copy of its
// members. What the run kept for its teardown is what the run saw.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import TeardownReads from './fixtures/TeardownReads.svelte';

test('a teardown reads the name before the change, the dict as it is, and what its run kept', () => {
    const events = [];
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(TeardownReads, { target, props: { events } });

    flushSync();
    instance.change();
    flushSync();

    const log = events.map((one) => [...one]);

    expect(log).toContainEqual(['clean', 0, 1]);
    expect(log).toContainEqual(['kept', 0, 0]);
    expect(log.filter(([kind]) => kind === 'open')).toEqual([
        ['open', 0, 0],
        ['open', 1, 1]
    ]);
});
