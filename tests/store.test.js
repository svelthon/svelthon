import { test, expect } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import StoreA from './fixtures/StoreA.svelte';
import StoreB from './fixtures/StoreB.svelte';
import StoreFromPython from './fixtures/StoreFromPython.svelte';

// Un store est du Python au niveau module : ses signaux existent une fois pour
// toute l'application, là où l'état d'un composant naît et meurt avec chaque
// instance.
test('un état Python partagé entre deux composants', () => {
    const t = document.body.appendChild(document.createElement('div'));
    mount(StoreA, { target: t });
    mount(StoreB, { target: t });
    const read = (k) => t.querySelector(`p[data-k="${k}"]`).textContent;
    const click = (k) => { t.querySelector(`button[data-k="${k}"]`).click(); flushSync(); };

    expect(read('a')).toBe('A:0:[]');
    expect(read('b')).toBe('B:0:');

    click('inc');
    click('inc');
    expect(read('a')).toBe('A:2:[1, 2]');
    expect(read('b')).toBe('B:2:1,2');   // l'autre composant suit

    click('reset');
    expect(read('a')).toBe('A:0:[]');
    expect(read('b')).toBe('B:0:');
});

test('l’état d’un store survit au démontage', () => {
    const t = document.body.appendChild(document.createElement('div'));
    const first = mount(StoreA, { target: t });
    t.querySelector('button[data-k="inc"]').click();
    flushSync();
    expect(t.querySelector('p[data-k="a"]').textContent).toBe('A:1:[1]');

    unmount(first);
    flushSync();

    const second = document.body.appendChild(document.createElement('div'));
    mount(StoreA, { target: second });
    expect(second.querySelector('p[data-k="a"]').textContent).toBe('A:1:[1]');

    mount(StoreB, { target: second });
    second.querySelector('button[data-k="reset"]').click();
    flushSync();
});

// Le pont dans l'autre sens : le Python d'un composant importe le store et
// atteint les mêmes signaux que le gabarit.
test('le Python d’un composant importe le store', () => {
    const t = document.body.appendChild(document.createElement('div'));
    mount(StoreB, { target: t });
    mount(StoreFromPython, { target: t });

    t.querySelector('button[data-k="reset"]').click();
    flushSync();
    expect(t.querySelector('p[data-k="b"]').textContent).toBe('B:0:');

    t.querySelector('button[data-k="bump"]').click();
    flushSync();

    expect(t.querySelector('p[data-k="seen"]').textContent).toBe('2'); // lu depuis Python
    expect(t.querySelector('p[data-k="b"]').textContent).toBe('B:2:1,2');  // vu par l'autre composant
});
