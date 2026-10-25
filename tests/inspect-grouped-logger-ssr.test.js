// @vitest-environment node
//
// The server half of `inspect-grouped-logger.test.js`: a component that hands
// `inspect_with` a callable in grouping parentheses compiles for the server
// too, where the cut through those parentheses was refused the same way.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import InspectGroupedLogger from './fixtures/InspectGroupedLogger.svelte';

test('the server renders a component whose inspect_with callable is grouped', () => {
    globalThis.__grouped = [];

    expect(render(InspectGroupedLogger).body).toContain('<p>0</p>');
    expect(globalThis.__grouped).toEqual(Array(9).fill('init:0'));
});
