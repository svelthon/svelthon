// @vitest-environment node
//
// The condition, not just the cleanup.
//
// `ssr.test.js` asserts that Brython's DOM stubs are gone after the bootstrap,
// and they are. What nothing asked is whether they go **under the right
// condition** — and the condition is the whole point of the block, which exists
// to leave a real browser's globals alone. Measured by mutation: turn either
// `&&` in `boot.js:37` and `:39` into `||` and not one test in the suite
// notices, in a file quoted at 100 % of statements since the first reading. A
// coverage figure is a floor on *lines*; the defects this project keeps finding
// live in *conditions*.
//
// Three scenarios, one child process each, because the decision runs once per
// process and reads a set recorded before Brython loads. The server case is the
// witness: it is what `ssr.test.js` already holds, and if it ever goes green
// while the other two do, the bench is measuring nothing.
import { test, expect, describe } from 'vitest';
import { execFileSync } from 'node:child_process';

const STUBS = ['document', 'location', 'HTMLElement', 'MutationObserver', 'customElements'];

// Asked once, because spawning is not everyone's to do: under a sandbox that
// forbids it these four come back as `spawnSync … EPERM`, a red that says
// nothing about the code. A run that cannot spawn says *that* instead, and the
// guard still holds everywhere a process can be made.
const canSpawn = (() => {
    try {
        execFileSync(process.execPath, ['-e', ''], { stdio: 'ignore' });

        return true;
    } catch {
        return false;
    }
})();

const boot = (scenario) =>
    JSON.parse(
        execFileSync(process.execPath, ['tests/fixtures/boot-globals.mjs', scenario], {
            encoding: 'utf8'
        })
    );

describe.skipIf(!canSpawn)('what the bootstrap cleanup is allowed to remove', () => {
    // The witness. Off a browser, everything Brython laid down goes.
    test('off a browser, the stubs are gone', () => {
        const after = boot('server');

        for (const name of STUBS) {
            expect(after[name], `${name} must not survive server rendering`).toBe('undefined');
        }
    });

    // `before && !before.has('window')`. In a page these globals belong to the
    // document, and a Brython that polyfilled a missing one polyfilled it for
    // the page, not for us.
    test('in a browser, nothing is removed at all', () => {
        const after = boot('browser');

        for (const name of STUBS) {
            expect(after[name], `${name} belongs to the page`).not.toBe('undefined');
        }
    });

    // `!before.has(name) && DOM_STUBS.has(name)`, both halves. The host's own
    // `HTMLElement` carries a stub's name and was not ours to add; `__witness`
    // was added after the recording and is not a stub name.
    test('a name the host already owned is not ours to remove', () => {
        expect(boot('hosted').element).toBe('Mine');
    });

    test('a name added after the recording, that is not a stub, stays', () => {
        for (const scenario of ['server', 'browser', 'hosted']) {
            expect(boot(scenario).witness, `witness in ${scenario}`).toBe('mine');
        }
    });
});
