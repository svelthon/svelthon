// A marker under an annotation, `total: int = derived(lambda: …)`, is what
// TypeScript's `let total: number = $derived(…)` is to Svelte: a derived with a
// type. Every annotation was read as a prop, so the prop's default was the
// lambda itself: the template showed `<function <lambda>>`, an annotated effect
// never ran, and an annotated `export` was not exported. Each now does what the
// same line without its annotation does.
import { test, expect } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import AnnotatedMarkers from './fixtures/AnnotatedMarkers.svelte';

test('an annotated derived, effect and export are what they are without the annotation', async () => {
    const log = [];
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(AnnotatedMarkers, { target, props: { log: (line) => log.push(line) } });
    flushSync();

    expect(target.querySelector('p').textContent).toBe('2');
    expect(log).toEqual(['count 1']);
    expect(app.focus()).toBe(3);

    target.querySelector('button').click();
    flushSync();

    expect(target.querySelector('p').textContent).toBe('4');
    expect(log).toEqual(['count 1', 'count 2']);
    expect(app.focus()).toBe(5);

    await unmount(app);
    target.remove();
});
