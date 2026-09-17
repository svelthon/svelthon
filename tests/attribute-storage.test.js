// Writing an attribute, and writing the thing that holds the attributes.
//
// The initial walk hands the watch to every value stored in an instance's
// dictionary, and never to the dictionary itself. Three of the four ways to set
// an attribute therefore worked by going through something the runtime already
// intercepts — `box.value = 1` through `$setattr`, `box.__dict__[...] = 1`
// through the `$getattr` that hands the watch to what it returns — while
// `vars(box)` asks the engine for the storage with `$B.get_dict` and writes into
// it. The data moved, the page did not.
//
// The storage is a child of the instance like any other, so it is marked like
// any other. The three working spellings stay in the file as witnesses: what
// changed must be the missing link, not the ones that held.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import AttrStorage from './fixtures/AttrStorage.svelte';

const setup = () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(AttrStorage, { target });
    flushSync();

    return {
        read: (key) => target.querySelector(`[data-k="${key}"]`).textContent,
        click: (key) => {
            target.querySelector(`button[data-k="${key}"]`).click();
            flushSync();
        }
    };
};

describe.for([['attr'], ['dunder'], ['vars'], ['update']])(
    'an attribute written by %s',
    ([key]) => {
        test('repaints what reads it', () => {
            const { read, click } = setup();

            expect(read('value')).toBe('0');

            click(key);

            expect(read('value')).toBe('1');
        });
    }
);

// And a container that arrives through the storage: it has to come under watch
// on the way in, or mutating it later repaints nothing. Two clicks, so the
// second mutation cannot ride on the first notification.
test('a container added through vars() is watched', () => {
    const { read, click } = setup();

    click('new-child');

    expect(read('later')).toBe('0');

    click('fill');

    expect(read('later')).toBe('1');
});
