// @vitest-environment node
//
// The server half of `spread-scalars.test.js`: a server writes each spread
// value as the attribute written by name, where it wrote `[object Object]`.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import SpreadScalars from './fixtures/SpreadScalars.svelte';

test('a scalar spread onto an element renders on a server as the attribute written by name', () => {
    const inputs = [...render(SpreadScalars).body.matchAll(/<input[^>]*>/g)].map(([tag]) =>
        Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]))
    );
    const [direct, spread] = inputs;
    const named = (one) => ['min', 'step', 'title', 'data-count', 'aria-label'].map((name) => one[name]);

    expect(named(direct)).toEqual(['0.5', '0.5', '1.5', '3', 'named']);
    expect(named(spread)).toEqual(named(direct));
});
