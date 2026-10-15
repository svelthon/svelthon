// **A view does what its operation does in Python, and asks nothing before.**
// Python keeps its protocols apart: `__contains__` answers `in`, and
// `bag["x"]`, `bag["x"] = v` and `del bag["x"]` never ask it. A dict's view
// asked it before every read, write and deletion, twice for a read, so a class
// whose `in` answers otherwise read as empty, kept an entry deleted, or raised.
// The view now finds a key in the dict's storage, and asks `__contains__` for
// JavaScript's `in` alone, once, as Python's `in` does.
//
// The witness is the same operations written in Python (`python_answers`).
import { test, expect } from 'vitest';
import * as protocols from './fixtures/view_protocols.py';

test("a dict's view reads, writes and deletes by its storage, and asks `in` alone of its class", () => {
    const { hiding, raising, counting } = protocols;
    const [read, memberIn, left, written] = protocols.python_answers();

    expect(hiding.x).toBe(read);
    expect('x' in hiding).toBe(memberIn);

    delete hiding.x;
    expect(Object.keys(hiding).length).toBe(left);

    raising.y = 8;
    delete raising.x;
    expect(Object.keys(raising).sort()).toEqual([...written]);
    expect(() => 'y' in raising).toThrow(/no membership/);

    const before = protocols.asked();

    expect(counting.x).toBe(7);
    expect(protocols.asked() - before).toBe(0);

    expect('x' in counting).toBe(true);
    expect(protocols.asked() - before).toBe(1);
});
