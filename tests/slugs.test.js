import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import Slugs from './fixtures/Slugs.svelte';

// Django's `|slugify`, taken to its conclusion: a URL carries unicode, so the
// letters stay — all of them, not only the ones that happen not to decompose.
// Django folds accents to ASCII and drops what will not fold, which turns a
// Russian or Japanese site into one empty slug per article.
describe('slugify', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Slugs, { target });
    flushSync();

    const read = (k) => target.querySelector(`[data-k="${k}"]`);
    const slug = (i) => read(`slug-${i}`).textContent;

    test('a plain title', () => {
        expect(slug(0)).toBe('making-the-gil-optional');
    });

    test('accents are kept, where Django folds them', () => {
        // Django: `ete-a-paris`.
        expect(slug(1)).toBe('été-à-paris');
    });

    test('a letter that does not fold at all', () => {
        // Django: `strae` and `odz` — the first letter of Łódź is lost.
        expect(slug(2)).toBe('straße');
        expect(slug(3)).toBe('łódź');
    });

    test('another script keeps being a title', () => {
        // Django: "" for both.
        expect(slug(4)).toBe('привет-мир');
        expect(slug(5)).toBe('日本語');
    });

    test('a combining mark is a letter\'s half, not punctuation', () => {
        // A Devanagari vowel sign has no composed form: dropping marks would
        // give `ह-न-द-भ-ष-`, which is not a folded word but a shredded one.
        expect(slug(9)).toBe('tiếng-việt');
        expect(slug(11)).toBe('हिन्दी-भाषा');
    });

    test('a letter that only looks like an accented one', () => {
        // `Đ` is a letter of the Vietnamese alphabet, not a D with a stroke, so
        // it does not decompose and Django deletes it: the street Đồng Khởi
        // comes out as `uong-ong-khoi`.
        expect(slug(10)).toBe('đường-đồng-khởi');
    });

    test('punctuation and runs of spaces collapse to one dash', () => {
        expect(slug(6)).toBe('c-rust');
        expect(slug(7)).toBe('espaces-multiples');
    });

    test('an underscore stays, as it does in Django', () => {
        expect(slug(12)).toBe('a_b-c');
    });

    test('nothing to keep gives an empty slug', () => {
        expect(slug(8)).toBe('');
    });

    // Composing first is what stops one title from having two URLs.
    test('composed and decomposed give one slug', () => {
        expect(read('composed').textContent).toBe('été');
        expect(read('decomposed').textContent).toBe('été');
    });

    test('a value that is not a string goes through str() first', () => {
        expect(read('number').textContent).toBe('703');
    });

    test('and it is usable as an anchor id', () => {
        expect(read('anchor').id).toBe('making-the-gil-optional');
    });
});
