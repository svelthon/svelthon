import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import DjangoDoc from './fixtures/DjangoDoc.svelte';

// DJANGO.md maps every everyday Django construct onto its Svelthon counterpart.
// The side-by-side example there is this component, verbatim — so the page
// cannot drift into fiction without this file going red.
describe('the example in DJANGO.md', () => {
    const render = (props) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(DjangoDoc, { target, props });
        flushSync();
        return (k) => target.querySelector(`[data-k="${k}"]`);
    };

    const PEPS = [
        { number: 703, title: 'Making the GIL Optional' },
        { number: 750, title: 'Template Strings' }
    ];

    test('a default, a counter, an interpolated href and len()', () => {
        const el = render({ peps: PEPS, status: null });

        // `{status or "All"}` — Django's |default:"All", in Python.
        expect(el('title').textContent).toBe('All PEPs');

        // `{i + 1}` — Django's forloop.counter, one-based from a zero-based index.
        const rows = [...el('list').children].map((n) => n.textContent.replace(/\s+/g, ' ').trim());
        expect(rows).toEqual([
            '1. PEP 703 — Making the GIL Optional',
            '2. PEP 750 — Template Strings'
        ]);

        // `href="/pep/{pep.number}"` — an interpolation inside a quoted attribute.
        expect(el('list').querySelector('a').getAttribute('href')).toBe('/pep/703');

        // `{len(peps)}` — Django's |length.
        expect(el('count').textContent).toBe('2 shown');
    });

    test('the status wins over the default when it is given', () => {
        expect(render({ peps: PEPS, status: 'Accepted' })('title').textContent).toBe('Accepted PEPs');
    });

    test('{:else} is Django’s {% empty %}', () => {
        const el = render({ peps: [], status: null });

        expect(el('list').textContent.trim()).toBe('Nothing here.');
        expect(el('count').textContent).toBe('0 shown');
    });
});
