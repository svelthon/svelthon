// **A custom element's `value` property is handed the number or the string**, as
// any JavaScript reader of a Python value is, whether written by name or by a
// spread. It was handed what a select compares with, an object holding the
// number, so `typeof` said `object` and a NaN failed `Number.isNaN`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ElementValueProperty from './fixtures/ElementValueProperty.svelte';
import ElementValuePropertyNative from './fixtures/ElementValuePropertyNative.svelte';

if (!customElements.get('value-property')) {
    customElements.define(
        'value-property',
        class extends HTMLElement {
            get value() {
                return this.held;
            }

            set value(value) {
                this.held = value;
            }
        }
    );
}

const seen = (value) => (typeof value === 'number' && Number.isNaN(value) ? 'NaN' : typeof value);

test.for(
    ['Python', 'Svelte'].flatMap((language) =>
        ['direct', 'spread'].flatMap((form) =>
            [
                ['nan', 'NaN'],
                ['price', 'number'],
                ['count', 'number'],
                ['label', 'string'],
                ['float', 'number']
            ].map(([kind, type]) => [language, form, kind, type])
        )
    )
)('%s: a %s %s value reaches the property as %s', ([language, form, kind, type]) => {
    const Component = language === 'Python' ? ElementValueProperty : ElementValuePropertyNative;
    const target = document.body.appendChild(document.createElement('div'));

    mount(Component, { target, props: { kind, form } });
    flushSync();

    expect(seen(target.querySelector('value-property').value)).toBe(type);
});
