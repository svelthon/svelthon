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
