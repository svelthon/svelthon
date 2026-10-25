// **A callable `inspect_with` is handed in grouping parentheses is the callable
// itself**, `(record)` being `record` to Python: `firstArgument` cut the call
// where the AST ends the first argument, inside the parentheses that group it,
// so the callable was `(record` and the values `), count`, and the component
// did not compile, "closing parenthesis ')' does not match".
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import InspectGroupedLogger from './fixtures/InspectGroupedLogger.svelte';

test('inspect_with logs through a callable written in grouping parentheses', () => {
    globalThis.__grouped = [];

    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(InspectGroupedLogger, { target });
    flushSync();

    const first = [...globalThis.__grouped];

    instance.bump();
    flushSync();

    expect(first).toEqual(Array(9).fill('init:0'));
    expect(globalThis.__grouped).toEqual([...Array(9).fill('init:0'), ...Array(9).fill('update:1')]);
    expect(target.querySelector('p').textContent).toBe('1');
});
