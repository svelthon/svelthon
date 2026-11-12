// Svelte's prop written in the script's body is the child's own value: `value
// = value.toUpperCase()` shows `GIVEN`. Every write init() made was taken for
// the annotation's default, so the page kept what the parent passed, in
// silence. The default is the write the annotation itself makes, `None`
// included.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import PropBodyWrites from './fixtures/PropBodyWrites.svelte';
import PropSameLine from './fixtures/PropSameLine.svelte';

test('a write of the body overrides the prop, and the annotation declares its default', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(PropBodyWrites, {
        target,
        props: { upper: 'given', over: 'given', seen: 'given', normed: ' given ', count: 5, none: 'given', bound: 'given' }
    });
    flushSync();

    expect(target.querySelector('p').textContent).toBe('GIVEN|over|seen|GIVEN|6|kept|given|GIVEN');
});

// On the annotation's own line too: `text: str = " d "; text = text.strip()`
// shares its line with the default, and was taken for it.
test('a write after a semicolon on the annotation line is the child own', () => {
    const target = document.body.appendChild(document.createElement('div'));
    let up = 'given';

    mount(PropSameLine, {
        target,
        props: {
            text: ' given ',
            tally: 5,
            left: 'given',
            right: 'given',
            twice: 'given',
            get bound() {
                return up;
            },
            set bound(value) {
                up = value;
            }
        }
    });
    flushSync();

    expect(target.querySelector('p').textContent).toBe('GIVEN|6|GIVEN|GIVEN|GIVEN!|GIVEN');
    expect(up).toBe('GIVEN');
});

test('and with nothing passed, it is written over the default', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(PropSameLine, { target });
    flushSync();

    expect(target.querySelector('p').textContent).toBe('D|1|D|D|D!|D');
});
