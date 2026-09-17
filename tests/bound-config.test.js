// A callback the framework keeps, inside a configuration object.
//
// `pyNumbers` converts the floats of an object crossing to JavaScript and
// adapts the callbacks it holds, because a transition's `tick(t, u)` is called
// by Svelte with raw numbers and Brython reads a number as an int. It found
// those callbacks with `typeof one === 'function'`, the test every other
// boundary has stopped using: a bound method is an object, so
// `{'tick': ticker.tick}` handed the framework something it could not call at
// all — beside a `duration` converted correctly, which is what makes the failure
// quiet.
//
// The witness is the same configuration with an ordinary function that calls the
// same method.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import BoundConfig from './fixtures/BoundConfig.svelte';

describe.for([
    ['a bound method', 'bound_config'],
    ['an ordinary function', 'plain_config']
])('a configuration whose callback is %s', ([, name]) => {
    test('hands over a number and something callable', () => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(BoundConfig, { target });

        flushSync();
        instance.reset();

        const config = instance[name]();

        expect(config.duration).toBe(0.5);
        expect(typeof config.tick).toBe('function');

        // The fractional argument is the point: it must reach Python as a float.
        config.tick(0.25, 0.75);

        expect(instance.last()).toBe('0.25');
    });
});
