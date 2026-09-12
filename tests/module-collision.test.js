// @vitest-environment node
//
// Python imports a module by its name, and a file's name is its stem. So
// `a/config.py` and `b/config.py` are both `config`, `$B.imported` holds one
// entry per name, and the second loaded replaced the first: every `import
// config` in the project then read whichever came last, wherever it sat.
//
// Refused rather than made unique. A directory-aware name would have to be one
// Python can write, and `import config` cannot say which directory it means.
import { test, expect, describe } from 'vitest';
import { registerModule } from '../src/lib/runtime.js';

describe('two Python modules of one name', () => {
    const register = (name, source) => registerModule(name, { $proxy: true }, source);

    test('the second is refused, and both files are named', () => {
        register('config', 'src/a/config.py');

        expect(() => register('config', 'src/b/config.py')).toThrow(
            /`src\/b\/config\.py` and `src\/a\/config\.py` are both imported as `config`/
        );
    });

    test('and the message says what to do about it', () => {
        register('settings', 'src/a/settings.py');

        expect(() => register('settings', 'src/b/settings.py')).toThrow(/Rename one of them/);
    });

    // A watched file is recompiled on every edit, and the preprocessor runs its
    // hooks more than once per file. Registering the same path again is the
    // normal case, not a collision.
    test('the same file may register as often as it likes', () => {
        register('theme', 'src/theme.py');
        register('theme', 'src/theme.py');

        expect(() => register('theme', 'src/theme.py')).not.toThrow();
    });

    test('and two names that differ are both fine', () => {
        register('alpha', 'src/alpha.py');

        expect(() => register('beta', 'src/beta.py')).not.toThrow();
    });
});
