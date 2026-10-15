// **A view does what its operation does in Python, and asks nothing before.**
// Python keeps its protocols apart: `__contains__` answers `in`, and
// `bag["x"]`, `bag["x"] = v`, `del bag["x"]` and `discard` never ask it. A
// dict's view asked it before every read, write and deletion, twice for a read,
// so a class whose `in` answers otherwise read as empty, kept an entry deleted,
// or raised; and a set's view asked it before `discard`, hashing the member a
// second time, and kept a member its class's `in` hid. The view now finds a key
// in the dict's storage, and asks `__contains__` for JavaScript's `in` alone,
// once, as Python's `in` does; a set's `delete` is its `discard`, and says
// whether the member asked for went, not whether the set shrank: a hash that
// adds a member as it goes, or a `discard` that removes another, told it
// otherwise, and so did a hash that removes another member while the one asked
// for was never held, or a `discard` that keeps a member equal to the one
// asked for.
//
// And `delete` runs what `discard` runs, no more and no less: a `KeyError` the
// author's hash or equality raises reaches the caller, where it once read as a
// member not found; a hash the author's equality asks for runs, where a hash
// lent to the lookup once answered it; a member an equality removes in passing
// is not the one asked for; and a class's own `discard` is answered without
// comparing the member asked for with the ones that went.
//
// The `discard` called is the one Python reads off the set: one its object
// holds, or its `__getattribute__` hands out, was passed over for the set's
// own lookup, which removed what the author's would have kept. And a member
// of a subclass of a number or a string, which crosses as the scalar, went
// when that scalar was deleted, where `delete` said it had not.
//
// The witness is the same operations written in Python (`python_answers`,
// `before`, `present`, `python_raises`, `python_compares`, `python_nested`,
// `python_shy`, `python_dispatch`, `python_scalars`).
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

test("a set's view deletes a member by `discard` alone, which hashes it once", () => {
    const discarded = protocols.python_answers()[4];
    const before = protocols.hashed();

    expect(protocols.kept.delete(protocols.member)).toBe(true);
    expect(protocols.kept.size).toBe(0);
    expect(protocols.hashed() - before).toBe(1);
    expect(protocols.kept.delete(protocols.member)).toBe(false);

    expect(protocols.hidden.delete(1)).toBe(true);
    expect(protocols.hidden.size).toBe(discarded);
});

test("a set's view says whether the member it was asked to delete went", () => {
    const before = [...protocols.before];

    protocols.arm();

    const went = [
        protocols.grown.delete(protocols.adding),
        protocols.elsewhere.delete(protocols.stayer),
        protocols.twin.delete(protocols.twin_key),
        protocols.shrunk.delete(protocols.remover)
    ];

    expect(went).toEqual(protocols.present().map((held, at) => before[at] && !held));
    expect(went).toEqual([true, false, false, false]);
});

test("a set's view lets a KeyError of the author's hash or equality through", () => {
    const raised = protocols.python_raises();
    const named = (run) => {
        try {
            run();
            return null;
        } catch (error) {
            return /KeyError/.test(String(error?.message ?? error)) ? 'KeyError' : String(error);
        }
    };

    protocols.shout(true);

    const mine = [named(() => protocols.hashing.delete(protocols.loud_hash)), named(() => protocols.equalling.delete(protocols.loud_equal))];

    protocols.shout(false);

    expect(mine).toEqual([...raised]);
    expect(mine).toEqual(['KeyError', 'KeyError']);
});

test("a set's view answers a class's own `discard` without comparing the member asked for", () => {
    const start = protocols.compared();

    expect(protocols.others.delete(protocols.counted)).toBe(false);

    const mine = protocols.compared() - start;

    expect(protocols.others.size).toBe(1);
    expect(mine).toBe(protocols.python_compares());
    expect(mine).toBe(0);
});

test("a set's view runs each hash the author's equality asks for during the lookup", () => {
    const start = protocols.nested_hashes();

    expect(protocols.nesting.delete(protocols.nested_key)).toBe(true);

    const mine = protocols.nested_hashes() - start;

    expect(mine).toBe(protocols.python_nested());
    expect(mine).toBe(3);
});

test("a set's view does not take a member an equality removed for the one asked for", () => {
    const went = protocols.shying.delete(protocols.shy);
    const size = protocols.shying.size;

    expect([went, size]).toEqual([false, protocols.python_shy()]);
    expect(size).toBe(1);
});

test("a set's view calls the `discard` Python reads off the set, its object's or its `__getattribute__`'s", () => {
    const went = [protocols.own_bag.delete(1), protocols.reading.delete(1)];
    const held = [[...protocols.own_bag].sort(), [...protocols.reading].sort()];

    expect(held).toEqual(protocols.python_dispatch().map((one) => [...one]));
    expect(held).toEqual([[1], [1]]);
    expect(went).toEqual([false, false]);
});

test("a set's view says a member went when the scalar it crosses as is deleted", () => {
    const sets = [protocols.numbers, protocols.prices, protocols.texts];
    const went = sets.map((view) => view.delete([...view][0]));

    expect(went).toEqual([...protocols.python_scalars()]);
    expect(went).toEqual([true, true, true]);
    expect(sets.map((view) => view.size)).toEqual([0, 0, 0]);
});
