import { test, expect } from 'vitest';
import { mounted } from './oracle.js';
import JsContainers from './fixtures/JsContainers.svelte';

// A JavaScript `Set` or `Map` Python holds and changes by its own methods
// repaints what reads it. Nothing of the engine's runs in `members.add(1)`, so
// the method read under the name of one of JavaScript's mutators notifies once
// called. The builtin mutators wrapped at their source left these out.
test.for([
    ['set add', ['0', '1', '2']],
    ['set delete', ['2', '1', '0']],
    ['set clear', ['2', '0', '1']],
    ['map set', ['0', '1', '2']],
    ['map delete', ['2', '1', '0']],
    ['set held by an instance', ['0', '1', '2']],
    ['set behind a method', ['0', '1', '2']],
    // The method read as a value and called later, which a check at the call
    // alone missed.
    ['kept method', ['0', '1', '2']],
    ['method taken by getattr', ['0', '1', '2']]
])('a JavaScript container changed from Python repaints: %s', ([kind, sizes]) => {
    const { models, pages } = mounted(JsContainers, kind, (instance, target, step) => instance.change(step));

    expect(models).toEqual(sizes);
    expect(pages).toEqual(models);
});
