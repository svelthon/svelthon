// A value refused on the way out names the call that returned it, whether it
// was returned directly or from a coroutine. The conversion of a resolved value
// runs after the call has returned, outside the `try` that names it, so the
// awaited refusal said what was wrong and not where.
import { test, expect } from 'vitest';
import { direct, awaited } from './fixtures/async_refusal.py';

const message = async (call) => {
    try {
        await call();
    } catch (error) {
        return String(error.message);
    }
};

test.for([
    ['direct', direct],
    ['awaited', awaited]
])('a refused %s return names its function and file', async ([name, call]) => {
    const said = await message(call);

    expect(said).toContain('cannot tell apart');
    expect(said).toContain(`${name}()`);
    expect(said).toContain('async_refusal.py');
});
