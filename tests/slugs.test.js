import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import Slugs from './fixtures/Slugs.svelte';

// Django's `|slugify`, with the one difference that removes its option: a letter
// that does not fold to ASCII is kept rather than dropped. On Latin script the
// output is Django's to the character; elsewhere Django returns an empty slug
// for every title on the site.
describe('slugify', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Slugs, { target });
    flushSync();

    const read = (k) => target.querySelector(`[data-k="${k}"]`);
    const slug = (i) => read(`slug-${i}`).textContent;

    test('a plain title', () => {
        expect(slug(0)).toBe('making-the-gil-optional');
    });

    test('accents fold to ASCII, exactly as Django does it', () => {
        expect(slug(1)).toBe('ete-a-paris');
        expect(slug(9)).toBe('deja-vu');
    });

    test('a letter that does not fold is kept, not dropped', () => {
        // Django gives `strae` and `odz` here — the first letter of Łódź is lost.
        expect(slug(2)).toBe('straße');
        expect(slug(3)).toBe('łodz');
    });

    test('a title in another script keeps being a title', () => {
        // Django gives "" for both, so every article on the site shares a slug.
        expect(slug(4)).toBe('привет-мир');
        expect(slug(5)).toBe('日本語');
    });

    test('punctuation and runs of spaces collapse to one dash', () => {
        expect(slug(6)).toBe('c-rust');
        expect(slug(7)).toBe('espaces-multiples');
    });

    test('nothing to keep gives an empty slug', () => {
        expect(slug(8)).toBe('');
    });

    test('a value that is not a string goes through str() first', () => {
        expect(read('number').textContent).toBe('703');
    });

    test('and it is usable as an anchor id', () => {
        expect(read('anchor').id).toBe('making-the-gil-optional');
    });
});
