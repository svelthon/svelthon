// @vitest-environment node
//
// One coroutine object, one run — whichever route it takes out.
//
// The converter memoises the run, so the same coroutine under two keys of a
// returned dict runs once. `pyCall` did not ask: it handed the function's result
// straight to `scheduleAsync`, which starts the coroutine with `aio.run` and
// never looked at the memo. So returning the same coroutine twice ran its body
// twice, silently, while returning it twice *inside a dict* ran it once.
//
// A Python coroutine is not freely re-runnable, and this project has already
// chosen to share one execution. Doing that on one route and not the other is
// the defect; the counter is what says so, since both routes resolve to 42
// either way.
import { test, expect, describe } from 'vitest';
import {
    direct,
    nested,
    fresh,
    count,
    reset,
    nested_broken,
    direct_broken,
    arm
} from './fixtures/shared_coroutine.py';

describe('the same coroutine handed over twice', () => {
    test('runs once through two direct returns', async () => {
        reset();

        expect(await Promise.all([direct(), direct()])).toEqual([42, 42]);
        expect(count()).toBe(1);
    });

    test('runs once through a returned dict, which already held', async () => {
        reset();

        const out = nested();

        expect(out.a).toBe(out.b);
        expect(await Promise.all([out.a, out.b])).toEqual([42, 42]);
        expect(count()).toBe(1);
    });

    // Both orders, because a memo filled by one route has to be read by the
    // other and not only the way round that happens to be tested.
    test('runs once across the two routes, dict first', async () => {
        reset();

        const out = nested();

        expect(await Promise.all([out.a, direct()])).toEqual([42, 42]);
        expect(count()).toBe(1);
    });

    test('and across the two routes, direct first', async () => {
        reset();

        const held = direct();

        expect(await Promise.all([held, nested().a])).toEqual([42, 42]);
        expect(count()).toBe(1);
    });

    // The witness: two coroutine objects are two runs, and must stay so.
    test('while two coroutines are two runs', async () => {
        reset();

        expect(await Promise.all([fresh(), fresh()])).toEqual([42, 42]);
        expect(count()).toBe(2);
    });

    // What sharing one run costs, written down because it is a trade and not an
    // oversight. `pyError` describes an exception once, so the *label* on a
    // shared failure is the first asker's: here the data route, which has no
    // position of its own and says `coroutine`. The line stays the author's — it
    // comes from the traceback, not from the label — and the alternative was
    // running the body a second time to earn a second label.
    test('a shared rejection keeps the first label, and the author’s line', async () => {
        arm();

        await expect(nested_broken().a).rejects.toThrow(/ValueError: no such page/);

        const second = await direct_broken().catch((error) => error);

        expect(second.message).toMatch(/ValueError: no such page/);
        expect(second.message).toMatch(/coroutine:\d+/);
    });

    // And an export that is the only route to its coroutine still names itself.
    test('while an export that asks first names itself', async () => {
        arm();

        await expect(direct_broken()).rejects.toThrow(
            /direct_broken\(\) — tests\/fixtures\/shared_coroutine\.py/
        );
    });

    // Asking again after it resolved is the same object, so the same run.
    test('and asking again after it resolved does not run it again', async () => {
        reset();

        expect(await direct()).toBe(42);
        expect(await direct()).toBe(42);
        expect(count()).toBe(1);
    });
});
