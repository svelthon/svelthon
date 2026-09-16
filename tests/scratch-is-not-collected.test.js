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
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const COLLECTED = /\.(test|spec)\.[cm]?[jt]sx?$/;

// The room's name, spelled once and built into the pattern, so this file cannot
// match its own rule — a guard that reads sources has caught itself twice in
// this suite already.
const ROOM = 'scratch';
const READS = new RegExp(`['"]\\.{1,2}/${ROOM}/`);
const SELF = 'scratch-is-not-collected.test.js';

test('no probe in tests/scratch is collected by the suite', () => {
    const room = fileURLToPath(new URL('./scratch', import.meta.url));
    const collected = readdirSync(room).filter((name) => COLLECTED.test(name));

    expect(
        collected,
        `rename these to *.probe.js, or delete them: ${collected.join(', ')}`
    ).toEqual([]);
});

// The same question asked from the other end, and the half that was missing.
//
// The guard above watches what sits *inside* the room. Nothing watched for a
// reference *into* it, and a probe left in the collected directory imported
// three files out of it. Measured by emptying the room and running the suite:
// `Failed to resolve import`. A file that written policy calls disposable was
// load-bearing.
//
// Fixtures are read too, because a fixture is how a collected test would reach
// the room without naming it.
test('and nothing the suite keeps reads from it', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));

    const named = [
        ...readdirSync(here)
            .filter((name) => COLLECTED.test(name) && name !== SELF)
            .map((name) => [name, `${here}${name}`]),
        ...readdirSync(`${here}fixtures`).map((name) => [
            `fixtures/${name}`,
            `${here}fixtures/${name}`
        ])
    ].filter(([, path]) => statSync(path).isFile() && READS.test(readFileSync(path, 'utf8')));

    expect(
        named.map(([name]) => name),
        `these read a room whose README says nothing there is kept: move what they ` +
            `need into tests/fixtures, or move them into the room`
    ).toEqual([]);
});
