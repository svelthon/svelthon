// @vitest-environment node
//
// A helper recognises a Python scalar the way the conversions do, in every slot
// it reads one from.
//
// The repair for a scalar subclass landed in the runtime, and the helpers kept
// recognitions of their own: `instant`, behind `date` and `fromnow`, asked
// `ob_type === float` by identity, and `batch` asked `Number.isInteger` of the
// object a Python `int` is. So `class Stamp(float)` crossed correctly, printed
// correctly, and then `{date(stamp)}` answered *is not a date* — which in a
// template is a component that does not mount.
//
// **Then the repair itself was half of one, twice over.** It kept `pyScalar`'s
// answer only when that answer was a *number*, so `class Text(str)` holding an
// ISO date was refused exactly as before. And it repaired the values while the
// **options** beside them still asked `typeof === 'string'`: `date(when,
// Text("full"))` formatted in the default style and said nothing at all, which
// is the same defect without the mercy of an error.
//
// So this is the grid rather than the three cases that were reported: every slot
// a helper reads a scalar from, against the subclass and the exact type. They
// must answer the same thing, and `written()` is the one line that makes them.
import { test, expect, describe } from 'vitest';
import { says, controls, LABELS } from './fixtures/scalar_helpers.py';

describe('a helper handed a subclass of a scalar', () => {
    const derived = says();
    const exact = controls();

    test.for(LABELS.map((label, at) => [label, at]))(
        '%s answers what it answers for the exact type',
        ([, at]) => {
            expect(derived[at]).toBe(exact[at]);
        }
    );

    test('and the answers are the real ones, not two identical failures', () => {
        // A row of matching nothings would pass the grid above, so each control
        // is read for what it should actually say.
        const [stamp, relative, text, since, batched, full, short, french, ago, indented] = exact;

        expect(stamp).not.toMatch(/Invalid/);
        expect(relative).toBeTruthy();
        expect(text).toMatch(/2026/);
        expect(since).toBeTruthy();
        expect(batched).toBe('[[1, 2], [3]]');
        // The options are the half that failed in silence, so each has to be
        // shown doing something: a style that is not the default, a locale that
        // is not English, and an indent that puts the JSON on more than one line.
        expect(full).not.toBe(short);
        expect(full).toMatch(/Thursday/);
        expect(french).toMatch(/janvier/);
        expect(ago).toMatch(/ans/);
        expect(indented).toContain('\n');
    });
});
