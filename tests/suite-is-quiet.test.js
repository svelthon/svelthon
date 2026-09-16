// @vitest-environment node
//
// A green run printed three tracebacks. Nothing was wrong: they come from tests
// that raise on purpose, and jsdom reports an uncaught `ErrorEvent` to the
// console unless the listener calls `preventDefault()`.
//
// The question — how do I catch a deliberate raise without printing it — was
// asked in five files, four answered it, and one did not. What makes it worth a
// guard rather than a shrug: this project has just spent three readings building
// instruments to read what the toolchain says, the compiler's warnings and the
// browser's console among them. **A suite that prints its own deliberate
// failures teaches its reader that its stderr is noise**, which is the one habit
// those instruments cannot survive.
//
// So the suite polices the room, the way it does for `tests/scratch`.
//
// Counted rather than read in place: the call is often in a named handler, a few
// lines from the `addEventListener` that installs it, so a window after the call
// site answers false for four files out of five. One `preventDefault` per
// listener is the shape every one of them has.
import { test, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));

// Built from pieces so that this file does not match its own rule: the needle
// is what the sources write literally, and writing it here would be a sixth
// listener that never listens to anything.
const LISTENS = new RegExp(`addEventListener\\(\\s*${"'"}error${"'"}`, 'g');
// The call, not the word: a comment naming `preventDefault` counted as one, and
// the guard passed a file it should have named. Measured — the injury below went
// green until this line had its parenthesis.
const PREVENTS = /preventDefault\(/g;

const count = (source, pattern) => [...source.matchAll(pattern)].length;

test('every deliberate raise is caught without printing it', () => {
    const noisy = [];

    for (const name of readdirSync(HERE).filter((one) => one.endsWith('.test.js'))) {
        const source = readFileSync(`${HERE}${name}`, 'utf8');
        const listens = count(source, LISTENS);

        if (listens > 0 && count(source, PREVENTS) < listens) noisy.push(name);
    }

    expect(
        noisy,
        'these files let jsdom print a raise the test asked for: add event.preventDefault()'
    ).toEqual([]);
});
