// A prop the Python child writes a field of through `globals()`,
// `globals()["ticket"]["label"] = …` or `globals().get("ticket")[…]`, is held
// as Svelte holds a prop its child writes: taken for one it only reads, the
// child read the parent's new object beside a derived of the old one, and its
// click wrote into the new one.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import WrittenMemberRoot from './fixtures/WrittenMemberRoot.svelte';

test('a prop whose field the child writes through globals() is held as Svelte holds it', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(WrittenMemberRoot, { target });
    const shown = () => ['indexed', 'lookup', 'native'].map((side) => target.querySelector(`[data-k="${side}"] [data-k="child"]`).textContent);

    flushSync();
    instance.revise('B');
    flushSync();

    const revised = shown();

    for (const one of target.querySelectorAll('[data-k="edit"]')) one.click();
    flushSync();

    expect([revised, instance.labels()]).toEqual([Array(3).fill('1|A|A!'), { first: Array(3).fill('mine'), current: Array(3).fill('B') }]);
});
