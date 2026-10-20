// A plain module's `@derived` is a call made at every read, and was exported as
// the value that call gave at import: after `bump()`, JavaScript read `total`
// as `0` where Python read `2`. Svelte refuses to export derived state from a
// module, `derived_invalid_export`, and advises exporting a function returning
// the value. So does a `.py`: `__all__` naming a `@derived` is refused, and
// without `__all__` the functions alone are exported. Python reads it as before.
import { test, expect } from 'vitest';
import * as module from './fixtures/derived_module.py';
import { compile } from '../src/lib/compile.js';

test('a module cannot export a @derived, and is told what to export instead', () => {
    const src = '__all__ = ["total"]\ncounter = 0\n\n@derived\ndef total():\n    return counter * 2\n';

    expect(() => compile(src, 'Probe', 'src/probe.py', { plain: true })).toThrow(
        /`total`, a `@derived`, which a module cannot export.*export a function returning it \(src\/probe\.py:1\)/s
    );
});

test('without __all__ its functions are exported, and Python reads the derived as it is now', () => {
    expect('total' in module).toBe(false);
    module.bump();
    expect(module.read()).toBe(2);
});
