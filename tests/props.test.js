import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import Greeting from './Greeting.svelte';
import PropsHost from './fixtures/PropsHost.svelte';
import PropsInit from './fixtures/PropsInit.svelte';

// Une annotation déclare un prop, une affectation nue de l'état interne :
//     name: str          → prop requis
//     punct: str = "!"   → prop avec défaut
//     greeting = "..."   → état interne

function render(Component, props) {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target, props });
    return (k) => target.querySelector(k === 'line' ? 'output' : `[data-k="${k}"]`).textContent;
}

describe('props', () => {
    test('le défaut Python s’applique quand le parent ne passe rien', () => {
        expect(render(Greeting, { name: 'Pierre' })('line')).toBe('Hello Pierre!');
    });

    test('la valeur du parent l’emporte sur le défaut', () => {
        expect(render(Greeting, { name: 'Pierre', punct: '?' })('line')).toBe('Hello Pierre?');
    });

    test('un prop est lisible pendant l’exécution du corps du module', () => {
        expect(render(PropsInit, { name: 'Ada' })('initial')).toBe('Hello Ada');
    });

    test('un prop requis non fourni vaut None, pas undefined', () => {
        expect(render(Greeting, {})('line')).toBe('Hello None!');
    });

    test('l’état interne reste réactif à côté des props', () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Greeting, { target, props: { name: 'Pierre' } });

        target.querySelector('button').click();
        flushSync();

        expect(target.querySelector('output').textContent).toBe('HELLO Pierre!');
    });

    test('une mise à jour du parent traverse jusqu’au Python', () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(PropsHost, { target });

        expect(target.querySelector('output').textContent).toBe('Hello Pierre!');

        target.querySelector('button[data-k="rename"]').click();
        flushSync();

        expect(target.querySelector('output').textContent).toBe('Hello Ada!');
    });
});
