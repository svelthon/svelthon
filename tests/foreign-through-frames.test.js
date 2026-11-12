// A JavaScript value thrown through a Python frame comes out as it was thrown,
// SvelteKit's `error()` and `redirect()` among them: through a `with` or an
// `await` it kept the engine's `__traceback__`, six hundred kilobytes of engine
// for whoever walks it, and gained a `message`.
import { test, expect } from 'vitest';
import { withed, awaited } from './fixtures/foreign_through.py';

class HttpError {
    constructor(status) {
        this.status = status;
    }
}

test.for([
    ['a with', withed],
    ['an await', awaited]
])('a JavaScript value comes out of %s as it was thrown', async ([, through]) => {
    const kit = new HttpError(404);
    let caught;

    try {
        await through(kit);
    } catch (error) {
        caught = error;
    }

    expect(caught).toBe(kit);
    expect(Reflect.ownKeys(kit)).toEqual(['status']);
    expect(JSON.stringify(kit)).toBe('{"status":404}');
});
