import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import Greeting from './Greeting.svelte';
import PropsHost from './fixtures/PropsHost.svelte';
import PropsInit from './fixtures/PropsInit.svelte';

// An annotation declares a prop, a bare assignment declares internal state:
//     name: str          → required prop
//     punct: str = "!"   → prop with a default
//     greeting = "..."   → internal state

function render(Component, props) {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target, props });
    return (k) => target.querySelector(k === 'line' ? 'output' : `[data-k="${k}"]`).textContent;
}

describe('props', () => {
    test('the Python default applies when the parent passes nothing', () => {
        expect(render(Greeting, { name: 'Pierre' })('line')).toBe('Hello Pierre!');
    });

    test('the parent’s value wins over the default', () => {
        expect(render(Greeting, { name: 'Pierre', punct: '?' })('line')).toBe('Hello Pierre?');
    });

    test('a prop is readable while the module body runs', () => {
        expect(render(PropsInit, { name: 'Ada' })('initial')).toBe('Hello Ada');
    });

    test('a required prop that was not supplied is None, not undefined', () => {
        expect(render(Greeting, {})('line')).toBe('Hello None!');
    });

    test('internal state stays reactive alongside props', () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Greeting, { target, props: { name: 'Pierre' } });

        target.querySelector('button').click();
        flushSync();

        expect(target.querySelector('output').textContent).toBe('HELLO Pierre!');
    });

    test('an update from the parent reaches the Python', () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(PropsHost, { target });

        expect(target.querySelector('output').textContent).toBe('Hello Pierre!');

        target.querySelector('button[data-k="rename"]').click();
        flushSync();

        expect(target.querySelector('output').textContent).toBe('Hello Ada!');
    });
});
