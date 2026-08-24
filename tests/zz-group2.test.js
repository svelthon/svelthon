import { test, expect } from 'vitest';
import { mount, flushSync } from 'svelte';
import ZZGroup2 from './fixtures/ZZGroup2.svelte';

test('where does the write land', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(ZZGroup2, { target });
    flushSync();

    const t = (k) => target.querySelector(`[data-k="${k}"]`).textContent;
    const before = `${t('py')} | ${t('js')}`;

    target.querySelector('[data-k="b"]').click();
    flushSync();
    target.querySelector('[data-k="bump"]').click();
    flushSync();

    expect(`AVANT ${before}\nAPRÈS ${t('py')} | ${t('js')}`).toBe('SHOW');
});
