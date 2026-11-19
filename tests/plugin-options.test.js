import { test, expect } from 'vitest';
import { python, svelthon } from '../src/lib/svelthon.js';

// The one option of both halves is `path`, a list of folders. A misspelt
// `paths` was ignored in silence, the imports then searched nowhere, and a
// string raised `(options.path || []).map is not a function`.
test('an unknown option, or a path that is no list, is refused by both halves', () => {
    for (const make of [python, svelthon]) {
        expect(() => make({ paths: ['src/lib'] })).toThrow('unknown option `paths`');
        expect(() => make({ path: 'src/lib' })).toThrow('`path` takes a list of folders');
        expect(() => make({ path: ['src/lib'] })).not.toThrow();
        expect(() => make()).not.toThrow();
    }
});

// And options that are no object: `python(null)` raised a JavaScript error,
// and `python('src/lib')` was told of an option `0`.
test('options that are no object are refused by both halves, the folders named said as the option', () => {
    for (const make of [python, svelthon]) {
        expect(() => make(null)).toThrow("the options are an object, as `{ path: ['src/lib'] }`");
        expect(() => make('src/py')).toThrow("the options are an object, as `{ path: ['src/py'] }`");
        expect(() => make(['src/a', 'src/b'])).toThrow("the options are an object, as `{ path: ['src/a', 'src/b'] }`");
    }
});
