// **A set whose members change while it updates repaints, even at the size it
// began with**, as a `SvelteSet` does. The source an update reads may change the
// set itself, one member out and one in, and the size alone told the watch that
// nothing had changed: the model held `{2, 3}` and the page kept `1,2`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SetUpdateSource from './fixtures/SetUpdateSource.svelte';
import SetUpdateSourceNative from './fixtures/SetUpdateSourceNative.svelte';

test.for(
    [['Svelte', 'update', 'method']].concat(
        ['update', 'difference_update'].flatMap((kind) => ['method', 'kept', 'type'].map((form) => ['Python', kind, form])),
        [['Svelte', 'difference_update', 'method']]
    )
)('%s: %s from a source that swaps members, called by %s, repaints', ([language, kind, form]) => {
    const Component = language === 'Python' ? SetUpdateSource : SetUpdateSourceNative;
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props: { kind: kind === 'update' ? 'update' : 'difference', form } });
    flushSync();

    instance.change();
    flushSync();

    expect(target.querySelector('output').textContent).toBe('2,3');
});
