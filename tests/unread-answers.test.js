// Svelte reads nothing of what a cleanup, an `on_destroy`, an action's `update`
// and `destroy` or a transition's `tick` answers, and of what `on_mount`
// answers only a cleanup. Each answer was converted for a JavaScript reader, and
// a generator it held was walked: its body ran where nothing asked for it.
import { test, expect, afterEach } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import { events } from './fixtures/lifecycle_log.js';
import UnreadAnswers from './fixtures/UnreadAnswers.svelte';
import UnreadMount from './fixtures/UnreadMount.svelte';

const animate = Element.prototype.animate;

afterEach(() => {
    Element.prototype.animate = animate;
});

test('an answer Svelte does not read is never walked', () => {
    // An intro calls `tick(0, 1)` before it animates, which jsdom cannot.
    Element.prototype.animate = () => ({ playState: 'finished', currentTime: 0, cancel() {}, onfinish: null });
    events.length = 0;

    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(UnreadAnswers, { target, intro: true });

    flushSync();
    target.querySelector('button').click();
    flushSync();
    unmount(instance);
    flushSync();

    expect(events.filter((one) => one.startsWith('walk'))).toEqual([]);
    expect([...events].sort()).toEqual(
        ['action destroy', 'attach cleanup', 'destroy', 'effect cleanup', 'mount cleanup', 'tick', 'update'].sort()
    );
});

test("what on_mount answers is read for a cleanup and for nothing else", () => {
    events.length = 0;

    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(UnreadMount, { target });

    flushSync();
    unmount(instance);
    flushSync();

    expect(events).toEqual(['mounted']);
});
