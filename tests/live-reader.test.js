import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import LiveOwner from './fixtures/LiveOwner.svelte';
import LiveOwnerNative from './fixtures/LiveOwnerNative.svelte';

const setup = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target });
    flushSync();

    const read = (k) => target.querySelector(`[data-k="${k}"]`)?.textContent;

    return {
        instance,
        read,
        click: (k) => {
            target.querySelector(`[data-k="${k}"]`).click();
            flushSync();
        }
    };
};

// A JavaScript child reads a Python list or dict as it reads a `$state` one:
// changed in place by its owner, at the top, in a list or one level down, it
// repaints, whether it came as a prop or through a context; and what the child
// writes in place reaches the owner.
const steps = (Component) => {
    const { instance, read, click } = setup(Component);
    const seen = () => `${read('owner')} / ${read('child')} / ${read('shape')}`;
    const out = [seen()];

    // One change per step: a repaint one of them causes rereads the others.
    for (const step of ['bump', 'share', 'add', 'nest']) {
        instance[step]();
        flushSync();
        out.push(seen());
    }

    click('push');
    out.push(seen());
    click('set');
    out.push(seen());

    return out;
};

test('a JavaScript child follows Python data as it follows Svelte state', () => {
    expect(steps(LiveOwner)).toEqual(steps(LiveOwnerNative));
});

// The witness, Svelte's own owner and the same child.
test('the Svelte owner is the rule', () => {
    const shape = (count, n, rows) =>
        `{"count":${count},"rate":0.5,"inner":{"n":${n}}}|count,rate,inner,none|true|` +
        rows.map((row) => `[${row}]`).join('');

    expect(steps(LiveOwnerNative)).toEqual([
        `0|0.5|0|1,2|0 / 0|0.50|0|1,2|0|true / ${shape(0, 0, [1, 2])}`,
        `1|0.5|0|1,2|0 / 1|0.50|0|1,2|0|true / ${shape(1, 0, [1, 2])}`,
        `1|0.5|0|1,2|1 / 1|0.50|0|1,2|1|true / ${shape(1, 0, [1, 2])}`,
        `1|0.5|0|1,2,3|1 / 1|0.50|0|1,2,3|1|true / ${shape(1, 0, [1, 2, 3])}`,
        `1|0.5|1|1,2,3|1 / 1|0.50|1|1,2,3|1|true / ${shape(1, 1, [1, 2, 3])}`,
        `1|0.5|1|1,2,3,9|1 / 1|0.50|1|1,2,3,9|1|true / ${shape(1, 1, [1, 2, 3, 9])}`,
        `10|0.5|1|1,2,3,9|1 / 10|0.50|1|1,2,3,9|1|true / ${shape(10, 1, [1, 2, 3, 9])}`
    ]);
});

// What the JavaScript child holds goes back to Python as the dict itself: to a
// Python child given it as a prop and through a context, and to a Python
// callback the JavaScript child calls with it.
test('and what it holds comes back to a Python child as the same dict', () => {
    expect(setup(LiveOwner).read('python')).toBe('dict:True');
});

test('and to a Python callback the JavaScript child calls with it', () => {
    const { read, click } = setup(LiveOwner);

    click('pick');
    expect(read('picked')).toBe('dict:True');
});
