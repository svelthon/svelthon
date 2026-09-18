// @vitest-environment node
//
// A helper recognises a Python number the way the conversions do.
//
// The repair for a scalar subclass landed in the runtime, and the helpers kept
// recognitions of their own: `instant`, behind `date` and `fromnow`, asked
// `ob_type === float` by identity, and `batch` asked `Number.isInteger` of the
// object a Python `int` is. So `class Stamp(float)` crossed correctly, printed
// correctly, and then `{date(stamp)}` answered *is not a date* — which in a
// template is a component that does not mount.
//
// It is the duplicate-rule family, one file further out: the recognition is
// shared now, and each helper keeps its own rule about what it will accept. The
// controls are the exact types, and the two must answer the same thing.
import { test, expect, describe } from 'vitest';
import { says, controls } from './fixtures/scalar_helpers.py';

describe('a helper handed a subclass of a scalar', () => {
    test('answers what it answers for the exact type', () => {
        expect(says()).toEqual(controls());
    });

    test('and the answers are the real ones, not two identical failures', () => {
        const [formatted, relative, batched] = controls();

        expect(formatted).not.toMatch(/Invalid/);
        expect(relative).toBeTruthy();
        expect(batched).toBe('[[1, 2], [3]]');
    });
});
