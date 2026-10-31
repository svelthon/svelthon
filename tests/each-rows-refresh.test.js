// The computation of an `{#each}`'s rows is followed for a change inside what
// it read: once it reads another list, that list is the one followed. What it
// read was noted and the subscription left on the first list, so an append to
// the second showed nothing.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import EachSwitchedSource from './fixtures/EachSwitchedSource.svelte';

test('a change inside the list the rows read now is followed', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(EachSwitchedSource, { target });
    const rows = () => target.querySelector('[data-k="rows"]').textContent;

    flushSync();
    const seen = [rows()];

    instance.turn();
    flushSync();
    seen.push(rows());
    instance.grow();
    flushSync();
    seen.push(rows());

    expect(seen).toEqual(['1', '2', '23']);
});
