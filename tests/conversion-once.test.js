// **A JavaScript method called from Python converts its arguments once**, as
// the engine alone does: a conversion that raises reaches the author and the
// call does not happen. Telling whether a `Set` or a `Map` changed, the watch
// converted them first for itself, swallowed what that raised, and the call,
// converting them again, went through: the key was added or removed all the
// same, and the author saw no error.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ConversionOnce from './fixtures/ConversionOnce.svelte';

test.for([
    ['set add', { size: 0, holds: false, reads: 1 }],
    ['set delete', { size: 1, holds: true, reads: 1 }],
    ['map key', { size: 0, holds: false, reads: 1 }],
    ['map value', { size: 1, holds: false, reads: 1 }],
    ['map delete', { size: 1, holds: true, reads: 1 }]
])('%s with a key whose conversion raises raises, and changes nothing', ([kind, expected]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(ConversionOnce, { target, props: { kind } });
    flushSync();

    expect(() => instance.run()).toThrow('conversion refused');
    expect(instance.model()).toEqual(expected);
});
