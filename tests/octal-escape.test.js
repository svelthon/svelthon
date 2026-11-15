// An octal escape in an f-string, `f"\033[1m{x}"`, was copied as it is into
// the JavaScript of the component, which a module, in strict mode, refuses:
// the build stopped on a parse error of the generated code, with no line of
// Python.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import OctalEscape from './fixtures/OctalEscape.svelte';

test('an octal escape in an f-string compiles and reads as Python reads it', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(OctalEscape, { target });
    flushSync();

    expect(target.querySelector('p').textContent).toBe('A1:5:27');
});
