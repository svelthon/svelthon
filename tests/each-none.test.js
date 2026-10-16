// **None walks nothing**, as Svelte walks nothing of `null`, and an `{:else}`
// shows. None is absence in the template, as for a value it renders and an
// attribute it writes; Python's `for one in None` raises, and a list a prop or
// a fetch had not handed over yet took the component down with `'NoneType'
// object is not iterable`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import EachNone from './fixtures/EachNone.svelte';
import EachNoneNative from './fixtures/EachNoneNative.svelte';

const shown = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(Component, { target });
    flushSync();

    return Object.fromEntries([...target.querySelectorAll('p')].map((p) => [p.dataset.k, p.innerHTML]));
};

test('an {#each} over None walks nothing, as Svelte walks nothing of null', () => {
    expect(shown(EachNone)).toEqual(shown(EachNoneNative));
    expect(shown(EachNone)).toEqual({ plain: '', else: '<b>empty</b>' });
});
