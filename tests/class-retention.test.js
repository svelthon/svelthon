import { test, expect } from 'vitest';
import { execFileSync } from 'node:child_process';

// A class made and dropped is collected, as a component's class is at every
// mount. Two things held one for ever: its base's list of subclasses, and the
// marker of a name read on it, whose wake-up held the class while a value it
// named, a list the module shares, lived on. Collection is out of a test's
// reach, so `tests/class-retention.mjs` runs under `node --expose-gc`.
test('a class nobody refers to any more is collected', () => {
    const alive = JSON.parse(execFileSync(process.execPath, ['--expose-gc', 'tests/class-retention.mjs'], { encoding: 'utf8' }).trim().split('\n').pop());

    expect(alive).toEqual({
        'a shared list read by its class name': 0,
        'an own list read': 0,
        'a list nobody reads': 0,
        'a subclass of a class that stays': 0
    });
});
