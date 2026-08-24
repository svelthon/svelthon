import { test, expect } from 'vitest';
import { mount, flushSync } from 'svelte';
import ZZGroup2 from './fixtures/ZZGroup2.svelte';

test('probe', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(ZZGroup2, { target });
    flushSync();

    const read = (k) => target.querySelector(`[data-k="${k}"]`).textContent;
    const click = (k) => { target.querySelector(`[data-k="${k}"]`).click(); flushSync(); };

    const checked = () => ['da', 'db', 'oa', 'ob'].map((k) => `${k}=${target.querySelector(`[data-k="${k}"]`).checked}`).join(' ');

    click('check');
    const before = `${read('report')}\n       cochés : ${checked()}`;

    click('db');
    click('ob');
    click('check');

    expect(`AVANT  ${before}\nAPRÈS  ${read('report')}\n       cochés : ${checked()}\n       ${read('live')}`).toBe('SHOW');
});
