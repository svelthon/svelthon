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
    const seen = () => `${read('owner')} / ${read('child')}`;
    const out = [seen()];

    for (const step of ['bump', 'add', 'nest']) {
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
    expect(steps(LiveOwnerNative)).toEqual([
        '0|0.5|0|1,2|0 / 0|0.50|0|1,2|0|true',
        '1|0.5|0|1,2|1 / 1|0.50|0|1,2|1|true',
        '1|0.5|0|1,2,3|1 / 1|0.50|0|1,2,3|1|true',
        '1|0.5|1|1,2,3|1 / 1|0.50|1|1,2,3|1|true',
        '1|0.5|1|1,2,3,9|1 / 1|0.50|1|1,2,3,9|1|true',
        '10|0.5|1|1,2,3,9|1 / 10|0.50|1|1,2,3,9|1|true'
    ]);
});

// What the JavaScript child holds goes back to Python as the dict itself: to a
// Python child given it as a prop and through a context, and to a Python
// callback the JavaScript child calls with it.
test('and what it holds comes back to Python as the same dict', () => {
    const { read, click } = setup(LiveOwner);

    expect(read('python')).toBe('dict:True');

    click('pick');
    expect(read('picked')).toBe('dict:True');
});
