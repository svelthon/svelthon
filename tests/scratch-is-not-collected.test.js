// @vitest-environment node
//
// `tests/scratch` is a room for throwaway probes: its README says nothing there
// is referenced and nothing there is kept. The convention is `*.probe.js`, which
// vitest does not collect — but a probe named `*.test.js` joins the validation
// run, and one of them raised on purpose to show its result. `npm test` was then
// red for a failure that belonged to nobody, and read from outside the suite was
// simply not green.
//
// Excluding the directory from the config was tried first and is worse: vitest
// applies `exclude` to a file named on the command line too, so the room stops
// being runnable at all, which is the room's whole purpose.
//
// So the suite polices it instead of ignoring it, and says which file to rename.
import { test, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const COLLECTED = /\.(test|spec)\.[cm]?[jt]sx?$/;

test('no probe in tests/scratch is collected by the suite', () => {
    const room = fileURLToPath(new URL('./scratch', import.meta.url));
    const collected = readdirSync(room).filter((name) => COLLECTED.test(name));

    expect(
        collected,
        `rename these to *.probe.js, or delete them: ${collected.join(', ')}`
    ).toEqual([]);
});
