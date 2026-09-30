// The modules a component can import from the runtime. The compiler's list and
// the runtime's are one list: the fixture imports every name the compiler lets
// through (`import-refusals.test.js` checks it lets nothing else through), and
// the runtime holds exactly those.
import { test, expect } from 'vitest';
import { mount } from './mounted.js';
import ProvidedModules from './fixtures/ProvidedModules.svelte';

test('the modules the compiler lets through are the ones the runtime holds', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(ProvidedModules, { target });

    expect(target.querySelector('[data-k="held"]').textContent).toBe(
        '_importlib,_suggestions,_sys,_warnings,browser,browser.aio,browser.html,builtins,javascript'
    );
});
